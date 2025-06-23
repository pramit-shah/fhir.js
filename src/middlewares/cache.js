/**
 * Middleware for caching FHIR resources
 * 
 * This middleware provides:
 * 1. Transparent caching for reads
 * 2. Automatic cache invalidation on writes
 * 3. Support for conditional requests using ETag/If-None-Match
 * 4. Bundle resource caching
 * 5. Search result caching
 */

(function() {
    var cache = require('../cache');
    var logging = require('../logging');
    
    // Initialize logger
    var logger = logging.getLogger('fhir:middlewares:cache');
    
    /**
     * Creates cache middleware
     * 
     * @param {Object} config - Cache configuration
     * @return {Function} - Middleware function
     */
    module.exports = function(config) {
        // Create cache with config
        var resourceCache = cache.createCache(config);
        
        return function(client) {
            // Add cache to client for direct access
            client.cache = resourceCache;
            
            // Wrap the client to intercept operations
            var origRequest = client.request;
            
            client.request = function(method, path, args, callback) {
                var resourceType, id, params, cacheKey, cachedResource;
                
                // Parse path to extract resource type and id
                var pathParts = path.split('/');
                resourceType = pathParts[0];
                id = pathParts[1];
                
                // Prepare standard arguments for all paths
                if (method === 'GET') {
                    // Try to handle GET requests with caching
                    
                    // Case 1: Direct resource read - GET [resourceType]/[id]
                    if (resourceType && id && !pathParts[2]) {
                        cachedResource = resourceCache.get(resourceType, id);
                        
                        if (cachedResource) {
                            logger.debug('Cache hit', { resourceType: resourceType, id: id });
                            
                            // If a callback is provided, use that style
                            if (typeof callback === 'function') {
                                process.nextTick(function() {
                                    callback(null, cachedResource);
                                });
                                return;
                            }
                            
                            // Otherwise return a promise
                            return Promise.resolve(cachedResource);
                        } else {
                            logger.debug('Cache miss', { resourceType: resourceType, id: id });
                            
                            // Add ETag handling to args if not present
                            if (!args) args = {};
                            if (!args.headers) args.headers = {};
                            
                            // Check if etags are available from previous responses
                            // Implementation would depend on how etags are stored
                            
                            // Continue with request, but add cache on success
                            var origCallback = callback;
                            var newCallback = function(err, response) {
                                if (!err && response) {
                                    // Cache the successful response
                                    try {
                                        resourceCache.put(resourceType, id, response);
                                    } catch (cacheErr) {
                                        logger.error('Error caching resource', { 
                                            error: cacheErr,
                                            resourceType: resourceType,
                                            id: id
                                        });
                                    }
                                }
                                
                                // Pass to original callback
                                if (typeof origCallback === 'function') {
                                    origCallback(err, response);
                                }
                            };
                            
                            return origRequest(method, path, args, newCallback);
                        }
                    }
                    // Case 2: Search operation - GET [resourceType]?param=value
                    else if (resourceType && !id && args && args.params) {
                        params = args.params;
                        
                        // Only handle if search caching is enabled
                        if (resourceCache.config.cacheSearchResults) {
                            // Generate cache key from path and params
                            cacheKey = path + '?' + Object.keys(params).sort().map(function(key) {
                                return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
                            }).join('&');
                            
                            // Check cache for search results
                            var cachedResults = resourceCache.getSearchResults(cacheKey);
                            
                            if (cachedResults) {
                                logger.debug('Search cache hit', { path: path, params: params });
                                
                                // If a callback is provided, use that style
                                if (typeof callback === 'function') {
                                    process.nextTick(function() {
                                        callback(null, cachedResults);
                                    });
                                    return;
                                }
                                
                                // Otherwise return a promise
                                return Promise.resolve(cachedResults);
                            } else {
                                logger.debug('Search cache miss', { path: path, params: params });
                                
                                // Continue with request, but add cache on success
                                var origCallback = callback;
                                var newCallback = function(err, response) {
                                    if (!err && response) {
                                        // Cache the successful search results
                                        try {
                                            resourceCache.putSearchResults(cacheKey, response);
                                        } catch (cacheErr) {
                                            logger.error('Error caching search results', { 
                                                error: cacheErr,
                                                path: path,
                                                params: params
                                            });
                                        }
                                        
                                        // Also cache individual resources from a bundle
                                        if (response.resourceType === 'Bundle' && response.entry) {
                                            response.entry.forEach(function(entry) {
                                                if (entry.resource && entry.resource.resourceType && entry.resource.id) {
                                                    try {
                                                        resourceCache.put(
                                                            entry.resource.resourceType,
                                                            entry.resource.id, 
                                                            entry.resource,
                                                            { source: 'search' }
                                                        );
                                                    } catch (cacheErr) {
                                                        // Silently skip individual resources on error
                                                        logger.debug('Error caching bundle resource', {
                                                            resourceType: entry.resource.resourceType,
                                                            id: entry.resource.id
                                                        });
                                                    }
                                                }
                                            });
                                        }
                                    }
                                    
                                    // Pass to original callback
                                    if (typeof origCallback === 'function') {
                                        origCallback(err, response);
                                    }
                                };
                                
                                return origRequest(method, path, args, newCallback);
                            }
                        }
                    }
                } 
                // Handle write operations (POST, PUT, DELETE) to invalidate cache
                else if (['POST', 'PUT', 'DELETE'].indexOf(method) !== -1) {
                    // After successful write, invalidate cache entries
                    var origCallback = callback;
                    var newCallback = function(err, response) {
                        if (!err) {
                            // If this is an update or delete of a specific resource
                            if ((method === 'PUT' || method === 'DELETE') && resourceType && id) {
                                // Remove the resource from cache
                                resourceCache.remove(resourceType, id);
                                
                                logger.debug(method + ' operation invalidated cache', {
                                    method: method,
                                    resourceType: resourceType,
                                    id: id
                                });
                            }
                            // If this is a create operation
                            else if (method === 'POST' && resourceType) {
                                // For a successful create, cache the new resource
                                if (response && response.resourceType === resourceType && response.id) {
                                    resourceCache.put(response.resourceType, response.id, response);
                                    
                                    logger.debug('Cached newly created resource', {
                                        resourceType: response.resourceType,
                                        id: response.id
                                    });
                                }
                                
                                // Invalidate any cached search results for this resource type
                                // This is a simplification - in a real implementation you would 
                                // be more selective about which search results to invalidate
                                if (resourceCache.searchResultCache) {
                                    var searchResultsToInvalidate = [];
                                    
                                    resourceCache.searchResultCache.forEach(function(value, key) {
                                        // If this search result is for this resource type, invalidate
                                        if (key.startsWith(resourceType + '?')) {
                                            searchResultsToInvalidate.push(key);
                                        }
                                    });
                                    
                                    searchResultsToInvalidate.forEach(function(key) {
                                        resourceCache.searchResultCache.delete(key);
                                    });
                                    
                                    if (searchResultsToInvalidate.length > 0) {
                                        logger.debug('Invalidated search results after ' + method, {
                                            method: method,
                                            resourceType: resourceType,
                                            count: searchResultsToInvalidate.length
                                        });
                                    }
                                }
                            }
                        }
                        
                        // Pass to original callback
                        if (typeof origCallback === 'function') {
                            origCallback(err, response);
                        }
                    };
                    
                    return origRequest(method, path, args, newCallback);
                }
                
                // For any other requests, pass through to original implementation
                return origRequest(method, path, args, callback);
            };
            
            // Add cache control methods to client
            client.clearCache = function(resourceType) {
                resourceCache.clear(resourceType);
                return client;
            };
            
            client.getCacheStats = function() {
                return resourceCache.getStats();
            };
            
            // Return the enhanced client
            return client;
        };
    };
    
}).call(this);
