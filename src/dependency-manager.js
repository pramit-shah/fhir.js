/**
 * Dependency management system for FHIR.js
 * 
 * This module provides a flexible dependency management system that:
 * 1. Allows registering and retrieving dependencies
 * 2. Provides fallbacks for missing dependencies
 * 3. Supports lazy loading of dependencies
 * 4. Allows feature detection and progressive enhancement
 * 5. Handles dependency versioning conflicts
 */

(function() {
    var utils = require('./utils');
    
    /**
     * Registry of dependencies
     * @private
     */
    var dependencies = {};
    
    /**
     * Feature detection registry
     * @private
     */
    var features = {
        // Environment features
        isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
        isBrowser: typeof window !== 'undefined' && typeof window.document !== 'undefined',
        isServiceWorker: typeof self !== 'undefined' && typeof self.registration !== 'undefined',
        
        // API features
        fetch: typeof fetch !== 'undefined',
        promise: typeof Promise !== 'undefined',
        abortController: typeof AbortController !== 'undefined',
        structuredClone: typeof structuredClone !== 'undefined',
        indexedDB: typeof indexedDB !== 'undefined',
        localStorage: typeof localStorage !== 'undefined',
        webWorkers: typeof Worker !== 'undefined',
        
        // Advanced features
        streams: typeof ReadableStream !== 'undefined',
        requestIdleCallback: typeof requestIdleCallback !== 'undefined',
        intersectionObserver: typeof IntersectionObserver !== 'undefined',
        caches: typeof caches !== 'undefined'
    };

    /**
     * Fallback implementations for key APIs
     */
    var fallbacks = {
        // Simple Promise-based defer implementation
        defer: function() {
            var deferred = {};
            deferred.promise = new Promise(function(resolve, reject) {
                deferred.resolve = resolve;
                deferred.reject = reject;
            });
            return deferred;
        },
        
        // Simple implementation of fetch using XMLHttpRequest
        fetch: function(url, options) {
            return new Promise(function(resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open(options.method || 'GET', url);
                
                // Set headers
                if (options.headers) {
                    Object.keys(options.headers).forEach(function(key) {
                        xhr.setRequestHeader(key, options.headers[key]);
                    });
                }
                
                // Handle response
                xhr.onload = function() {
                    var response = {
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        headers: xhr.getAllResponseHeaders().split('\r\n').reduce(function(acc, header) {
                            var parts = header.split(': ');
                            if (parts[0] && parts[1]) {
                                acc[parts[0]] = parts[1];
                            }
                            return acc;
                        }, {}),
                        text: function() { return Promise.resolve(xhr.responseText); },
                        json: function() { 
                            try {
                                return Promise.resolve(JSON.parse(xhr.responseText));
                            } catch (e) {
                                return Promise.reject(new Error('Invalid JSON'));
                            }
                        }
                    };
                    resolve(response);
                };
                
                // Handle errors
                xhr.onerror = function() {
                    reject(new Error('Network request failed'));
                };
                
                // Handle timeout
                xhr.ontimeout = function() {
                    reject(new Error('Network request timed out'));
                };
                
                // Handle abort
                xhr.onabort = function() {
                    reject(new Error('Network request aborted'));
                };
                
                // Send request
                xhr.send(options.body);
                
                // Implement abort method
                if (options.signal) {
                    options.signal.onabort = function() {
                        xhr.abort();
                    };
                }
            });
        },
        
        // Simple implementation of AbortController
        AbortController: function() {
            var listeners = [];
            var aborted = false;

            this.abort = function() {
                aborted = true;
                listeners.forEach(function(listener) {
                    listener.call(null, { type: 'abort' });
                });
            };

            this.signal = {
                get aborted() { return aborted; },
                onabort: null,
                addEventListener: function(type, listener) {
                    if (type === 'abort') {
                        listeners.push(listener);
                    }
                },
                removeEventListener: function(type, listener) {
                    if (type === 'abort') {
                        var index = listeners.indexOf(listener);
                        if (index !== -1) {
                            listeners.splice(index, 1);
                        }
                    }
                }
            };
        }
    };

    /**
     * Register a dependency
     * 
     * @param {String} name - Dependency name
     * @param {any} implementation - Dependency implementation
     * @param {Object} [options] - Options (version, priority)
     * @return {Boolean} - Success
     */
    function registerDependency(name, implementation, options) {
        options = options || {};
        
        if (!name) return false;
        
        dependencies[name] = {
            implementation: implementation,
            version: options.version || '1.0.0',
            priority: options.priority || 0,
            timestamp: Date.now()
        };
        
        return true;
    }

    /**
     * Get a registered dependency
     * 
     * @param {String} name - Dependency name
     * @param {Object} [options] - Options (fallback, required)
     * @return {any} - Dependency implementation or fallback
     */
    function getDependency(name, options) {
        options = options || {};
        
        // Check if dependency exists
        if (dependencies[name]) {
            return dependencies[name].implementation;
        }
        
        // Handle built-in fallbacks
        if (options.fallback !== false && fallbacks[name]) {
            return fallbacks[name];
        }
        
        // Handle custom fallback
        if (typeof options.fallback === 'function') {
            return options.fallback;
        }
        
        // Handle missing required dependency
        if (options.required) {
            throw new Error('Required dependency not found: ' + name);
        }
        
        // Return null for optional dependencies
        return null;
    }

    /**
     * Check if a feature is available
     * 
     * @param {String} name - Feature name
     * @return {Boolean} - Whether feature is available
     */
    function hasFeature(name) {
        return !!features[name];
    }

    /**
     * Register a feature detection result
     * 
     * @param {String} name - Feature name
     * @param {Boolean} available - Whether feature is available
     */
    function registerFeature(name, available) {
        features[name] = !!available;
    }

    /**
     * Detect features available in current environment
     * 
     * @return {Object} - Object with feature detection results
     */
    function detectFeatures() {
        // Update environment-specific features
        features.isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
        features.isBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
        features.isServiceWorker = typeof self !== 'undefined' && typeof self.registration !== 'undefined';
        
        // Update API features
        features.fetch = typeof fetch !== 'undefined';
        features.promise = typeof Promise !== 'undefined';
        features.abortController = typeof AbortController !== 'undefined';
        features.structuredClone = typeof structuredClone !== 'undefined';
        features.indexedDB = typeof indexedDB !== 'undefined';
        features.localStorage = typeof localStorage !== 'undefined';
        features.webWorkers = typeof Worker !== 'undefined';
        
        // Update advanced features
        features.streams = typeof ReadableStream !== 'undefined';
        features.requestIdleCallback = typeof requestIdleCallback !== 'undefined';
        features.intersectionObserver = typeof IntersectionObserver !== 'undefined';
        features.caches = typeof caches !== 'undefined';
        
        return features;
    }

    /**
     * Create an adapter that provides standardized dependency access
     * 
     * @param {Object} baseAdapter - Base adapter to extend
     * @param {Object} [options] - Options for adapter customization
     * @return {Object} - Enhanced adapter
     */
    function createEnhancedAdapter(baseAdapter, options) {
        options = options || {};
        var enhancedAdapter = Object.assign({}, baseAdapter);
        
        // Add dependency management methods
        enhancedAdapter.registerDependency = registerDependency;
        enhancedAdapter.getDependency = getDependency;
        enhancedAdapter.detectFeatures = detectFeatures;
        enhancedAdapter.hasFeature = hasFeature;
        enhancedAdapter.features = features;
        
        // Provide standardized defer implementation
        if (!enhancedAdapter.defer) {
            enhancedAdapter.defer = fallbacks.defer;
        }
        
        // Allow custom dependency injection
        if (options.dependencies) {
            Object.keys(options.dependencies).forEach(function(name) {
                registerDependency(name, options.dependencies[name]);
            });
        }
        
        return enhancedAdapter;
    }

    /**
     * Create a lazy-loaded dependency
     * 
     * @param {String} name - Dependency name
     * @param {Function} loader - Function that returns Promise resolving to dependency
     * @return {Object} - Object with methods to access the dependency
     */
    function createLazyDependency(name, loader) {
        var loaded = false;
        var dependency = null;
        var loadPromise = null;
        var waiters = [];
        
        return {
            /**
             * Get the dependency, loading it if necessary
             * 
             * @return {Promise} - Promise resolving to dependency
             */
            get: function() {
                if (loaded) {
                    return Promise.resolve(dependency);
                }
                
                if (loadPromise) {
                    return loadPromise;
                }
                
                loadPromise = new Promise(function(resolve, reject) {
                    loader()
                        .then(function(result) {
                            dependency = result;
                            loaded = true;
                            resolve(result);
                            
                            // Notify waiters
                            waiters.forEach(function(waiter) {
                                waiter.resolve(result);
                            });
                            waiters = [];
                        })
                        .catch(function(error) {
                            reject(error);
                            
                            // Notify waiters
                            waiters.forEach(function(waiter) {
                                waiter.reject(error);
                            });
                            waiters = [];
                            
                            // Reset load promise so we can try again
                            loadPromise = null;
                        });
                });
                
                return loadPromise;
            },
            
            /**
             * Check if dependency is loaded
             * 
             * @return {Boolean} - Whether dependency is loaded
             */
            isLoaded: function() {
                return loaded;
            },
            
            /**
             * Register a waiter function to be called when dependency is loaded
             * 
             * @param {Function} resolve - Function to call on success
             * @param {Function} reject - Function to call on failure
             */
            registerWaiter: function(resolve, reject) {
                if (loaded) {
                    resolve(dependency);
                    return;
                }
                
                waiters.push({ resolve: resolve, reject: reject });
            },
            
            /**
             * Force dependency to be reloaded
             * 
             * @return {Promise} - Promise resolving to reloaded dependency
             */
            reload: function() {
                loaded = false;
                loadPromise = null;
                return this.get();
            }
        };
    }

    // Register built-in dependencies
    registerDependency('defer', fallbacks.defer);
    if (!features.fetch) {
        registerDependency('fetch', fallbacks.fetch);
    }
    if (!features.abortController) {
        registerDependency('AbortController', fallbacks.AbortController);
    }

    // Export API
    module.exports = {
        register: registerDependency,
        get: getDependency,
        hasFeature: hasFeature,
        registerFeature: registerFeature,
        registerFeatures: function(name, featureObj) {
            Object.keys(featureObj).forEach(function(key) {
                registerFeature(name + '.' + key, featureObj[key]);
            });
        },
        detectFeatures: detectFeatures,
        getFeatures: function() { 
            return Object.assign({}, features); 
        },
        createEnhancedAdapter: createEnhancedAdapter,
        createLazyDependency: createLazyDependency
    };
})();
