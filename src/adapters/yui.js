// DEPRECATED: This adapter uses YUI which is no longer actively maintained
// It is recommended to use the native or node adapter instead
// See SECURITY.md for more information on security concerns

(function() {
    var mkFhir = require('../fhir');
    var errorHandling = require('../error-handling');
    var dependencyManager = require('../dependency-manager');
    var logging = require('../logging');
    var complexity = require('../complexity');
    
    // Initialize the logger
    var logger = logging.getLogger('adapter:yui');

    // Console warning for deprecation
    console.warn('SECURITY NOTICE: The YUI adapter is deprecated as YUI is no longer actively maintained. ' +
                'Consider using the native or node adapter instead. See SECURITY.md for details.');

    var yui = YUI();

    // Register YUI components with dependency manager
    var io, Promise;
    yui.use('io', function(Y) {
        io = Y.io;
        dependencyManager.register('yui.io', io);
        logger.debug('YUI io module loaded');
    });
    
    yui.use('promise', function(Y) {
        Promise = Y.Promise;
        dependencyManager.register('yui.promise', Y.Promise);
        logger.debug('YUI promise module loaded');
    });

    // Feature detection for capabilities
    var features = {
        cors: typeof window !== 'undefined' && 'withCredentials' in new XMLHttpRequest(),
        jsonp: typeof yui.io !== 'undefined' && typeof yui.io.jsonp !== 'undefined',
        isNode: false,
        isBrowser: true,
        promises: typeof Promise !== 'undefined',
        cancelRequest: typeof io !== 'undefined' && typeof io.abort === 'function'
    };
    
    // Register features with dependency manager
    dependencyManager.registerFeatures('adapter:yui', features);

    var defer = function(){
        var deff = {};
        var pr = new Promise(function(res,rej){
            deff.resolve = res;
            deff.reject = rej;
        });
        deff.promise = pr;
        return deff;
    };
    
    // Use error classification from error-handling module
    var ErrorTypes = errorHandling.ErrorTypes;
    
    // Error classification using the common error-handling module
    function classifyError(error) {
        if (!error || !error.status) {
            return { type: errorHandling.ErrorTypes.NETWORK, retriable: true };
        }
        
        // Authentication errors
        if (error.status === 401 || error.status === 403) {
            return { type: errorHandling.ErrorTypes.AUTH, retriable: false };
        }
        
        // Validation errors
        if (error.status === 400 || error.status === 422) {
            return { type: errorHandling.ErrorTypes.VALIDATION, retriable: false };
        }
        
        // Server errors (all 5xx)
        if (error.status >= 500 && error.status < 600) {
            return { type: errorHandling.ErrorTypes.SERVER, retriable: true };
        }
        
        // Other client errors
        if (error.status >= 400 && error.status < 500) {
            return { type: errorHandling.ErrorTypes.CLIENT, retriable: false };
        }
        
        return { type: errorHandling.ErrorTypes.UNKNOWN, retriable: false };
    }

    var adapter = {
        defer: defer,
        features: features,
        errorTypes: ErrorTypes,
        http: function(args) {
            var deff = defer();
            var startTime = Date.now();
            var timeout = args.timeout || 30000; // Default 30 second timeout
            var retries = args.retries || 0;
            var retryDelay = args.retryDelay || 1000;
            var retriesAttempted = 0;
            var debug = args.debug;
            
            // Get advanced retry configuration
            var advancedRetryConfig = complexity.isFeatureAvailable('advancedRetry') ? 
                args.advancedRetry || {} : null;
                
            // Compute resource type and operation for more specific retry policies
            var resourceInfo = complexity.extractResourceInfo(args.url, args.method);
            
            logger.debug('Making HTTP request', { 
                method: args.method,
                url: args.url,
                resourceType: resourceInfo.resourceType,
                operation: resourceInfo.operation
            });
            
            args.on = {
                success: function(id, data, args) {
                    var endTime = Date.now();
                    var headersFn = function(headerName) {return data.getResponseHeader(headerName);};
                    
                    logger.debug('Request successful', { 
                        method: args.method, 
                        url: args.url, 
                        status: data.status,
                        duration: endTime - startTime 
                    });
                    
                    try {
                        var responseData = data.responseText && JSON.parse(data.responseText);
                        deff.resolve({
                            data: responseData, 
                            status: data.status, 
                            headers: headersFn, 
                            config: args
                        });
                    } catch (error) {
                        logger.error('Error parsing JSON response', { error: error });
                        var parsedError = errorHandling.enhanceError(error, {
                            type: errorHandling.ErrorTypes.PARSING,
                            status: data.status,
                            url: args.url,
                            message: 'Invalid JSON response'
                        });
                        deff.reject(parsedError);
                    }
                },
                failure: function(id, data, args) {
                    var endTime = Date.now();
                    
                    // Create standardized error object using error-handling module
                    var errorObj = errorHandling.createStandardError(data || { status: 0 }, {
                        adapter: 'yui',
                        url: args.url,
                        method: args.method,
                        resourceType: resourceInfo.resourceType,
                        operation: resourceInfo.operation,
                        startTime: startTime,
                        endTime: endTime,
                        attempt: retriesAttempted
                    });
                    
                    // Try to parse the response text if available
                    if (data && data.responseText) {
                        try {
                            errorObj.data = JSON.parse(data.responseText);
                        } catch (e) {
                            errorObj.data = data.responseText;
                        }
                    }
                    
                    // Log the error with our enhanced logging module
                    logger.error('HTTP request failed', {
                        status: errorObj.status,
                        url: args.url,
                        errorType: errorObj.errorType,
                        resourceType: resourceInfo.resourceType,
                        retriable: errorObj.retriable
                    });
                    
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
                            
                            setTimeout(function() {
                                io(args.url, args);
                            }, finalDelay);
                            
                            return;
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
                            logger.debug('Retrying request with basic policy', {
                                attempt: retriesAttempted,
                                delay: finalDelay
                            });
                        }
                        
                        setTimeout(function() {
                            io(args.url, args);
                        }, finalDelay);
                        
                        return;
                    }
                    
                    deff.reject(errorObj);
                }
            };
            
            args.xdr = {
                use: "native",
                credentials: args.credentials === 'include'
            };
            
            io(args.url, args);
            return deff.promise;
        },
        
        defer: defer
    };

    var fhir = function(config) { 
        logger.info('Initializing FHIR client with YUI adapter');
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
    
    fhir.defer = defer;
    fhir.adapter = adapter;
    module.exports = fhir;

}).call(this);
