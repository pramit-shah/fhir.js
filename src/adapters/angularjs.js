(function() {
    var mkFhir = require('../fhir');
    var errorHandling = require('../error-handling');
    var dependencyManager = require('../dependency-manager');
    var logging = require('../logging');
    var complexity = require('../complexity');
    
    // Initialize the logger
    var logger = logging.getLogger('adapter:angularjs');
    
    // Error Types from error-handling module
    var ErrorTypes = errorHandling.ErrorTypes;

    // Classify error using error-handling module
    function classifyError(error) {
        return errorHandling.classifyError(error);
    }

    // Feature detection for Angular capabilities
    var features = {
        isNode: false,
        isBrowser: true,
        promises: true,
        httpCancellation: false // Angular $http doesn't support native cancellation
    };
    
    // Register features with dependency manager
    dependencyManager.registerFeatures('adapter:angularjs', features);

    angular.module('ng-fhir', ['ng']);

    angular.module('ng-fhir').provider('$fhir', function() {
        var prov = {
            timeout: 30000,  // Default timeout: 30 seconds
            retries: 0,      // Default retries: 0
            retryDelay: 1000, // Default delay between retries: 1 second
            errorTypes: ErrorTypes,
            dependencies: {}
        };
        
        prov.setTimeout = function(timeout) {
            prov.timeout = timeout;
            return prov;
        };
        
        prov.setRetries = function(retries) {
            prov.retries = retries;
            return prov;
        };
        
        prov.setRetryDelay = function(delay) {
            prov.retryDelay = delay;
            return prov;
        };
        
        prov.registerDependency = function(name, implementation) {
            prov.dependencies[name] = implementation;
            return prov;
        };
        
        prov.$get = ['$http', '$q', '$timeout', function($http, $q, $timeout) {
            // Feature detection for advanced capabilities
            var features = {
                interceptors: typeof $http.interceptors === 'object',
                transformRequest: typeof $http.defaults.transformRequest === 'object',
                transformResponse: typeof $http.defaults.transformResponse === 'object'
            };
            
            // Create enhanced adapter with retry and complexity capabilities
            var adapter = {
                http: function(args) {
                    // Get configuration values with fallbacks
                    var timeout = args.timeout || prov.timeout;
                    var retries = args.retries || prov.retries;
                    var retryDelay = args.retryDelay || prov.retryDelay;
                    var debug = args.debug;
                    
                    // Get advanced retry configuration
                    var advancedRetryConfig = complexity.isFeatureAvailable('advancedRetry') ? 
                        args.advancedRetry || {} : null;
                        
                    // Compute resource type and operation for more specific retry policies
                    var resourceInfo = complexity.extractResourceInfo(args.url, args.method);
                    
                    // Track timing and attempts
                    var startTime = Date.now();
                    var retriesAttempted = 0;
                    
                    // Convert args to $http config
                    var config = angular.extend({}, args);
                    
                    // Configure timeout
                    config.timeout = timeout;
                    
                    // Function to make request with advanced retries
                    function executeRequest() {
                        if (debug) {
                            logger.debug('Making HTTP request', { 
                                url: config.url,
                                method: config.method,
                                resourceType: resourceInfo.resourceType,
                                operation: resourceInfo.operation
                            });
                        }
                        
                        // If advanced retry is available, use it
                        if (advancedRetryConfig && complexity.isFeatureAvailable('advancedRetry', complexity.ComplexityLevel.STANDARD)) {
                            var retryParams = {
                                resourceType: resourceInfo.resourceType,
                                operation: resourceInfo.operation,
                                priority: advancedRetryConfig.priority,
                                maxRetries: retries,
                                baseDelay: retryDelay
                            };
                            
                            // Create context for retry module
                            var retryContext = {
                                adapter: 'angularjs',
                                startTime: startTime,
                                attempt: 0,
                                args: args,
                                resourceInfo: resourceInfo
                            };
                            
                            // Use the retry module for advanced retry capabilities
                            return require('../retry').executeWithRetry(
                                function() {
                                    retryContext.attempt++;
                                    return $http(config);
                                },
                                retryParams,
                                retryContext
                            );
                        }
                        
                        // Basic retry (fallback if advanced retry is not available)
                        return $http(config).then(
                            function success(response) {
                                // Create standard response format
                                var result = {
                                    data: response.data,
                                    status: response.status,
                                    headers: response.headers,
                                    config: response.config,
                                    metadata: {
                                        startTime: startTime,
                                        endTime: Date.now(),
                                        responseTime: Date.now() - startTime,
                                        features: features,
                                        retryAttempt: retriesAttempted
                                    }
                                };
                                
                                // Add FHIR-specific metadata
                                if (response.data && response.data.resourceType) {
                                    result.metadata.resourceType = response.data.resourceType;
                                    result.metadata.id = response.data.id;
                                    
                                    // Extract OperationOutcome details if present
                                    if (response.data.resourceType === 'OperationOutcome' && response.data.issue) {
                                        result.metadata.issues = response.data.issue.map(function(issue) {
                                            return {
                                                severity: issue.severity,
                                                code: issue.code,
                                                details: issue.details,
                                                diagnostics: issue.diagnostics
                                            };
                                        });
                                    }
                                }
                                
                                if (debug) {
                                    console.log('DEBUG[angular]: http success', result);
                                }
                                
                                return result;
                            },
                            function error(errorResponse) {
                                // Create standardized error object using error-handling module
                                var errorObj = errorHandling.createStandardError(errorResponse, {
                                    adapter: 'angularjs',
                                    url: config.url,
                                    method: config.method,
                                    resourceType: resourceInfo.resourceType,
                                    operation: resourceInfo.operation,
                                    startTime: startTime,
                                    endTime: Date.now(),
                                    attempt: retriesAttempted
                                });
                                
                                // Log the error with our enhanced logging module
                                logger.error('HTTP request failed', {
                                    status: errorObj.status,
                                    url: config.url,
                                    errorType: errorObj.errorType,
                                    resourceType: resourceInfo.resourceType,
                                    retriable: errorObj.retriable
                                });
                                
                                // Extract FHIR OperationOutcome if present
                                if (errorObj.data && errorObj.data.resourceType === 'OperationOutcome' && errorObj.data.issue) {
                                    errorObj.issues = errorObj.data.issue;
                                }
                                
                                if (debug) {
                                    console.log('DEBUG[angular]: http error', errorObj);
                                }
                                
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
                                            url: config.url,
                                            method: config.method,
                                            resourceType: resourceInfo.resourceType,
                                            delayMs: finalDelay,
                                            errorType: errorObj.errorType
                                        });
                                        
                                        var retryDeferred = $q.defer();
                                        
                                        $timeout(function() {
                                            executeRequest().then(
                                                function(response) { retryDeferred.resolve(response); },
                                                function(err) { retryDeferred.reject(err); }
                                            );
                                        }, finalDelay);
                                    }
                                } 
                                // Fall back to basic retry if advanced retry not available
                                else if (retriesAttempted < retries && errorObj.retriable) {
                                    retriesAttempted++;
                                    
                                    // Use exponential backoff for retries
                                    var backoffDelay = retryDelay * Math.pow(2, retriesAttempted);
                                    var jitter = Math.random() * 0.1 * backoffDelay; // Add 0-10% jitter
                                    var finalDelay = Math.min(backoffDelay + jitter, 30000); // Cap at 30 seconds
                                    
                                    if (debug) {
                                        console.log('DEBUG[angular]: retrying request in ' + finalDelay + 'ms, attempt ' + retriesAttempted + ' of ' + retries);
                                    }
                                    
                                    var retryDeferred = $q.defer();
                                    
                                    $timeout(function() {
                                        executeRequest().then(
                                            function(response) { retryDeferred.resolve(response); },
                                            function(err) { retryDeferred.reject(err); }
                                        );
                                    }, finalDelay);
                                    
                                    return retryDeferred.promise;
                                }
                                
                                return $q.reject(errorObj);
                            }
                        );
                    }
                    
                    // Start the first request
                    var requestPromise = executeRequest();
                    
                    // Add cancel method to the promise if supported
                    var httpTimeout = $timeout(function() {}, timeout + 100);
                    $timeout.cancel(httpTimeout);
                    
                    if (httpTimeout.then && typeof httpTimeout.cancel === 'function') {
                        var originalThen = requestPromise.then;
                        
                        requestPromise.abort = function() {
                            if (config.timeout && typeof config.timeout.resolve === 'function') {
                                config.timeout.resolve('Request canceled');
                            }
                            return requestPromise;
                        };
                    }
                    
                    return requestPromise;
                },
                defer: $q.defer,
                features: features,
                errorTypes: ErrorTypes,
                classifyError: classifyError,
                
                // Dependency injection support
                registerDependency: function(name, implementation) {
                    if (!adapter._dependencies) adapter._dependencies = {};
                    adapter._dependencies[name] = implementation;
                    return adapter;
                },
                
                getDependency: function(name) {
                    if (adapter._dependencies && adapter._dependencies[name]) {
                        return adapter._dependencies[name];
                    }
                    return prov.dependencies[name] || null;
                }
            };
            
            // Register dependencies
            if (prov.dependencies) {
                Object.keys(prov.dependencies).forEach(function(key) {
                    adapter.registerDependency(key, prov.dependencies[key]);
                });
            }
            
            var client = mkFhir(prov, adapter);
            
            // Expose adapter features and error types
            client.features = adapter.features;
            client.errorTypes = adapter.errorTypes;
            client.classifyError = adapter.classifyError;
            
            // Apply advanced middleware if supported by this complexity level
            if (complexity.isFeatureAvailable('advancedMiddleware')) {
                var advancedMiddleware = require('../middlewares/advanced')({
                    retry: prov.retry || {},
                    complexity: prov.complexity || {},
                    events: prov.events || {}
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
        }];
        
        return prov;
    });

}).call(this);
