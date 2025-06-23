/**
 * Advanced logging system for FHIR.js
 * 
 * Features:
 * 1. Multiple log levels (debug, info, warn, error)
 * 2. Contextual logging with FHIR request/response data
 * 3. Filtering by component and level
 * 4. Request/response logging formatting
 * 5. Custom log handlers
 * 6. Performance logging with timing information
 */

(function() {
    /**
     * Log levels with numeric values for comparison
     */
    var LogLevels = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };

    /**
     * Current global log level
     * @type {Number}
     */
    var currentLevel = LogLevels.WARN;

    /**
     * Map of component-specific log levels
     * @type {Object}
     */
    var componentLevels = {};

    /**
     * Registered log handlers
     * @type {Array<Function>}
     */
    var logHandlers = [];

    /**
     * Whether to include timestamps in logs
     * @type {Boolean}
     */
    var includeTimestamps = true;

    /**
     * Whether to include component name in logs
     * @type {Boolean}
     */
    var includeComponent = true;

    /**
     * Whether to colorize console output
     * @type {Boolean}
     */
    var colorizeConsole = true;

    /**
     * Default log handler that logs to console
     * 
     * @param {Object} logEvent - The log event to handle
     */
    var consoleHandler = function(logEvent) {
        if (typeof console === 'undefined') return;
        
        var prefix = '';
        
        if (includeTimestamps) {
            prefix += '[' + new Date().toISOString() + '] ';
        }
        
        if (includeComponent && logEvent.component) {
            prefix += '[' + logEvent.component + '] ';
        }
        
        var message = prefix + logEvent.message;
        
        // Handle different log levels
        switch (logEvent.level) {
            case LogLevels.DEBUG:
                console.debug(message, ...(logEvent.args || []));
                break;
            case LogLevels.INFO:
                console.info(message, ...(logEvent.args || []));
                break;
            case LogLevels.WARN:
                console.warn(message, ...(logEvent.args || []));
                break;
            case LogLevels.ERROR:
                console.error(message, ...(logEvent.args || []));
                break;
        }
    };

    // Register the default console handler
    logHandlers.push(consoleHandler);

    /**
     * Get the effective log level for a component
     * 
     * @param {String} component - Component name
     * @return {Number} - Log level
     */
    function getEffectiveLevel(component) {
        if (component && componentLevels[component] !== undefined) {
            return componentLevels[component];
        }
        return currentLevel;
    }

    /**
     * Set the global log level
     * 
     * @param {String|Number} level - The log level to set
     */
    function setLogLevel(level) {
        if (typeof level === 'string') {
            level = LogLevels[level.toUpperCase()];
        }
        
        if (typeof level === 'number' && level >= LogLevels.DEBUG && level <= LogLevels.NONE) {
            currentLevel = level;
        }
    }

    /**
     * Set a component-specific log level
     * 
     * @param {String} component - Component name
     * @param {String|Number} level - The log level to set
     */
    function setComponentLogLevel(component, level) {
        if (!component) return;
        
        if (typeof level === 'string') {
            level = LogLevels[level.toUpperCase()];
        }
        
        if (typeof level === 'number' && level >= LogLevels.DEBUG && level <= LogLevels.NONE) {
            componentLevels[component] = level;
        }
    }

    /**
     * Register a log handler
     * 
     * @param {Function} handler - Function to handle log events
     */
    function registerLogHandler(handler) {
        if (typeof handler !== 'function') return;
        logHandlers.push(handler);
    }

    /**
     * Remove a registered log handler
     * 
     * @param {Function} handler - Handler to remove
     */
    function removeLogHandler(handler) {
        var index = logHandlers.indexOf(handler);
        if (index !== -1) {
            logHandlers.splice(index, 1);
        }
    }

    /**
     * Create a logger instance for a component
     * 
     * @param {String} component - Component name
     * @return {Object} - Logger instance
     */
    function createLogger(component) {
        /**
         * Send a log event to all registered handlers
         * 
         * @param {Number} level - Log level
         * @param {String} message - Log message
         * @param {Array} args - Additional log arguments
         * @param {Object} [context] - Additional context information
         */
        function log(level, message, args, context) {
            if (level < getEffectiveLevel(component)) {
                return;
            }
            
            var logEvent = {
                timestamp: new Date(),
                level: level,
                levelName: Object.keys(LogLevels).find(key => LogLevels[key] === level),
                component: component,
                message: message,
                args: args,
                context: context
            };
            
            for (var i = 0; i < logHandlers.length; i++) {
                try {
                    logHandlers[i](logEvent);
                } catch (e) {
                    // Prevent handler errors from breaking logging
                    console.error('Error in log handler:', e);
                }
            }
        }

        return {
            /**
             * Log a debug message
             * 
             * @param {String} message - Message to log
             * @param {...any} args - Additional arguments to log
             */
            debug: function(message, ...args) {
                log(LogLevels.DEBUG, message, args);
            },
            
            /**
             * Log an info message
             * 
             * @param {String} message - Message to log
             * @param {...any} args - Additional arguments to log
             */
            info: function(message, ...args) {
                log(LogLevels.INFO, message, args);
            },
            
            /**
             * Log a warning message
             * 
             * @param {String} message - Message to log
             * @param {...any} args - Additional arguments to log
             */
            warn: function(message, ...args) {
                log(LogLevels.WARN, message, args);
            },
            
            /**
             * Log an error message
             * 
             * @param {String} message - Message to log
             * @param {...any} args - Additional arguments to log
             */
            error: function(message, ...args) {
                log(LogLevels.ERROR, message, args);
            },
            
            /**
             * Log FHIR request details
             * 
             * @param {Object} request - FHIR request object
             */
            logRequest: function(request) {
                if (LogLevels.DEBUG < getEffectiveLevel(component)) {
                    return;
                }
                
                log(LogLevels.DEBUG, 'FHIR Request:', [request.method, request.url], {
                    type: 'request',
                    method: request.method,
                    url: request.url,
                    headers: request.headers,
                    data: request.data
                });
            },
            
            /**
             * Log FHIR response details
             * 
             * @param {Object} response - FHIR response object
             * @param {Object} request - Original request object
             */
            logResponse: function(response, request) {
                var level = response.status >= 400 ? LogLevels.WARN : LogLevels.DEBUG;
                
                if (level < getEffectiveLevel(component)) {
                    return;
                }
                
                log(level, 'FHIR Response:', [response.status, request ? request.method : '', request ? request.url : ''], {
                    type: 'response',
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers,
                    data: response.data,
                    request: request
                });
            },
            
            /**
             * Log FHIR operation timing information
             * 
             * @param {String} operation - Operation name
             * @param {Number} durationMs - Duration in milliseconds
             * @param {Object} [context] - Additional context
             */
            logTiming: function(operation, durationMs, context) {
                if (LogLevels.DEBUG < getEffectiveLevel(component)) {
                    return;
                }
                
                log(LogLevels.DEBUG, 'FHIR Timing:', [`${operation} took ${durationMs.toFixed(2)}ms`], {
                    type: 'timing',
                    operation: operation,
                    durationMs: durationMs,
                    context: context
                });
            },
            
            /**
             * Create a performance timer that logs elapsed time when stopped
             * 
             * @param {String} operation - Operation name
             * @param {Object} [context] - Additional context
             * @return {Object} - Timer object with stop method
             */
            startTimer: function(operation, context) {
                var startTime = performance.now();
                
                return {
                    /**
                     * Stop the timer and log the elapsed time
                     */
                    stop: function() {
                        var endTime = performance.now();
                        var duration = endTime - startTime;
                        this.logTiming(operation, duration, context);
                        return duration;
                    }.bind(this)
                };
            },
            
            /**
             * Check if debug level is enabled
             * 
             * @return {Boolean} - Whether debug level is enabled
             */
            isDebugEnabled: function() {
                return LogLevels.DEBUG >= getEffectiveLevel(component);
            }
        };
    }

    /**
     * Create a middleware that logs FHIR requests and responses
     * 
     * @param {Object} options - Middleware options
     * @return {Function} - Middleware function
     */
    function createLoggingMiddleware(options) {
        options = options || {};
        
        var logger = options.logger || createLogger(options.component || 'http');
        var logLevel = options.level || LogLevels.DEBUG;
        var logRequests = options.logRequests !== false;
        var logResponses = options.logResponses !== false;
        var logTimings = options.logTimings !== false;
        
        return function(next) {
            return function(args) {
                var startTime = performance.now();
                
                // Log the request if enabled
                if (logRequests && logLevel >= getEffectiveLevel(logger.component)) {
                    logger.logRequest(args);
                }
                
                return next(args).then(function(response) {
                    // Log the response if enabled
                    if (logResponses && logLevel >= getEffectiveLevel(logger.component)) {
                        logger.logResponse(response, args);
                    }
                    
                    // Log timing information if enabled
                    if (logTimings && logLevel >= getEffectiveLevel(logger.component)) {
                        var endTime = performance.now();
                        var duration = endTime - startTime;
                        logger.logTiming(args.method + ' ' + args.url, duration, {
                            request: args,
                            response: response
                        });
                    }
                    
                    return response;
                }).catch(function(error) {
                    // Log error response if enabled
                    if (logResponses && LogLevels.ERROR >= getEffectiveLevel(logger.component)) {
                        logger.error('FHIR Error Response:', error);
                    }
                    
                    // Log timing for failed request if enabled
                    if (logTimings && logLevel >= getEffectiveLevel(logger.component)) {
                        var endTime = performance.now();
                        var duration = endTime - startTime;
                        logger.logTiming(args.method + ' ' + args.url + ' (failed)', duration, {
                            request: args,
                            error: error
                        });
                    }
                    
                    throw error;
                });
            };
        };
    }

    // Export the API
    module.exports = {
        LogLevels: LogLevels,
        configure: function(config) {
            if (config.level) {
                setLogLevel(config.level);
            }
            includeTimestamps = config.includeTimestamps !== false;
            includeComponent = config.includeComponent !== false;
            colorizeConsole = config.colorizeConsole !== false;
        },
        getLogger: createLogger,
        setLevel: setLogLevel,
        setComponentLogLevel: setComponentLogLevel,
        registerLogHandler: registerLogHandler,
        removeLogHandler: removeLogHandler,
        createLoggingMiddleware: createLoggingMiddleware
    };
})();
