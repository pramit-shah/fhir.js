(function() {
    var utils = require("../utils");
    var errorHandling = require("../error-handling");
    var dependencyManager = require("../dependency-manager");
    var logging = require("../logging");
    
    // Initialize logger
    var logger = logging.getLogger('middleware:http');

    exports.Http = function(cfg, adapter){
        return function(args){
            // Log HTTP request at debug level
            logger.debug('HTTP Request', {
                method: args.method,
                url: args.url,
                params: args.params,
                headers: args.headers
            });
            
            var startTime = Date.now();
            
            // Execute HTTP request
            var promise = (args.http || adapter.http || cfg.http)(args);
            
            // Add logging and error handling
            if (promise && typeof promise.then === 'function') {
                promise = promise.then(
                    function(response) {
                        var duration = Date.now() - startTime;
                        
                        logger.debug('HTTP Response', {
                            method: args.method,
                            url: args.url, 
                            status: response.status,
                            duration: duration,
                            size: response.data ? 
                                (typeof response.data === 'string' ? 
                                    response.data.length : 
                                    JSON.stringify(response.data).length) : 0
                        });
                        
                        return response;
                    },
                    function(error) {
                        var duration = Date.now() - startTime;
                        
                        // Enhance error with our error handling system
                        var enrichedError = errorHandling.enrichError(error, {
                            url: args.url,
                            method: args.method,
                            request: args,
                            duration: duration
                        });
                        
                        logger.error('HTTP Request failed', { 
                            error: enrichedError, 
                            url: args.url, 
                            method: args.method,
                            duration: duration
                        });
                        
                        return Promise.reject(enrichedError);
                    }
                );
            }
            
            return promise;
        };
    };

    var toJson = function(x){
        return (utils.type(x) == 'object' || utils.type(x) == 'array') ? JSON.stringify(x) : x;
    };

    exports.$JsonData = function(h){
        return function(args){
            var data = args.bundle || args.data || args.resource;
            if(data){
                args.data = toJson(data);
            }
            return h(args);
        };
    };

    // Add enhanced HTTP middleware with timeout and retry support
    exports.EnhancedHttp = function(cfg, adapter) {
        return function(args) {
            // Configure timeout from args or global config
            var timeout = args.timeout || (cfg && cfg.timeout);
            var retries = args.retries || (cfg && cfg.retries) || 0;
            var retryDelay = args.retryDelay || (cfg && cfg.retryDelay) || 1000;
            
            // Allow request to be aborted
            var abortController = typeof AbortController !== 'undefined' ? new AbortController() : null;
            if (abortController) {
                args.signal = abortController.signal;
            }
            
            if (args.debug) {
                console.log("\nDEBUG (enhanced request):", args.method, args.url, args);
            }
            
            // Add abort function to the promise
            var executeRequest = function(retriesLeft) {
                var httpFn = args.http || adapter.http || cfg.http;
                var promise = httpFn(args);
                
                if (!promise || !promise.then) {
                    return promise;
                }
                
                var wrappedPromise = promise.then(
                    function(response) {
                        if (args.debug) {
                            console.log("\nDEBUG (enhanced response):", response);
                        }
                        return response;
                    },
                    function(error) {
                        if (retriesLeft > 0 && isRetryableError(error)) {
                            console.warn("FHIR request failed, retrying... (" + (retries - retriesLeft + 1) + "/" + retries + ")");
                            return new Promise(function(resolve) {
                                setTimeout(function() {
                                    resolve(executeRequest(retriesLeft - 1));
                                }, retryDelay);
                            });
                        }
                        throw error;
                    }
                );
                
                // Add abort method to the promise
                if (abortController) {
                    wrappedPromise.abort = function() {
                        abortController.abort();
                    };
                }
                
                return wrappedPromise;
            };
            
            // Check if an error is retryable (network error, timeout, or 5xx)
            var isRetryableError = function(error) {
                return (error && error.status >= 500) || 
                       (error && error.message && (
                           error.message.indexOf('timeout') !== -1 || 
                           error.message.indexOf('network') !== -1
                       ));
            };
            
            return executeRequest(retries);
        };
    };

}).call(this);
