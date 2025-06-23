(function() {
    var mkFhir = require('../fhir');
    var errorHandling = require('../error-handling');
    var dependencyManager = require('../dependency-manager');
    var logging = require('../logging');
    
    // Initialize the logger
    var logger = logging.getLogger('adapter:jquery');
    
    // Try to find jQuery in window
    var jquery = window['_jQuery'] || window['jQuery'];
    
    // Register jQuery with dependency manager
    if (jquery) {
        dependencyManager.register('jquery', jquery);
        logger.debug('jQuery detected and registered', { version: jquery.fn.jquery });
    } else {
        logger.error('jQuery not found in window');
        throw new Error('FHIR.js: jQuery not found. Make sure jQuery is loaded before this adapter.');
    }

    // Feature detection for capabilities
    var features = {
        cors: typeof window !== 'undefined' && 'withCredentials' in new XMLHttpRequest(),
        jsonp: typeof jquery.ajax === 'function' && typeof jquery.ajaxPrefilter === 'function',
        promises: typeof jquery.Deferred === 'function',
        isNode: false,
        isBrowser: true
    };
    
    // Register features with dependency manager
    dependencyManager.registerFeatures('adapter:jquery', features);

    var defer = function(){
        pr = jquery.Deferred();
        pr.promise = pr.promise();
        return pr;
    };

    var adapter = {
        defer: defer,
        features: features,
        errorTypes: errorHandling.ErrorTypes,
        http: function(args) {
            var ret = jquery.Deferred();
            var url = args.url;
            var debug = args.debug;
            var timeout = args.timeout || 30000; // Default 30 second timeout
            var retries = args.retries || 0;
            var retryDelay = args.retryDelay || 1000;
            var retriesAttempted = 0;
            var progressCallback = args.onProgress;
            
            // Get advanced retry configuration
            var advancedRetryConfig = complexity.isFeatureAvailable('advancedRetry') ? 
                args.advancedRetry || {} : null;
                
            // Compute resource type and operation for more specific retry policies
            var resourceInfo = complexity.extractResourceInfo(args.url, args.method);
            var startTime = Date.now();
            
            // Function to execute an ajax request with retries
            var executeRequest = function() {
                var opts = {
                    type: args.method,
                    url: args.url,
                    headers: args.headers,
                    dataType: "json",
                    contentType: "application/json",
                    data: args.data || args.params,
                    withCredentials: args.credentials === 'include',
                    timeout: timeout
                };

                // Add progress tracking if supported and requested
                if (progressCallback) {
                    opts.xhr = function() {
                        var xhr = jquery.ajaxSettings.xhr();
                        if (xhr.upload) {
                            xhr.upload.addEventListener('progress', function(event) {
                                if (event.lengthComputable) {
                                    progressCallback({
                                        loaded: event.loaded,
                                        total: event.total,
                                        percent: Math.round((event.loaded / event.total) * 100)
                                    });
                                }
                            }, false);
                        }
                        return xhr;
                    };
                }
                
                debug && console.log("DEBUG[jquery](ajax options)", opts);
                
                jquery.ajax(opts)
                    .done(function(data, status, xhr) {
                        var response = {
                            data: data, 
                            status: status, 
                            headers: xhr.getResponseHeader, 
                            config: args,
                            metadata: {
                                startTime: startTime,
                                endTime: Date.now(),
                                responseTime: Date.now() - startTime,
                                features: features
                            }
                        };
                        
                        // Add FHIR-specific metadata
                        if (data && data.resourceType) {
                            response.metadata.resourceType = data.resourceType;
                            response.metadata.id = data.id;
                            
                            // Extract OperationOutcome details if present
                            if (data.resourceType === 'OperationOutcome' && data.issue) {
                                response.metadata.issues = data.issue.map(function(issue) {
                                    return {
                                        severity: issue.severity,
                                        code: issue.code,
                                        details: issue.details,
                                        diagnostics: issue.diagnostics
                                    };
                                });
                            }
                        }
                        
                        debug && console.log('DEBUG[jquery]: (success response)', response);
                        ret.resolve(response);
                    })
                    .fail(function(xhr, status, error) {
                        var errorObj = {
                            status: xhr.status,
                            statusText: xhr.statusText,
                            error: error,
                            config: args
                        };
                        
                        // Try to parse response as JSON if available
                        if (xhr.responseText) {
                            try {
                                errorObj.data = JSON.parse(xhr.responseText);
                            } catch(e) {
                                errorObj.data = xhr.responseText;
                            }
                        }
                        
                        // Classify and enrich error
                        var errorInfo = errorHandling.classifyError(xhr);
                        var enrichedError = errorHandling.enrichError(xhr, {
                            url: args.url,
                            method: args.method,
                            request: args,
                            retryAttempt: retriesAttempted
                        });
                        
                        // Merge properties
                        errorObj = Object.assign(errorObj, {
                            errorType: errorInfo.type,
                            retriable: errorInfo.retriable,
                            userMessage: enrichedError.userMessage
                        });
                        
                        // Add timing metadata
                        errorObj.metadata = {
                            startTime: startTime,
                            endTime: Date.now(),
                            totalTime: Date.now() - startTime,
                            features: features,
                            retryAttempt: retriesAttempted
                        };
                        
                        // Extract FHIR OperationOutcome if present
                        if (errorObj.data && errorObj.data.resourceType === 'OperationOutcome' && errorObj.data.issue) {
                            errorObj.issues = errorObj.data.issue;
                        }
                        
                        debug && console.log('DEBUG[jquery]: error in ajax', errorObj);
                        
                        // Check if we should retry using our advanced retry logic
                        if (advancedRetryConfig && complexity.isFeatureAvailable('advancedRetry')) {
                            // Use the advanced retry policy system
                            var retryDecision = require('../retry').shouldRetry({
                                error: errorObj,
                                attempt: retriesAttempted,
                                resourceType: resourceInfo.resourceType,
                                operation: resourceInfo.operation,
                                priority: advancedRetryConfig.priority || 'normal'
                            });
                            
                            if (retryDecision.shouldRetry) {
                                retriesAttempted++;
                                var finalDelay = retryDecision.delayMs;
                                
                                // Log retry attempt with structured data
                                logger.info('Retrying request', {
                                    attempt: retriesAttempted,
                                    url: args.url,
                                    method: args.method,
                                    resourceType: resourceInfo.resourceType,
                                    delayMs: finalDelay,
                                    errorType: errorObj.errorType
                                });
                                
                                debug && console.log('DEBUG[jquery]: advanced retry in ' + finalDelay + 'ms, attempt ' + retriesAttempted);
                            } else {
                                // Log decision not to retry
                                logger.debug('Request will not be retried', {
                                    reason: retryDecision.reason,
                                    url: args.url,
                                    errorType: errorObj.errorType
                                });
                                ret.reject(errorObj);
                                return;
                            }
                        } 
                        // Fall back to basic retry if advanced retry not available
                        else if (retriesAttempted < retries && errorInfo.retriable) {
                            retriesAttempted++;
                            
                            // Use exponential backoff for retries
                            var backoffDelay = retryDelay * Math.pow(2, retriesAttempted);
                            var jitter = Math.random() * 0.1 * backoffDelay; // Add 0-10% jitter
                            var finalDelay = Math.min(backoffDelay + jitter, 30000); // Cap at 30 seconds
                            
                            debug && console.log('DEBUG[jquery]: retrying request in ' + finalDelay + 'ms, attempt ' + retriesAttempted + ' of ' + retries);
                            
                            setTimeout(executeRequest, finalDelay);
                        } else {
                            ret.reject(errorObj);
                        }
                    });
            };
            
            // Start the first request
            executeRequest();
            
            // Add cancel method to the promise if jQuery supports it
            if (typeof jquery.Deferred().abort === 'function') {
                var originalPromise = ret.promise();
                var augmentedPromise = originalPromise.abort = function() {
                    ret.abort();
                    return originalPromise;
                };
                return augmentedPromise;
            }
            
            return ret.promise();
        },
        
        // Error classification helper
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
        
        // Runtime capability detection
        detectCapabilities: function() {
            return features;
        }
    };

    // Enhanced builder with configuration options
    var buildfhir = function(config) {
        // Apply configuration options
        config = config || {};
        
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
        
        // Apply advanced middleware if supported by this complexity level
        if (complexity.isFeatureAvailable('advancedMiddleware')) {
            var advancedMiddleware = require('../middlewares/advanced')({
                retry: config.retry || {},
                complexity: config.complexity || {},
                events: config.events || {}
            });
            client = advancedMiddleware(client);
            
            // Enhance with complexity management features
            if (complexity.isFeatureAvailable('dependencyGraph')) {
                client.createDependencyGraph = function(resources) {
                    return complexity.createDependencyGraph(resources);
                };
            }
        }
        
        return client;
    };

    buildfhir.defer = defer;
    buildfhir.adapter = adapter;
    
    module.exports = buildfhir;
}).call(this);
