/**
 * Middleware integration for advanced retry and complexity features
 * 
 * This middleware links the core FHIR.js client with the advanced
 * retry and complexity management capabilities.
 */
 
(function() {
    var retry = require('../retry');
    var complexity = require('../complexity');
    var logging = require('../logging');
    var errorHandling = require('../error-handling');
    
    // Initialize logger
    var logger = logging.getLogger('fhir:middlewares:advanced');
    
    /**
     * Create middleware to integrate advanced retry and complexity features
     * 
     * @param {Object} config - Configuration for the middleware
     * @return {Function} - The middleware function
     */
    module.exports = function(config) {
        config = config || {};
        
        // Extract configuration
        var retryConfig = config.retry || {};
        var complexityConfig = config.complexity || {};
        
        // Configure retry system
        retry.configureRetry(retryConfig);
        
        // Configure complexity level
        if (complexityConfig.level) {
            complexity.setComplexityLevel(complexityConfig.level);
        }
        
        // Create advanced retry middleware
        var retryMiddleware = retry.createAdvancedRetryMiddleware({
            policies: retryConfig.policies,
            circuitBreaker: retryConfig.circuitBreaker,
            onRetry: function(info) {
                logger.info('Retrying request', info);
                
                if (typeof config.events?.onRetry === 'function') {
                    config.events.onRetry(info);
                }
            }
        });
        
        return function(client) {
            // Apply retry middleware
            client = retryMiddleware(client);
            
            // Add API for batch processing if complexity level permits
            if (complexity.isFeatureAvailable('batchProcessor', complexity.ComplexityLevel.ADVANCED)) {
                client.processBatch = function(requests, options) {
                    var batchProcessor = complexity.createBatchProcessor(client, options);
                    return batchProcessor(requests);
                };
            }
            
            // Add API for pagination if complexity level permits
            if (complexity.isFeatureAvailable('pagination', complexity.ComplexityLevel.STANDARD)) {
                client.pagination = function(searchParams, options) {
                    return complexity.createPaginationHandler(client, options);
                };
            }
            
            // Add API for complex query building
            client.buildComplexQuery = function(params) {
                return complexity.buildComplexQuery(params);
            };
            
            // Add API for circuit breaker control
            client.circuitBreaker = {
                reset: function(key) {
                    retry.resetCircuitBreaker(key || '*');
                },
                getState: function(key) {
                    return retry.getCircuitBreakerState(key || '*');
                }
            };
            
            // Add API for complexity management
            client.complexity = {
                setLevel: function(level) {
                    complexity.setComplexityLevel(level);
                },
                getLevel: function() {
                    return complexity.getComplexityLevel();
                },
                isFeatureAvailable: function(feature, requiredLevel) {
                    return complexity.isFeatureAvailable(feature, requiredLevel);
                },
                createOrderedBundle: function(resources, type) {
                    return complexity.createOrderedBundle(resources, type);
                }
            };
            
            return client;
        };
    };
}).call(this);
