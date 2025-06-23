/**
 * Comprehensive error handling system for FHIR.js
 * 
 * This system provides:
 * 1. Standardized error classification
 * 2. Automatic retry policies
 * 3. Error enrichment with context
 * 4. Error reporting hooks
 * 5. Contextual debugging information
 */

(function() {
    var utils = require('./utils');
    
    /**
     * Error types for classifying FHIR errors
     */
    var ErrorTypes = {
        NETWORK: 'network_error',
        TIMEOUT: 'timeout_error',
        AUTH: 'authentication_error',
        SERVER: 'server_error',
        VALIDATION: 'validation_error',
        CLIENT: 'client_error',
        PARSING: 'parsing_error',
        REFERENCE: 'reference_error',
        PROFILE: 'profile_violation',
        UNKNOWN: 'unknown_error'
    };
    
    /**
     * Standard FHIR operation outcome codes mapped to error types
     */
    var OperationOutcomeSeverity = {
        FATAL: 'fatal',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'information'
    };

    /**
     * Map OperationOutcome issue codes to error types
     */
    var OperationOutcomeCodeMap = {
        'invalid': ErrorTypes.VALIDATION,
        'structure': ErrorTypes.VALIDATION,
        'required': ErrorTypes.VALIDATION,
        'value': ErrorTypes.VALIDATION,
        'invariant': ErrorTypes.VALIDATION,
        'security': ErrorTypes.AUTH,
        'login': ErrorTypes.AUTH,
        'unknown': ErrorTypes.UNKNOWN,
        'expired': ErrorTypes.AUTH,
        'forbidden': ErrorTypes.AUTH,
        'suppressed': ErrorTypes.CLIENT,
        'processing': ErrorTypes.SERVER,
        'not-supported': ErrorTypes.CLIENT,
        'duplicate': ErrorTypes.CLIENT,
        'multiple-matches': ErrorTypes.CLIENT,
        'not-found': ErrorTypes.CLIENT,
        'deleted': ErrorTypes.CLIENT,
        'too-long': ErrorTypes.CLIENT,
        'code-invalid': ErrorTypes.VALIDATION,
        'extension': ErrorTypes.VALIDATION,
        'too-costly': ErrorTypes.CLIENT,
        'business-rule': ErrorTypes.CLIENT,
        'conflict': ErrorTypes.CLIENT,
        'transient': ErrorTypes.SERVER,
        'lock-error': ErrorTypes.SERVER,
        'no-store': ErrorTypes.SERVER,
        'exception': ErrorTypes.SERVER,
        'timeout': ErrorTypes.TIMEOUT,
        'incomplete': ErrorTypes.CLIENT,
        'throttled': ErrorTypes.SERVER,
        'informational': ErrorTypes.UNKNOWN
    };

    /**
     * Default retry policies for different error types
     */
    var DefaultRetryPolicies = {
        [ErrorTypes.NETWORK]: {
            maxRetries: 3,
            baseDelay: 1000,
            exponential: true,
            jitter: true
        },
        [ErrorTypes.TIMEOUT]: {
            maxRetries: 2,
            baseDelay: 2000,
            exponential: true,
            jitter: false
        },
        [ErrorTypes.SERVER]: {
            maxRetries: 2,
            baseDelay: 1500,
            exponential: true,
            jitter: true
        }
    };

    /**
     * Classify an error based on status code, message, and FHIR OperationOutcome if available
     * 
     * @param {Object} error - The error to classify
     * @return {Object} Classification with type and retriable flag
     */
    function classifyError(error) {
        if (!error) return { type: ErrorTypes.UNKNOWN, retriable: false };
        
        // Check for FHIR OperationOutcome in the response
        if (error.data && 
            error.data.resourceType === 'OperationOutcome' && 
            error.data.issue && 
            error.data.issue.length) {
            
            // Get the first fatal/error issue
            var criticalIssue = error.data.issue.find(function(issue) {
                return issue.severity === OperationOutcomeSeverity.FATAL 
                    || issue.severity === OperationOutcomeSeverity.ERROR;
            }) || error.data.issue[0];
            
            if (criticalIssue.code) {
                var mappedType = OperationOutcomeCodeMap[criticalIssue.code] || ErrorTypes.UNKNOWN;
                var retriable = [ErrorTypes.NETWORK, ErrorTypes.TIMEOUT, ErrorTypes.SERVER].includes(mappedType);
                
                return {
                    type: mappedType,
                    retriable: retriable,
                    operationOutcome: error.data,
                    rootCause: {
                        code: criticalIssue.code,
                        severity: criticalIssue.severity,
                        details: criticalIssue.details,
                        diagnostics: criticalIssue.diagnostics
                    }
                };
            }
        }
        
        // Fallbacks based on HTTP status and other error properties
        
        // Network or timeout errors
        if (error.name === 'AbortError') return { type: ErrorTypes.TIMEOUT, retriable: true };
        if (error.status === -1) return { type: ErrorTypes.NETWORK, retriable: true };
        if (error.status === 0) return { type: ErrorTypes.NETWORK, retriable: true };
        if (error.xhrStatus === 'timeout') return { type: ErrorTypes.TIMEOUT, retriable: true };
        
        // Authentication errors
        if (error.status === 401 || error.status === 403) {
            return { type: ErrorTypes.AUTH, retriable: false };
        }
        
        // Validation errors
        if (error.status === 400 || error.status === 422) {
            return { type: ErrorTypes.VALIDATION, retriable: false };
        }
        
        // Server errors (all 5xx)
        if (error.status >= 500 && error.status < 600) {
            return { type: ErrorTypes.SERVER, retriable: true };
        }
        
        // Other client errors
        if (error.status >= 400 && error.status < 500) {
            return { type: ErrorTypes.CLIENT, retriable: false };
        }
        
        return { type: ErrorTypes.UNKNOWN, retriable: false };
    }

    /**
     * Calculate retry delay with exponential backoff and optional jitter
     * 
     * @param {Number} attempt - The attempt number (0-based)
     * @param {Object} policy - The retry policy configuration
     * @return {Number} - Milliseconds to delay before next attempt
     */
    function calculateRetryDelay(attempt, policy) {
        var delay = policy.baseDelay;
        
        if (policy.exponential) {
            delay = delay * Math.pow(2, attempt);
        }
        
        if (policy.jitter) {
            // Add random jitter between 0-30% of the delay
            delay = Math.floor(delay * (1 + Math.random() * 0.3));
        }
        
        return delay;
    }

    /**
     * Enrich an error with additional context and format for consistency
     * 
     * @param {Object} error - The original error
     * @param {Object} context - Additional context information
     * @return {Object} - Enhanced error object
     */
    function enrichError(error, context) {
        if (!error) error = {};
        if (!context) context = {};
        
        var classification = classifyError(error);
        
        var enriched = {
            original: error,
            message: error.message || 'Unknown error',
            status: error.status,
            statusText: error.statusText,
            url: error.url || context.url,
            classification: classification.type,
            retriable: classification.retriable,
            context: {
                timestamp: new Date().toISOString(),
                request: context.request || {},
                response: {
                    data: error.data,
                    status: error.status,
                    headers: error.headers
                },
                operationOutcome: classification.operationOutcome,
                rootCause: classification.rootCause
            },
            stack: error.stack
        };
        
        // Add user-readable error message based on classification and content
        if (classification.rootCause && classification.rootCause.diagnostics) {
            enriched.userMessage = classification.rootCause.diagnostics;
        } else if (error.data && typeof error.data === 'string') {
            enriched.userMessage = error.data;
        } else {
            // Generate user-friendly message based on error type
            switch (classification.type) {
                case ErrorTypes.NETWORK:
                    enriched.userMessage = 'Network connection error. Please check your internet connection.';
                    break;
                case ErrorTypes.TIMEOUT:
                    enriched.userMessage = 'Request timed out. The server took too long to respond.';
                    break;
                case ErrorTypes.AUTH:
                    enriched.userMessage = 'Authentication error. Please check your credentials or login again.';
                    break;
                case ErrorTypes.SERVER:
                    enriched.userMessage = 'Server error. The FHIR server encountered an internal error.';
                    break;
                case ErrorTypes.VALIDATION:
                    enriched.userMessage = 'Validation error. The request data was not valid.';
                    break;
                case ErrorTypes.CLIENT:
                    enriched.userMessage = 'Request error. The request could not be completed.';
                    break;
                default:
                    enriched.userMessage = 'An unknown error occurred.';
            }
        }
        
        return enriched;
    }

    /**
     * Global error reporter - can be overridden by users
     * @type {Function}
     */
    var errorReporter = function(enrichedError) {
        // Default implementation logs to console in non-production
        if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
            console.error('[FHIR.js Error]', enrichedError.userMessage, enrichedError);
        }
    };

    /**
     * Register a custom error reporter
     * 
     * @param {Function} reporter - Function that receives enriched errors
     */
    function registerErrorReporter(reporter) {
        if (typeof reporter === 'function') {
            errorReporter = reporter;
        } else {
            throw new Error('Error reporter must be a function');
        }
    }

    /**
     * Report an error through the registered error reporter
     * 
     * @param {Object} error - The error to report
     * @param {Object} context - Additional context for the error
     */
    function reportError(error, context) {
        var enriched = enrichError(error, context);
        errorReporter(enriched);
        return enriched;
    }

    /**
     * Create a retry middleware that uses the error classification system
     * 
     * @param {Object} options - Retry configuration options
     * @return {Function} - Middleware function
     */
    function createRetryMiddleware(options) {
        options = options || {};
        
        var retryPolicies = Object.assign({}, DefaultRetryPolicies, options.policies || {});
        
        return function(next) {
            return function(args) {
                args = args || {};
                
                // Use the retry policy specific to this request, or fall back to defaults
                var requestPolicies = args.retryPolicies || retryPolicies;
                
                // Function to execute request with retry logic
                var executeWithRetries = function(attempt) {
                    // Clone the args to avoid side effects between retries
                    var requestArgs = utils.clone(args);
                    
                    // Add attempt information for debugging
                    requestArgs.metadata = requestArgs.metadata || {};
                    requestArgs.metadata.attempt = attempt;
                    
                    return next(requestArgs).catch(function(error) {
                        // Classify the error
                        var classification = classifyError(error);
                        
                        // Get the appropriate retry policy for this error type
                        var policy = requestPolicies[classification.type];
                        
                        // Check if we should retry
                        if (classification.retriable && policy && attempt < policy.maxRetries) {
                            // Calculate delay for next retry
                            var delay = calculateRetryDelay(attempt, policy);
                            
                            // Log retry attempt if debug enabled
                            if (args.debug) {
                                console.log(
                                    'FHIR.js retry attempt ' + (attempt + 1) + ' of ' + policy.maxRetries + 
                                    ' for ' + classification.type + ' error. Retrying in ' + delay + 'ms'
                                );
                            }
                            
                            // Return a promise that resolves after the delay
                            return new Promise(function(resolve) {
                                setTimeout(function() {
                                    resolve(executeWithRetries(attempt + 1));
                                }, delay);
                            });
                        }
                        
                        // If we shouldn't retry, enhance the error and rethrow
                        var enriched = enrichError(error, {
                            request: args,
                            url: args.url,
                            attempts: attempt + 1
                        });
                        
                        // Report the error if not retriable or out of retries
                        if (args.reportErrors !== false) {
                            errorReporter(enriched);
                        }
                        
                        // Add retry context to error before rethrowing
                        error.retryContext = {
                            policy: policy,
                            attempts: attempt + 1,
                            classification: classification
                        };
                        
                        throw error;
                    });
                };
                
                // Start execution with attempt 0
                return executeWithRetries(0);
            };
        };
    }

    /**
     * Create a middleware that normalizes errors across adapters
     * 
     * @return {Function} - Middleware function
     */
    function createErrorNormalizationMiddleware() {
        return function(next) {
            return function(args) {
                return next(args).catch(function(error) {
                    // Ensure error has standard shape across adapters
                    if (!error) error = { message: 'Unknown error' };
                    
                    // Normalize to standard error format
                    var normalizedError = {
                        // Make sure we have these core properties
                        message: error.message || 'Unknown error',
                        status: error.status,
                        statusText: error.statusText,
                        data: error.data || error.responseText || error.body,
                        headers: error.headers,
                        url: args.url,
                        config: error.config || args,
                        stack: error.stack
                    };
                    
                    // Preserve original error
                    normalizedError.originalError = error;
                    
                    // Classify the error
                    var classification = classifyError(normalizedError);
                    normalizedError.type = classification.type;
                    normalizedError.retriable = classification.retriable;
                    
                    throw normalizedError;
                });
            };
        };
    }

    // Export the API
    module.exports = {
        ErrorTypes: ErrorTypes,
        OperationOutcomeSeverity: OperationOutcomeSeverity,
        classifyError: classifyError,
        enrichError: enrichError,
        reportError: reportError,
        registerErrorReporter: registerErrorReporter,
        createRetryMiddleware: createRetryMiddleware,
        createErrorNormalizationMiddleware: createErrorNormalizationMiddleware
    };

})();
