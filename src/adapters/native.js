var mkFhir = require('../fhir');
var errorHandling = require('../error-handling');
var dependencyManager = require('../dependency-manager');
var logging = require('../logging');
var complexity = require('../complexity');

// Initialize the logger
var logger = logging.getLogger('adapter:native');

// Register dependencies
dependencyManager.register('fetch', window.fetch);
dependencyManager.register('AbortController', window.AbortController);

// Fetch Helper JSON Parsing
function parseJSON(response) {
  // response.json() throws on empty body
  return response.text()
  .then(function(text) {
    return text.length > 0 ? JSON.parse(text) : "";
  });
}

// Fetch Helper for Status Codes
function checkStatus(httpResponse) {
  return new Promise(function (resolve, reject) {
    if (httpResponse.status < 200 || httpResponse.status > 399) {
      // Convert to a consistent error format
      httpResponse.text().then(function(body) {
        var error = {
          status: httpResponse.status,
          statusText: httpResponse.statusText,
          url: httpResponse.url,
          headers: httpResponse.headers,
          data: null
        };
        
        // Try to parse as JSON if possible
        try {
          if (body && body.length > 0) {
            error.data = JSON.parse(body);
          }
        } catch(e) {
          error.data = body;
        }
        
        reject(error);
      }).catch(function(textError) {
        // If we can't even get the text, just return the response
        reject({
          status: httpResponse.status,
          statusText: httpResponse.statusText,
          url: httpResponse.url,
          headers: httpResponse.headers,
          error: textError
        });
      });
    } else {
      resolve(httpResponse);
    }
  });
}

// Build a backwards compatible defer object
var defer = function(){
  var def = {};
  def.promise = new Promise(function (resolve, reject) {
    def.resolve = resolve;
    def.reject = reject;
  });
  return def;
};

// Feature detection for advanced capabilities
var features = {
  isNode: false,
  isBrowser: true,
  abortController: typeof AbortController !== 'undefined',
  structuredClone: typeof structuredClone !== 'undefined',
  requestIdleCallback: typeof requestIdleCallback !== 'undefined',
  indexedDB: typeof indexedDB !== 'undefined',
  fetch: typeof fetch !== 'undefined',
  promise: typeof Promise !== 'undefined'
};

// Register features with dependency manager
dependencyManager.registerFeatures('adapter:native', features);

// Use the error classification from error-handling module
var ErrorTypes = errorHandling.ErrorTypes;

// Use the error classification from the error-handling module
function classifyError(error) {
  return errorHandling.classifyError(error);
}

// Build Adapter Object with progressive enhancement
var adapter = {
  defer: defer,
  features: features,
  errorTypes: ErrorTypes,
  http: function (args) {
    var url = args.url;
    var debug = args.debug;
    var timeout = args.timeout || 30000; // Default 30 second timeout
    var retries = args.retries || 0;
    var retryDelay = args.retryDelay || 1000;
    var progressCallback = args.onProgress;

    // Create a copy of the args to use as fetch options
    var fetchOptions = Object.assign({}, args);

    // Pass along cookies
    fetchOptions.credentials = args.credentials || '';
    if (fetchOptions.credentials === '') {
      delete fetchOptions.credentials;
    }

    // data needs to map to body if data is populated and this is not a GET or HEAD request
    if (!['GET', 'HEAD'].includes(fetchOptions.method) && fetchOptions.data) {
      fetchOptions.body = fetchOptions.data;
      // Remove data from fetchOptions as it's not a valid fetch option
      delete fetchOptions.data;
    }

    // Create AbortController for timeout support
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    if (controller) {
      fetchOptions.signal = controller.signal;
    }

    debug && console.log("DEBUG[native](fetchOptions)", fetchOptions);

    // Function to execute a fetch request with retries, progressive loading, and detailed error handling
    var executeFetch = function(retriesLeft) {
      var timeoutId;
      var progressReported = false;
      var startTime = Date.now();
      
      // Set timeout if supported and specified
      if (controller && timeout) {
        timeoutId = setTimeout(function() {
          controller.abort();
        }, timeout);
      }
      
      return new Promise(function(resolve, reject) {
        var returnableObject = {
          config: args,
          metadata: {
            startTime: startTime,
            features: features,
            retryAttempt: retries - retriesLeft
          }
        };

        // Wrap fetch with instrumentation
        fetch(url, fetchOptions)
          .then(function(response) {
            if (timeoutId) clearTimeout(timeoutId);
            
            // Calculate response time
            returnableObject.metadata.responseTime = Date.now() - startTime;
            
            debug && console.log("DEBUG[native](response)", response);
            
            // Support for streaming responses with progress reporting
            if (progressCallback && response.body && typeof response.body.getReader === 'function') {
              var contentLength = response.headers.get('Content-Length');
              var receivedLength = 0;
              var reader = response.body.getReader();
              var chunks = [];
              
              var processChunk = function(result) {
                if (result.done) {
                  // Build complete response
                  var chunksAll = new Uint8Array(receivedLength);
                  let position = 0;
                  for(let chunk of chunks) {
                    chunksAll.set(chunk, position);
                    position += chunk.length;
                  }
                  
                  // Convert to text for processing
                  var decodedBody = new TextDecoder("utf-8").decode(chunksAll);
                  
                  // Parse as JSON if possible
                  var parsedBody;
                  try {
                    parsedBody = JSON.parse(decodedBody);
                  } catch(e) {
                    parsedBody = decodedBody;
                  }
                  
                  // Create a mock response for further processing
                  var mockResponse = new Response(decodedBody, {
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                  });
                  
                  // Store response info
                  Object.assign(returnableObject, {
                    status: response.status,
                    headers: response.headers,
                    data: parsedBody
                  });
                  
                  return mockResponse;
                }
                
                // Process the chunk
                receivedLength += result.value.length;
                chunks.push(result.value);
                
                // Report progress if callback provided
                if (progressCallback && contentLength) {
                  progressCallback({
                    loaded: receivedLength,
                    total: parseInt(contentLength),
                    percent: Math.round((receivedLength / contentLength) * 100)
                  });
                }
                
                // Continue reading
                return reader.read().then(processChunk);
              };
              
              return reader.read().then(processChunk);
            }
            
            // This object is in the shape required by fhir.js lib
            Object.assign(returnableObject, {
              status: response.status,
              headers: response.headers
            });
            
            return response;
          })
          .then(checkStatus)
          .then(parseJSON)
          .then(function(fhirObject) {
            // Add the data
            returnableObject.data = fhirObject;
            
            // Add FHIR-specific metadata
            if (fhirObject && fhirObject.resourceType) {
              returnableObject.metadata.resourceType = fhirObject.resourceType;
              returnableObject.metadata.id = fhirObject.id;
              
              // Extract OperationOutcome details if present
              if (fhirObject.resourceType === 'OperationOutcome' && fhirObject.issue) {
                returnableObject.metadata.issues = fhirObject.issue.map(function(issue) {
                  return {
                    severity: issue.severity,
                    code: issue.code,
                    details: issue.details,
                    diagnostics: issue.diagnostics
                  };
                });
              }
            }
            
            debug && console.log('DEBUG[native]: (success response)', returnableObject);
            returnableObject.metadata.endTime = Date.now();
            returnableObject.metadata.totalTime = returnableObject.metadata.endTime - startTime;
            
            resolve(returnableObject);
          })
          .catch(function(error) {
            if (timeoutId) clearTimeout(timeoutId);
            
            // Enhanced error classification
            var errorInfo = classifyError(error);
            
            // Normalize error format
            if (error.name === 'AbortError') {
              error = {
                status: 0,
                statusText: 'Timeout',
                message: 'Request timed out after ' + timeout + 'ms',
                errorType: ErrorTypes.TIMEOUT
              };
            }
            
            // Enhanced error object
            Object.assign(returnableObject, {
              error: error,
              errorType: errorInfo.type,
              retriable: errorInfo.retriable
            });
            
            // Try to extract FHIR OperationOutcome if available
            if (error.data && error.data.resourceType === 'OperationOutcome' && error.data.issue) {
              returnableObject.issues = error.data.issue;
            }
            
            // Add timing information
            returnableObject.metadata.endTime = Date.now();
            returnableObject.metadata.totalTime = returnableObject.metadata.endTime - startTime;
            
            debug && console.log('DEBUG[native]: error in fetch', error);
            
            // Enhanced retry logic
            var shouldRetry = retriesLeft > 0 && errorInfo.retriable;
            
            if (shouldRetry) {
              // Use exponential backoff for retries
              var backoffDelay = retryDelay * Math.pow(2, retries - retriesLeft);
              var jitter = Math.random() * 0.1 * backoffDelay; // Add 0-10% jitter
              var finalDelay = Math.min(backoffDelay + jitter, 30000); // Cap at 30 seconds
              
              debug && console.log('DEBUG[native]: retrying request in ' + finalDelay + 'ms, attempts left:', retriesLeft);
              
              setTimeout(function() {
                executeFetch(retriesLeft - 1).then(resolve, reject);
              }, finalDelay);
            } else {
              reject(returnableObject);
            }
          });
      });
    };

    // Create a promise that can be aborted
    var promise = executeFetch(retries);
    
    // Add enhanced methods to the promise for better control
    if (controller) {
      // Abort the request
      promise.abort = function(reason) {
        controller.abort(reason || 'Request manually aborted');
        return promise;
      };
    }
    
    // Add metadata to the promise
    promise.getMetadata = function() {
      return { 
        url: url,
        method: fetchOptions.method,
        timeout: timeout,
        retries: retries,
        startTime: Date.now(),
        features: features
      };
    };
    
    // Add request cloning capability for duplicating requests
    promise.clone = function(overrideArgs) {
      var newArgs = Object.assign({}, args, overrideArgs || {});
      return adapter.http(newArgs);
    };
    
    return promise;
  },
  
  // Runtime capability detection
  detectCapabilities: function() {
    return features;
  },
  
  // Enhanced error handling helpers
  classifyError: classifyError,
  
  // Dependency injection support
  registerDependency: function(name, implementation) {
    if (!adapter._dependencies) adapter._dependencies = {};
    adapter._dependencies[name] = implementation;
    return adapter;
  },
  
  getDependency: function(name) {
    return (adapter._dependencies && adapter._dependencies[name]) || null;
  },
  
  // IndexedDB caching if available
  enableOfflineSupport: function(options) {
    if (!features.indexedDB) {
      console.warn('IndexedDB not available, offline support disabled');
      return adapter;
    }
    
    options = options || {};
    var dbName = options.dbName || 'fhirjs_offline';
    var storeName = options.storeName || 'fhir_resources';
    var expiryTime = options.expiryTime || 7 * 24 * 60 * 60 * 1000; // 1 week default
    
    // Initialize the database
    var dbPromise = new Promise(function(resolve, reject) {
      var request = indexedDB.open(dbName, 1);
      
      request.onerror = function(event) {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
      
      request.onupgradeneeded = function(event) {
        var db = event.target.result;
        var store = db.createObjectStore(storeName, { keyPath: 'url' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      };
      
      request.onsuccess = function(event) {
        resolve(event.target.result);
      };
    });
    
    // Register cache functions as dependencies
    adapter.registerDependency('cacheRead', function(url) {
      return dbPromise.then(function(db) {
        return new Promise(function(resolve, reject) {
          var transaction = db.transaction([storeName], 'readonly');
          var store = transaction.objectStore(storeName);
          var request = store.get(url);
          
          request.onsuccess = function(event) {
            var record = event.target.result;
            if (!record) {
              resolve(null);
              return;
            }
            
            // Check expiry
            if (Date.now() - record.timestamp > expiryTime) {
              // Expired - delete and return null
              var deleteTransaction = db.transaction([storeName], 'readwrite');
              var deleteStore = deleteTransaction.objectStore(storeName);
              deleteStore.delete(url);
              resolve(null);
            } else {
              resolve(record.data);
            }
          };
          
          request.onerror = function(event) {
            reject(event.target.error);
          };
        });
      }).catch(function(error) {
        console.error('Cache read error:', error);
        return null;
      });
    });
    
    adapter.registerDependency('cacheWrite', function(url, data) {
      return dbPromise.then(function(db) {
        return new Promise(function(resolve, reject) {
          var transaction = db.transaction([storeName], 'readwrite');
          var store = transaction.objectStore(storeName);
          var request = store.put({
            url: url,
            data: data,
            timestamp: Date.now()
          });
          
          request.onsuccess = function() {
            resolve(true);
          };
          
          request.onerror = function(event) {
            reject(event.target.error);
          };
        });
      }).catch(function(error) {
        console.error('Cache write error:', error);
        return false;
      });
    });
    
    return adapter;
  }
};

// Enhanced builder with configuration options
var buildfhir = function buildfhir(config) {
  // Apply configuration options
  config = config || {};
  
  // Enable offline support if requested
  if (config.offline) {
    adapter.enableOfflineSupport(config.offlineOptions);
  }
  
  // Register custom dependencies if provided
  if (config.dependencies) {
    Object.keys(config.dependencies).forEach(function(key) {
      adapter.registerDependency(key, config.dependencies[key]);
    });
  }
  
  // Create the FHIR client
  var client = mkFhir(config, adapter);
  
  // Expose adapter features
  client.features = adapter.features;
  client.errorTypes = adapter.errorTypes;
  
  // Add convenience methods for error classification
  client.classifyError = adapter.classifyError;
  
  // Apply the advanced middleware if specified
  if (config.useAdvanced !== false) {
    var advancedMiddleware = require('../middlewares/advanced');
    var advancedOptions = config.advanced || {};
    
    client = advancedMiddleware({
      retry: advancedOptions.retry,
      complexity: advancedOptions.complexity,
      events: advancedOptions.events
    })(client);
    
    logger.info('Advanced retry and complexity middleware applied');
  }
  
  return client;
};

// Expose the adapter and defer function
buildfhir.defer = defer;
buildfhir.adapter = adapter;

module.exports = buildfhir;
