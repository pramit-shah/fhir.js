(function() {
    var utils = require('./utils');
    
    /**
     * Integration utilities for fhir.js adapters and middleware components
     */
    
    /**
     * Normalizes a FHIR bundle across different FHIR versions
     * to provide consistent access patterns regardless of R4 or DSTU2
     * 
     * @param {Object} bundle - The FHIR bundle to normalize
     * @return {Object} - A normalized bundle with consistent access patterns
     */
    exports.normalizeBundle = function(bundle) {
        if (!bundle || !bundle.entry) {
            return bundle;
        }
        
        // Create a new bundle that preserves the original
        var normalized = Object.assign({}, bundle);
        
        // Normalize each entry to ensure it has both .resource and .content properties
        normalized.entry = bundle.entry.map(function(entry) {
            var newEntry = Object.assign({}, entry);
            
            // Ensure resource property exists
            if (entry.content && !entry.resource) {
                newEntry.resource = entry.content;
            } 
            // Ensure content property exists
            else if (entry.resource && !entry.content) {
                newEntry.content = entry.resource;
            }
            
            return newEntry;
        });
        
        return normalized;
    };
    
    /**
     * Creates a compatible adapter from a newer fetch-based HTTP client
     * to work with older fhir.js expecting jQuery/Angular style promises
     * 
     * @param {Function} fetchFn - A fetch-like function
     * @param {Object} options - Configuration options
     * @return {Object} - A fhir.js compatible adapter
     */
    exports.createFetchAdapter = function(fetchFn, options) {
        options = options || {};
        
        // Simple promise implementation if not provided
        var defer = function() {
            var resolve, reject;
            var promise = new Promise(function(res, rej) {
                resolve = res;
                reject = rej;
            });
            return {
                resolve: resolve,
                reject: reject,
                promise: promise
            };
        };
        
        return {
            http: function(args) {
                var url = args.url;
                var method = args.method;
                var data = args.data;
                var headers = args.headers || {};
                var debug = args.debug;
                var timeout = args.timeout || options.timeout || 30000;
                var retries = args.retries || options.retries || 0;
                var retryDelay = args.retryDelay || options.retryDelay || 1000;
                
                var fetchOptions = {
                    method: method,
                    headers: headers,
                    credentials: options.credentials || args.credentials || 'same-origin'
                };
                
                // Support for AbortController
                var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
                if (controller) {
                    fetchOptions.signal = controller.signal;
                }
                
                if (data && method !== 'GET') {
                    fetchOptions.body = data;
                }
                
                var deferred = defer();
                
                // Function to execute a fetch request with retries
                var executeFetch = function(retriesLeft) {
                    var timeoutId;
                    
                    // Set timeout if controller is available
                    if (controller && timeout) {
                        timeoutId = setTimeout(function() {
                            controller.abort();
                        }, timeout);
                    }
                    
                    if (debug) {
                        console.log('DEBUG[fetch-adapter]: fetch request', url, fetchOptions);
                    }
                    
                    fetchFn(url, fetchOptions)
                        .then(function(response) {
                            if (timeoutId) clearTimeout(timeoutId);
                            
                            if (!response.ok) {
                                return response.text().then(function(text) {
                                    throw {
                                        status: response.status,
                                        statusText: response.statusText,
                                        url: response.url,
                                        message: text
                                    };
                                });
                            }
                            
                            var contentType = response.headers.get('content-type');
                            if (contentType && contentType.indexOf('json') !== -1) {
                                return response.json();
                            } else {
                                return response.text();
                            }
                        })
                        .then(function(data) {
                            deferred.resolve(data);
                        })
                        .catch(function(error) {
                            if (timeoutId) clearTimeout(timeoutId);
                            
                            // Handle timeout errors
                            if (error && error.name === 'AbortError') {
                                error = {
                                    status: 0,
                                    statusText: 'Timeout',
                                    message: 'Request timed out after ' + timeout + 'ms'
                                };
                            }
                            
                            // Handle retries for network errors and 5xx errors
                            var shouldRetry = retriesLeft > 0 && 
                                (error.status === 0 || (error.status && error.status >= 500));
                                
                            if (shouldRetry) {
                                if (debug) {
                                    console.log('DEBUG[fetch-adapter]: retrying request, attempts left:', retriesLeft);
                                }
                                
                                setTimeout(function() {
                                    executeFetch(retriesLeft - 1);
                                }, retryDelay);
                            } else {
                                deferred.reject(error);
                            }
                        });
                };
                
                // Start the fetch process
                executeFetch(retries);
                
                // Add abort method to the promise
                var promise = deferred.promise;
                if (controller) {
                    promise.abort = function() {
                        controller.abort();
                    };
                }
                
                return promise;
            },
            defer: defer
        };
    };
    
    /**
     * Creates a response cache middleware to improve performance
     * 
     * @param {Object} options - Cache options
     * @return {Function} - A middleware function
     */
    exports.createCacheMiddleware = function(options) {
        options = options || {};
        var ttl = options.ttl || 60000; // Default 1 minute TTL
        var cacheSize = options.size || 100;
        var cache = {};
        var keys = [];
        
        // Simple LRU cache implementation
        var getFromCache = function(key) {
            var item = cache[key];
            if (!item) return null;
            
            // Check if item has expired
            if (Date.now() > item.expires) {
                delete cache[key];
                keys = keys.filter(function(k) { return k !== key; });
                return null;
            }
            
            // Move to front of LRU
            keys = keys.filter(function(k) { return k !== key; });
            keys.unshift(key);
            
            return item.value;
        };
        
        var putInCache = function(key, value) {
            // Maintain cache size limit
            if (keys.length >= cacheSize) {
                var oldestKey = keys.pop();
                delete cache[oldestKey];
            }
            
            cache[key] = {
                value: value,
                expires: Date.now() + ttl
            };
            
            keys.unshift(key);
        };
        
        // Return the actual middleware function
        return function(h) {
            return function(args) {
                // Only cache GET requests
                if (args.method !== 'GET' || args.noCache === true) {
                    return h(args);
                }
                
                var cacheKey = args.url + '|' + (args.headers ? JSON.stringify(args.headers) : '');
                var cachedResponse = getFromCache(cacheKey);
                
                if (cachedResponse) {
                    var deferred = args.defer();
                    deferred.resolve(cachedResponse);
                    return deferred.promise;
                }
                
                return h(args).then(function(response) {
                    putInCache(cacheKey, response);
                    return response;
                });
            };
        };
    };
    
    /**
     * Helper to combine multi-resource search with reference resolution
     * 
     * @param {Object} client - FHIR client instance
     * @param {Object} searchParams - Search parameters including multi-resource query
     * @param {Array} resolveParams - Array of references to resolve
     * @return {Promise} - Promise resolving to search results with resolved references
     */
    exports.searchWithReferences = function(client, searchParams, resolveParams) {
        if (!client || !client.search) {
            throw new Error('Valid FHIR client required');
        }
        
        var adapter = client._adapter || {};
        var defer = adapter.defer;
        if (!defer) {
            throw new Error('Client must have adapter with defer method');
        }
        
        var deferred = defer();
        
        // Perform the search first
        client.search(searchParams)
            .then(function(results) {
                if (!resolveParams || resolveParams.length === 0) {
                    // No references to resolve, return results as-is
                    deferred.resolve(results);
                    return;
                }
                
                var bundle = results.data;
                if (!bundle || !bundle.entry || bundle.entry.length === 0) {
                    // Empty bundle, no references to resolve
                    deferred.resolve(results);
                    return;
                }
                
                // Normalize the bundle to handle different FHIR versions
                bundle = exports.normalizeBundle(bundle);
                
                // Track resolved references
                var resolvedReferences = {};
                var pendingReferences = 0;
                var errors = [];
                
                // Process each entry to find references to resolve
                bundle.entry.forEach(function(entry) {
                    var resource = entry.resource || entry.content;
                    if (!resource) return;
                    
                    // For each reference path to resolve
                    resolveParams.forEach(function(refPath) {
                        var pathParts = refPath.split('.');
                        var resourceType = pathParts[0];
                        var referencePath = pathParts.slice(1).join('.');
                        
                        // Skip if resource type doesn't match
                        if (resource.resourceType !== resourceType) {
                            return;
                        }
                        
                        // Get the reference value from the path
                        var reference = utils.getPath(resource, referencePath);
                        if (!reference || !reference.reference) {
                            return;
                        }
                        
                        var referenceId = reference.reference;
                        
                        // Skip if already resolved
                        if (resolvedReferences[referenceId]) {
                            return;
                        }
                        
                        // Mark as pending
                        pendingReferences++;
                        
                        // Resolve the reference
                        client.resolve({
                            reference: reference,
                            base: searchParams.baseUrl,
                            bundle: bundle
                        })
                        .then(function(resolved) {
                            resolvedReferences[referenceId] = resolved.data || resolved.content;
                            pendingReferences--;
                            
                            // Check if all references are resolved
                            if (pendingReferences === 0) {
                                // Add resolved references to the results
                                results.resolvedReferences = resolvedReferences;
                                
                                // If there were errors, add them too
                                if (errors.length > 0) {
                                    results.errors = errors;
                                }
                                
                                deferred.resolve(results);
                            }
                        })
                        .catch(function(error) {
                            errors.push({
                                reference: referenceId,
                                error: error
                            });
                            pendingReferences--;
                            
                            // Continue even if some references fail to resolve
                            if (pendingReferences === 0) {
                                results.resolvedReferences = resolvedReferences;
                                results.errors = errors;
                                deferred.resolve(results);
                            }
                        });
                    });
                });
                
                // If no references were found to resolve
                if (pendingReferences === 0) {
                    deferred.resolve(results);
                }
            })
            .catch(function(error) {
                deferred.reject(error);
            });
        
        return deferred.promise;
    };
    
}).call(this);
