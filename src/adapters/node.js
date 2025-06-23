(function() {
    var errorHandling = require('../error-handling');
    var dependencyManager = require('../dependency-manager');
    var logging = require('../logging');
    
    // Initialize the logger
    var logger = logging.getLogger('adapter:node');
    
    // Handle different Node.js versions for fetch
    var fetch;
    var AbortController;
    
    try {
        // Node.js v18+
        fetch = globalThis.fetch;
        AbortController = globalThis.AbortController;
        logger.info('Using native fetch from Node.js');
    } catch (e) {
        // Node.js v16 and below
        try {
            fetch = require('node-fetch');
            AbortController = require('abort-controller');
            logger.info('Using node-fetch module');
        } catch(fetchError) {
            logger.error('Failed to load fetch implementation', { error: fetchError });
            throw new Error('No fetch implementation available. Please install node-fetch: npm install node-fetch abort-controller');
        }
    }
    
    // If we still don't have fetch, require it as a fallback
    if (!fetch) {
        try {
            fetch = require('node-fetch');
            logger.info('Using node-fetch as fallback');
        } catch(e) {
            logger.error('Failed to load node-fetch fallback', { error: e });
        }
    }
    
    if (!AbortController) {
        try {
            AbortController = require('abort-controller');
            logger.info('Using abort-controller module');
        } catch(e) {
            logger.error('Failed to load abort-controller', { error: e });
        }
    }
    
    // Register these dependencies
    dependencyManager.register('fetch', fetch);
    dependencyManager.register('AbortController', AbortController);
    
    // Feature detection
    var features = {
        isNode: true,
        fetch: typeof fetch !== 'undefined',
        abortController: typeof AbortController !== 'undefined',
        promise: typeof Promise !== 'undefined'
    };
    
    // Register features
    dependencyManager.registerFeatures('adapter:node', features);
    
    var mkFhir = require('../fhir');
    
    // Helper for parsing JSON responses
    function parseJSON(response) {
      // Handle empty responses
      return response.text()
        .then(function(text) {
          return text.length > 0 ? JSON.parse(text) : "";
        });
    }
    
    // Helper for checking status codes
    function checkStatus(response) {
      return new Promise(function(resolve, reject) {
        if (response.status < 200 || response.status > 399) {
          // Convert to a consistent error format
          response.text().then(function(body) {
            var error = {
              status: response.status,
              statusText: response.statusText,
              url: response.url,
              headers: response.headers,
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
              status: response.status,
              statusText: response.statusText,
              url: response.url,
              headers: response.headers,
              error: textError
            });
          });
        } else {
          resolve(response);
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

    var adapter = {
        defer: defer,
        http: function(args) {
            var debug = args.debug;
            var timeout = args.timeout || 30000; // Default 30 second timeout
            var retries = args.retries || 0;
            var retryDelay = args.retryDelay || 1000;
            
            // Add complexity information to the request
            var complexityLevel = args.complexityLevel || '';
            if (complexityLevel && typeof complexity !== 'undefined') {
                try {
                    complexity.setComplexityLevel(complexityLevel);
                    logger.debug('Setting complexity level for request', { level: complexityLevel });
                } catch (e) {
                    logger.warn('Invalid complexity level specified', { level: complexityLevel, error: e.message });
                }
            }
            
            // Process request data
            if(args.data && typeof args.data === "string") {
              try {
                args.body = JSON.parse(args.data);
              }
              catch (e) {
                throw new Error('Failed to parse. Expected JSON data...');
              }
            }
            else if (args.data) {
              args.body = args.data;
            }
            
            // Process URL
            var baseUrl = args.baseUrl || '';
            var url = args.url || '';
            
            if(url) {
                // Remove baseUrl from url if it's already included
                url = url.replace(baseUrl, '');
            }
            
            if(url === '') {
              url = '/';
            }
            
            // Format the fetch options
            var fetchOptions = {
              method: args.method,
              headers: args.headers || {}
            };
            
            // Add body for non-GET requests
            if (args.body && !['GET', 'HEAD'].includes(args.method)) {
              fetchOptions.body = JSON.stringify(args.body);
            }
            
            // Add credentials if specified
            if (args.credentials) {
              fetchOptions.credentials = args.credentials;
            }
            
            // Create AbortController for timeout support
            var controller = new AbortController();
            fetchOptions.signal = controller.signal;
            
            if(debug) {
                console.log('DEBUG[node]: (request)', args);
                console.log('DEBUG[node]: (fetchOptions)', fetchOptions);
            }
            
            // Function to execute a fetch request with retries
            var executeFetch = function(retriesLeft) {
              var timeoutId;
              
              // Set timeout if supported and specified
              if (timeout) {
                timeoutId = setTimeout(function() {
                  controller.abort();
                }, timeout);
              }
              
              return new Promise(function(resolve, reject) {
                var returnableObject = { config: args };
            
                fetch(`${baseUrl}${url}`, fetchOptions)
                  .then(function(response) {
                    if (timeoutId) clearTimeout(timeoutId);
                    
                    // Store response metadata
                    Object.assign(returnableObject, {
                      status: response.status,
                      headers: response.headers,
                      url: response.url
                    });
                    
                    return response;
                  })
                  .then(checkStatus)
                  .then(parseJSON)
                  .then(function(data) {
                    // Add the response data
                    returnableObject.data = data;
                    
                    if(debug) {
                      console.log('DEBUG[node]: (response)', returnableObject);
                    }
                    
                    resolve(returnableObject);
                  })
                  .catch(function(error) {
                    if (timeoutId) clearTimeout(timeoutId);
                    
                    // Handle timeout errors
                    if (error.name === 'AbortError') {
                      error = {
                        status: 0,
                        statusText: 'Timeout',
                        message: 'Request timed out after ' + timeout + 'ms'
                      };
                    }
                    
                    // Add error to the return object
                    Object.assign(returnableObject, {
                      error: error
                    });
                    
                    if(debug) {
                      console.log('DEBUG[node]: (error)', error);
                    }
                    
                    // Handle retries for network errors and 5xx errors
                    var shouldRetry = retriesLeft > 0 && 
                      (error.status === 0 || (error.status && error.status >= 500) || 
                       (error.code && ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND'].includes(error.code)));
                    
                    if (shouldRetry) {
                      if(debug) {
                        console.log('DEBUG[node]: retrying request, attempts left:', retriesLeft);
                      }
                      
                      setTimeout(function() {
                        executeFetch(retriesLeft - 1).then(resolve, reject);
                      }, retryDelay);
                    } else {
                      reject(returnableObject);
                    }
                  });
              });
            };
            
            // Create a promise that can be aborted
            var promise = executeFetch(retries);
            
            // Add abort method to the promise
            promise.abort = function() {
              controller.abort();
            };
            
            return promise;
        }
    };

    module.exports = function(config) {
        // Initialize config
        config = config || {};
        
        // Get middleware configuration from config
        var advancedOptions = config.advanced || {};
        
        // Create the FHIR client
        var client = mkFhir(config, adapter);
        
        // Apply the advanced middleware if specified
        if (config.useAdvanced !== false) {
            var advancedMiddleware = require('../middlewares/advanced');
            client = advancedMiddleware({
                retry: advancedOptions.retry,
                complexity: advancedOptions.complexity,
                events: advancedOptions.events
            })(client);
            
            logger.info('Advanced retry and complexity middleware applied');
        }
        
        return client;
    };

}).call(this);
