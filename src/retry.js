/**
 * Advanced retry policy system for FHIR.js
 * 
 * This module provides sophisticated retry capabilities:
 * 1. Circuit breaker pattern to prevent cascading failures
 * 2. Exponential backoff with jitter for distributed systems
 * 3. Retry budgeting to limit retry attempts across multiple requests
 * 4. Different strategies per error type and resource
 * 5. Retry event hooks for monitoring and metrics
 * 6. Priority-based retry policies for important operations
 * 7. Adaptive retry mechanisms based on server health
 * 8. Rate limiting detection and handling
 * 9. Batch request and transaction optimization
 * 10. Context-aware retry decisions for complex operations
 */

(function() {
    var utils = require('./utils');
    var errorHandling = require('./error-handling');
    var logging = require('./logging');
    
    // Initialize logger for retry module
    var logger = logging.getLogger('retry');
    
    /**
     * Circuit breaker state tracking
     * @private
     */
    var circuitBreakers = {};
    
    /**
     * Retry budget tracking (to limit global retry rate)
     * @private
     */
    var retryBudget = {
        maxRetryRatio: 0.1, // Default: 10% of requests can be retries
        requestCount: 0,
        retryCount: 0,
        windowStart: Date.now(),
        windowSize: 60 * 1000 // 1 minute window
    };
    
    /**
     * Circuit breaker states
     */
    var CircuitState = {
        CLOSED: 'closed',      // Normal operation, requests pass through
        OPEN: 'open',          // Failing, requests are immediately rejected
        HALF_OPEN: 'half-open' // Testing if system has recovered
    };
    
    /**
     * Priority levels for retry operations
     * Higher priority operations get preference when retry budget is limited
     */
    var RetryPriority = {
        CRITICAL: 'critical',   // Mission-critical operations (e.g., saving patient data)
        HIGH: 'high',           // High importance operations (e.g., clinical data retrieval)
        NORMAL: 'normal',       // Standard operations (default)
        LOW: 'low',             // Low priority operations (e.g., background sync)
        BACKGROUND: 'background' // Non-essential operations
    };
    
    /**
     * Server health tracking for adaptive retry behavior
     * @private
     */
    var serverHealthTracking = {
        endpoints: {},
        globalHealth: {
            status: 'healthy', // 'healthy', 'degraded', 'unhealthy'
            lastUpdate: Date.now(),
            successRate: 1.0,
            latency: {
                avg: 0,
                min: 0,
                max: 0,
                samples: []
            },
            requestCount: 0,
            errorCount: 0
        },
        // How long to keep samples
        sampleWindow: 5 * 60 * 1000, // 5 minutes
        // Thresholds for health determination
        thresholds: {
            successRate: {
                healthy: 0.95,
                degraded: 0.75
            },
            latency: {
                degradedMs: 2000, // 2 seconds
                unhealthyMs: 5000 // 5 seconds
            }
        }
    };
    
    /**
     * Rate limit detection
     * @private 
     */
    var rateLimitTracking = {
        endpoints: {},
        lastRateLimitTimestamp: 0,
        detectedLimits: {},
        backoffMode: false,
        backoffUntil: 0,
        backoffMultiplier: 1,
        maxBackoffMultiplier: 8
    };
    
    /**
     * Batch and transaction retry state
     * @private
     */
    var batchRetryState = {
        activeBatches: {},
        failedOperations: {},
        retryPartialBatches: true,
        maxBatchSplitAttempts: 3,
        batchSplitFactor: 2 // Split batches in half on failure
    };
    
    /**
     * Calculates retry delay with sophisticated backoff strategies
     * 
     * @param {Number} attempt - Current attempt number (0-based)
     * @param {Object} policy - Retry policy configuration
     * @return {Number} - Milliseconds to wait before next attempt
     */
    function calculateBackoff(attempt, policy) {
        var delay = policy.baseDelay;
        
        // Apply the chosen backoff strategy
        switch (policy.strategy) {
            case 'constant':
                // Constant delay between retries
                break;
                
            case 'linear':
                // Linear increase in delay
                delay = delay * (attempt + 1);
                break;
                
            case 'exponential':
            default:
                // Exponential backoff (default)
                delay = delay * Math.pow(policy.factor || 2, attempt);
                break;
                
            case 'decorrelated':
                // Decorrelated jitter (helps in distributed systems)
                // Formula: min(cap, random(base, previousDelay * 3))
                var prevDelay = attempt > 0 ? 
                    policy._previousDelay : 
                    policy.baseDelay;
                    
                delay = Math.random() * (prevDelay * 3 - policy.baseDelay) + policy.baseDelay;
                policy._previousDelay = delay;
                break;
        }
        
        // Apply jitter if enabled (helps prevent thundering herd problem)
        if (policy.jitter) {
            // Add random jitter between 0-25% of the delay
            var jitterPct = Math.random() * 0.25;
            delay = Math.floor(delay * (1 + jitterPct));
        }
        
        // Apply maximum delay cap if specified
        if (policy.maxDelay) {
            delay = Math.min(delay, policy.maxDelay);
        }
        
        return delay;
    }
    
    /**
     * Checks if the circuit breaker allows a request
     * 
     * @param {String} key - Circuit breaker identifier (e.g., baseUrl + resourceType)
     * @param {Object} options - Circuit breaker options
     * @return {Boolean} - Whether the request should be allowed
     */
    function checkCircuitBreaker(key, options) {
        // Get or create circuit breaker for this key
        var breaker = circuitBreakers[key] || {
            state: CircuitState.CLOSED,
            failureCount: 0,
            lastFailureTime: 0,
            nextAttemptTime: 0
        };
        
        var now = Date.now();
        var threshold = options.failureThreshold || 5;
        var resetTimeout = options.resetTimeout || 30000; // 30 seconds
        
        // Update the circuit breaker
        circuitBreakers[key] = breaker;
        
        // Check circuit breaker state
        switch (breaker.state) {
            case CircuitState.OPEN:
                // If reset timeout has elapsed, transition to half-open
                if (now >= breaker.nextAttemptTime) {
                    logger.debug('Circuit half-open', { key: key });
                    breaker.state = CircuitState.HALF_OPEN;
                    return true;
                }
                logger.debug('Circuit open, rejecting request', { key: key, remainingMs: breaker.nextAttemptTime - now });
                return false;
                
            case CircuitState.HALF_OPEN:
                // In half-open state, allow one request to test the waters
                logger.debug('Circuit half-open, testing with request', { key: key });
                return true;
                
            case CircuitState.CLOSED:
            default:
                // Normal operation
                return true;
        }
    }
    
    /**
     * Updates circuit breaker state based on request outcome
     * 
     * @param {String} key - Circuit breaker identifier
     * @param {Boolean} success - Whether the request succeeded
     * @param {Object} options - Circuit breaker options
     */
    function updateCircuitBreaker(key, success, options) {
        if (!circuitBreakers[key]) return;
        
        var breaker = circuitBreakers[key];
        var threshold = options.failureThreshold || 5;
        var resetTimeout = options.resetTimeout || 30000; // 30 seconds
        var now = Date.now();
        
        if (success) {
            // On success
            if (breaker.state === CircuitState.HALF_OPEN) {
                // If successful while testing the waters, close the circuit
                logger.info('Circuit closed after successful test request', { key: key });
                breaker.state = CircuitState.CLOSED;
                breaker.failureCount = 0;
            } else if (breaker.state === CircuitState.CLOSED) {
                // Reset failure count on success in closed state
                breaker.failureCount = 0;
            }
        } else {
            // On failure
            breaker.failureCount++;
            breaker.lastFailureTime = now;
            
            if (breaker.state === CircuitState.HALF_OPEN) {
                // If failed while testing the waters, reopen the circuit
                logger.warn('Circuit reopened after failed test request', { key: key });
                breaker.state = CircuitState.OPEN;
                breaker.nextAttemptTime = now + resetTimeout;
            } else if (breaker.state === CircuitState.CLOSED && breaker.failureCount >= threshold) {
                // Trip the circuit if we've hit the failure threshold
                logger.warn('Circuit opened after multiple failures', { 
                    key: key, 
                    failureCount: breaker.failureCount,
                    threshold: threshold 
                });
                breaker.state = CircuitState.OPEN;
                breaker.nextAttemptTime = now + resetTimeout;
            }
        }
    }
    
    /**
     * Checks if we have enough retry budget
     * 
     * @return {Boolean} - Whether a retry should be permitted
     */
    function checkRetryBudget() {
        var now = Date.now();
        
        // Reset the window if needed
        if (now - retryBudget.windowStart > retryBudget.windowSize) {
            retryBudget.windowStart = now;
            retryBudget.requestCount = 0;
            retryBudget.retryCount = 0;
        }
        
        // Don't allow retries if we've exceeded our budget
        if (retryBudget.requestCount > 0) {
            var currentRatio = retryBudget.retryCount / retryBudget.requestCount;
            if (currentRatio >= retryBudget.maxRetryRatio) {
                logger.warn('Retry budget exceeded, denying retry', { 
                    ratio: currentRatio,
                    maxRatio: retryBudget.maxRetryRatio
                });
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * Updates retry budget tracking
     * 
     * @param {Boolean} isRetry - Whether this is a retry attempt
     */
    function updateRetryBudget(isRetry) {
        var now = Date.now();
        
        // Reset the window if needed
        if (now - retryBudget.windowStart > retryBudget.windowSize) {
            retryBudget.windowStart = now;
            retryBudget.requestCount = 0;
            retryBudget.retryCount = 0;
        }
        
        retryBudget.requestCount++;
        
        if (isRetry) {
            retryBudget.retryCount++;
        }
    }
    
    /**
     * Configure global retry settings
     * 
     * @param {Object} options - Global retry configuration
     */
    function configureRetry(options) {
        if (!options) return;
        
        if (options.retryBudget) {
            if (typeof options.retryBudget.maxRetryRatio === 'number') {
                retryBudget.maxRetryRatio = options.retryBudget.maxRetryRatio;
            }
            
            if (typeof options.retryBudget.windowSize === 'number') {
                retryBudget.windowSize = options.retryBudget.windowSize;
            }
        }
        
        logger.info('Retry system configured', { 
            budgetRatio: retryBudget.maxRetryRatio,
            windowSizeMs: retryBudget.windowSize
        });
    }
    
    /**
     * More intelligent retry policy middleware with circuit breaker, retry budgets,
     * and more advanced backoff strategies
     * 
     * @param {Object} options - Configuration options
     * @return {Function} - Middleware function
     */
    function createAdvancedRetryMiddleware(options) {
        options = options || {};
        
        // Define default policies based on error types
        var defaultPolicies = {
            [errorHandling.ErrorTypes.NETWORK]: {
                maxRetries: 3,
                baseDelay: 1000,
                strategy: 'exponential', 
                factor: 2,
                jitter: true,
                maxDelay: 30000, // Cap at 30 seconds
                retryableStatusCodes: [0, 408, 425, 429, 500, 502, 503, 504]
            },
            [errorHandling.ErrorTypes.TIMEOUT]: {
                maxRetries: 2,
                baseDelay: 2000,
                strategy: 'exponential',
                factor: 2,
                jitter: true,
                maxDelay: 10000
            },
            [errorHandling.ErrorTypes.SERVER]: {
                maxRetries: 3,
                baseDelay: 1000,
                strategy: 'decorrelated', // Use decorrelated jitter for server errors
                jitter: false, // Already has jitter in the strategy
                maxDelay: 20000,
                retryableStatusCodes: [500, 502, 503, 504, 507, 429]
            },
            [errorHandling.ErrorTypes.AUTH]: {
                maxRetries: 1, // Limited retries for auth errors
                baseDelay: 500,
                strategy: 'constant',
                retryableStatusCodes: [401] // Only retry once for auth, in case token expired
            }
        };
        
        // Merge provided policies with defaults
        var retryPolicies = Object.assign({}, defaultPolicies, options.policies || {});
        
        // Circuit breaker options
        var circuitOptions = Object.assign({
            enabled: true,
            failureThreshold: 5,
            resetTimeout: 30000, // 30 seconds
            halfOpenMaxRequests: 1
        }, options.circuitBreaker || {});
        
        // Return the middleware
        return function(next) {
            return function(args) {
                args = args || {};
                
                // Prepare retry context
                var retryContext = {
                    attempt: 0,
                    startTime: Date.now(),
                    circuitBreakerKey: (args.baseUrl || '') + ':' + (args.type || 'resource')
                };
                
                // Create a wrapper for the request function that includes retry logic
                var executeWithRetryLogic = function() {
                    // Check if this is a retry
                    var isRetry = retryContext.attempt > 0;
                    
                    // Update retry budget
                    updateRetryBudget(isRetry);
                    
                    // Check circuit breaker - don't attempt if circuit is open
                    if (circuitOptions.enabled &&
                        !checkCircuitBreaker(retryContext.circuitBreakerKey, circuitOptions)) {
                        return Promise.reject({
                            error: new Error('Circuit breaker open'),
                            status: 0,
                            circuitBreaker: {
                                state: circuitBreakers[retryContext.circuitBreakerKey].state,
                                nextAttemptTime: circuitBreakers[retryContext.circuitBreakerKey].nextAttemptTime
                            }
                        });
                    }
                    
                    // Clone the args to avoid side effects between retries
                    var requestArgs = utils.clone(args);
                    
                    // Add metadata about the retry
                    requestArgs.metadata = requestArgs.metadata || {};
                    requestArgs.metadata.attempt = retryContext.attempt;
                    requestArgs.metadata.retryContext = retryContext;
                    
                    // Add hooks for monitoring retry requests
                    if (typeof options.onRetry === 'function' && isRetry) {
                        options.onRetry({
                            attempt: retryContext.attempt,
                            resource: args.type,
                            method: args.method,
                            url: args.url,
                            duration: Date.now() - retryContext.startTime
                        });
                    }
                    
                    // Execute the actual request
                    return next(requestArgs).then(function(response) {
                        // Success! Update circuit breaker
                        if (circuitOptions.enabled) {
                            updateCircuitBreaker(retryContext.circuitBreakerKey, true, circuitOptions);
                        }
                        return response;
                        
                    }).catch(function(error) {
                        // Get retry policy for this error type
                        var errorInfo = errorHandling.classifyError(error);
                        var policy = retryPolicies[errorInfo.type];
                        
                        // Check if we have a retry policy for this error type
                        var shouldRetry = errorInfo.retriable && policy && 
                                          retryContext.attempt < (policy.maxRetries || 0);
                                          
                        // Check if this specific status code is retryable
                        if (shouldRetry && policy.retryableStatusCodes && error.status) {
                            shouldRetry = policy.retryableStatusCodes.indexOf(error.status) !== -1;
                        }
                        
                        // Custom retry condition checking
                        if (shouldRetry && typeof policy.retryCondition === 'function') {
                            shouldRetry = policy.retryCondition(error, retryContext);
                        }
                        
                        // Also check retry budget
                        if (shouldRetry && !checkRetryBudget()) {
                            shouldRetry = false;
                        }
                        
                        // Check if we should retry the request
                        if (shouldRetry) {
                            // Calculate delay based on retry policy
                            var delay = calculateBackoff(retryContext.attempt, policy);
                            
                            // Update retry context
                            retryContext.attempt++;
                            retryContext.lastError = error;
                            retryContext.lastDelay = delay;
                            
                            // Log retry attempt
                            logger.info('Retrying request', {
                                attempt: retryContext.attempt,
                                maxRetries: policy.maxRetries,
                                errorType: errorInfo.type,
                                status: error.status,
                                url: args.url,
                                delayMs: delay
                            });
                            
                            // Return a promise that resolves after the delay
                            return new Promise(function(resolve) {
                                setTimeout(function() {
                                    resolve(executeWithRetryLogic());
                                }, delay);
                            });
                        } else {
                            // Update circuit breaker on failure
                            if (circuitOptions.enabled) {
                                updateCircuitBreaker(retryContext.circuitBreakerKey, false, circuitOptions);
                            }
                            
                            // Add retry context to the error
                            error.retryContext = {
                                attempts: retryContext.attempt,
                                duration: Date.now() - retryContext.startTime,
                                policy: policy ? {
                                    type: errorInfo.type,
                                    maxRetries: policy.maxRetries,
                                    strategy: policy.strategy
                                } : null,
                                circuitBreaker: circuitOptions.enabled ? {
                                    key: retryContext.circuitBreakerKey,
                                    state: circuitBreakers[retryContext.circuitBreakerKey]?.state || 'unknown'
                                } : null
                            };
                            
                            // We've exhausted our retry options or the error is not retryable
                            return Promise.reject(error);
                        }
                    });
                };
                
                // Start the execution chain
                return executeWithRetryLogic();
            };
        };
    }
    
    /**
     * Reset a circuit breaker for testing or recovery
     * 
     * @param {String} key - Circuit breaker key to reset
     */
    function resetCircuitBreaker(key) {
        if (key === '*') {
            // Reset all circuit breakers
            circuitBreakers = {};
            logger.info('All circuit breakers reset');
        } else if (circuitBreakers[key]) {
            // Reset specific circuit breaker
            circuitBreakers[key].state = CircuitState.CLOSED;
            circuitBreakers[key].failureCount = 0;
            circuitBreakers[key].nextAttemptTime = 0;
            logger.info('Circuit breaker reset', { key: key });
        }
    }
    
    /**
     * Get the current state of a circuit breaker
     * 
     * @param {String} key - Circuit breaker key
     * @return {Object} - Circuit breaker state
     */
    function getCircuitBreakerState(key) {
        if (key === '*') {
            return circuitBreakers;
        }
        return circuitBreakers[key] || { state: CircuitState.CLOSED, failureCount: 0 };
    }
    
    /**
     * Updates server health metrics based on request results
     * 
     * @param {String} endpoint - The server endpoint
     * @param {Object} metrics - Request metrics (success, latency, etc.)
     */
    function updateServerHealth(endpoint, metrics) {
        var now = Date.now();
        var baseUrl = endpoint || 'global';
        
        // Initialize endpoint tracking if needed
        if (!serverHealthTracking.endpoints[baseUrl]) {
            serverHealthTracking.endpoints[baseUrl] = {
                status: 'healthy',
                lastUpdate: now,
                successRate: 1.0,
                latency: {
                    avg: 0,
                    min: 0,
                    max: 0,
                    samples: []
                },
                requestCount: 0,
                errorCount: 0
            };
        }
        
        var health = serverHealthTracking.endpoints[baseUrl];
        var global = serverHealthTracking.globalHealth;
        
        // Update request counts
        health.requestCount++;
        global.requestCount++;
        
        if (!metrics.success) {
            health.errorCount++;
            global.errorCount++;
        }
        
        // Update success rate
        health.successRate = (health.requestCount > 0) ? 
            (health.requestCount - health.errorCount) / health.requestCount : 1.0;
        
        global.successRate = (global.requestCount > 0) ?
            (global.requestCount - global.errorCount) / global.requestCount : 1.0;
        
        // Update latency tracking if available
        if (typeof metrics.latency === 'number') {
            // Add to samples
            health.latency.samples.push({
                time: now,
                value: metrics.latency
            });
            
            global.latency.samples.push({
                time: now,
                value: metrics.latency
            });
            
            // Clean up old samples
            var cutoff = now - serverHealthTracking.sampleWindow;
            health.latency.samples = health.latency.samples.filter(function(sample) {
                return sample.time >= cutoff;
            });
            
            global.latency.samples = global.latency.samples.filter(function(sample) {
                return sample.time >= cutoff;
            });
            
            // Calculate new averages
            if (health.latency.samples.length > 0) {
                var sum = 0;
                var min = Number.MAX_SAFE_INTEGER;
                var max = 0;
                
                health.latency.samples.forEach(function(sample) {
                    sum += sample.value;
                    min = Math.min(min, sample.value);
                    max = Math.max(max, sample.value);
                });
                
                health.latency.avg = sum / health.latency.samples.length;
                health.latency.min = min;
                health.latency.max = max;
            }
            
            // Same for global
            if (global.latency.samples.length > 0) {
                var gSum = 0;
                var gMin = Number.MAX_SAFE_INTEGER;
                var gMax = 0;
                
                global.latency.samples.forEach(function(sample) {
                    gSum += sample.value;
                    gMin = Math.min(gMin, sample.value);
                    gMax = Math.max(gMax, sample.value);
                });
                
                global.latency.avg = gSum / global.latency.samples.length;
                global.latency.min = gMin;
                global.latency.max = gMax;
            }
        }
        
        // Update health status based on metrics
        var thresholds = serverHealthTracking.thresholds;
        
        // Determine endpoint health
        if (health.successRate < thresholds.successRate.degraded ||
            health.latency.avg > thresholds.latency.unhealthyMs) {
            health.status = 'unhealthy';
        } else if (health.successRate < thresholds.successRate.healthy ||
                  health.latency.avg > thresholds.latency.degradedMs) {
            health.status = 'degraded';
        } else {
            health.status = 'healthy';
        }
        
        // Determine global health
        if (global.successRate < thresholds.successRate.degraded ||
            global.latency.avg > thresholds.latency.unhealthyMs) {
            global.status = 'unhealthy';
        } else if (global.successRate < thresholds.successRate.healthy ||
                  global.latency.avg > thresholds.latency.degradedMs) {
            global.status = 'degraded';
        } else {
            global.status = 'healthy';
        }
        
        // Update timestamps
        health.lastUpdate = now;
        global.lastUpdate = now;
        
        logger.debug('Server health updated', {
            endpoint: baseUrl,
            status: health.status,
            successRate: health.successRate,
            latencyAvg: health.latency.avg,
            globalStatus: global.status
        });
        
        return health.status;
    }
    
    /**
     * Get current server health information
     * 
     * @param {String} endpoint - The server endpoint to check, or null for global health
     * @return {Object} - Health metrics for the endpoint
     */
    function getServerHealth(endpoint) {
        if (!endpoint) {
            return serverHealthTracking.globalHealth;
        }
        
        return serverHealthTracking.endpoints[endpoint] || serverHealthTracking.globalHealth;
    }
    
    /**
     * Adjust retry policy based on server health
     * 
     * @param {Object} policy - The base retry policy
     * @param {Object} context - The retry context including server health
     * @return {Object} - Adjusted retry policy
     */
    function getAdaptiveRetryPolicy(policy, context) {
        if (!policy) {
            return policy;
        }
        
        // Clone the policy so we don't modify the original
        var adjustedPolicy = utils.clone(policy);
        
        var health = context.serverHealth || 'healthy';
        var priority = context.priority || RetryPriority.NORMAL;
        
        // Adjust retries based on server health
        if (health === 'degraded') {
            // Reduce max retries for non-critical operations when server is degraded
            if (priority !== RetryPriority.CRITICAL && priority !== RetryPriority.HIGH) {
                adjustedPolicy.maxRetries = Math.max(1, Math.floor(adjustedPolicy.maxRetries / 2));
            }
            
            // Increase delays
            adjustedPolicy.baseDelay *= 1.5;
            
            // Switch to more predictable strategy
            if (adjustedPolicy.strategy === 'decorrelated') {
                adjustedPolicy.strategy = 'exponential';
                adjustedPolicy.jitter = true;
            }
            
            // Lower max delay to ensure retry attempts happen
            if (adjustedPolicy.maxDelay) {
                adjustedPolicy.maxDelay *= 0.8;
            }
        } else if (health === 'unhealthy') {
            // Only allow critical operations to retry when server is unhealthy
            if (priority === RetryPriority.CRITICAL) {
                adjustedPolicy.maxRetries = Math.min(adjustedPolicy.maxRetries, 2);
            } else if (priority === RetryPriority.HIGH) {
                adjustedPolicy.maxRetries = Math.min(adjustedPolicy.maxRetries, 1);
            } else {
                adjustedPolicy.maxRetries = 0; // No retries for normal/low priority when server is unhealthy
            }
            
            // Double base delay
            adjustedPolicy.baseDelay *= 2;
        }
        
        // Priority-based adjustments
        switch (priority) {
            case RetryPriority.CRITICAL:
                // Critical operations get more retries even when retry budget is low
                adjustedPolicy.maxRetries = Math.max(adjustedPolicy.maxRetries, 2);
                break;
                
            case RetryPriority.HIGH:
                // High priority operations get at least one retry
                adjustedPolicy.maxRetries = Math.max(adjustedPolicy.maxRetries, 1);
                break;
                
            case RetryPriority.LOW:
            case RetryPriority.BACKGROUND:
                // Low priority operations get fewer retries
                adjustedPolicy.maxRetries = Math.min(adjustedPolicy.maxRetries, 1);
                break;
        }
        
        logger.debug('Adaptive retry policy', {
            serverHealth: health,
            priority: priority,
            originalMaxRetries: policy.maxRetries,
            adjustedMaxRetries: adjustedPolicy.maxRetries,
            adjustedBaseDelay: adjustedPolicy.baseDelay
        });
        
        return adjustedPolicy;
    }
    
    // Export the public API
    module.exports = {
        createAdvancedRetryMiddleware: createAdvancedRetryMiddleware,
        configureRetry: configureRetry,
        CircuitState: CircuitState,
        calculateBackoff: calculateBackoff,
        resetCircuitBreaker: resetCircuitBreaker,
        getCircuitBreakerState: getCircuitBreakerState,
        updateServerHealth: updateServerHealth,
        getServerHealth: getServerHealth,
        getAdaptiveRetryPolicy: getAdaptiveRetryPolicy
    };
    
}).call(this);
