/**
 * Advanced caching support for FHIR.js
 * 
 * This module provides sophisticated caching capabilities:
 * 1. LRU caching of resources with configurable TTL
 * 2. Automatic resource versioning detection
 * 3. Smart cache invalidation for related resources
 * 4. Disk persistence options for offline support
 * 5. Memory usage monitoring and management
 */

(function() {
    var utils = require('./utils');
    var logging = require('./logging');
    
    // Initialize logger
    var logger = logging.getLogger('fhir:cache');
    
    /**
     * Cache configuration defaults
     * @private
     */
    var defaultConfig = {
        enabled: true,                  // Enable caching by default
        maxSize: 100,                   // Maximum number of resources to cache
        ttl: 5 * 60 * 1000,            // Default TTL: 5 minutes
        resourceTypes: null,            // Cache all resource types by default
        excludeResourceTypes: ['AuditEvent'], // Don't cache these resource types
        persistToStorage: false,        // Don't persist to localStorage/indexedDB by default
        storageKey: 'fhir.js.cache',    // Key used for localStorage/indexedDB
        smartInvalidation: true,        // Invalidate related resources on update/delete
        cacheBundles: true,             // Cache bundled resources individually
        prerenderReferences: false,     // Pre-resolve common references for UI performance
        cacheSearchResults: true,       // Cache search results
        searchResultsTtl: 60 * 1000,    // Search results TTL: 1 minute
        memoryThreshold: 0.9            // Purge when memory usage exceeds 90% of max
    };
    
    /**
     * Cache value entry structure
     * @private
     */
    function CacheEntry(resourceType, id, resource, options) {
        this.resourceType = resourceType;
        this.id = id;
        this.resource = resource;
        this.timestamp = Date.now();
        this.expires = options.ttl ? this.timestamp + options.ttl : null;
        this.versionId = resource && resource.meta && resource.meta.versionId;
        this.lastModified = resource && resource.meta && resource.meta.lastUpdated;
        this.etag = options.etag || null;
        this.accessCount = 0;
        this.source = options.source || 'api'; // api, bundle, prefetch
    }
    
    /**
     * LRU Cache implementation with expiration
     */
    function FhirResourceCache(config) {
        this.config = utils.merge({}, defaultConfig, config || {});
        this.cache = new Map();
        this.keyTimeIndex = []; // For LRU tracking
        this.searchResultCache = this.config.cacheSearchResults ? new Map() : null;
        
        // Initialize storage if enabled
        if (this.config.persistToStorage) {
            this._initStorage();
            this._loadFromStorage();
        }
    }
    
    /**
     * Initialize storage for persistence
     * @private
     */
    FhirResourceCache.prototype._initStorage = function() {
        var storageAvailable = false;
        
        // Try localStorage first
        try {
            localStorage.setItem('fhir.test', 'test');
            localStorage.removeItem('fhir.test');
            this.storage = {
                type: 'localStorage',
                get: function(key) {
                    var data = localStorage.getItem(key);
                    return data ? JSON.parse(data) : null;
                },
                set: function(key, value) {
                    localStorage.setItem(key, JSON.stringify(value));
                }
            };
            storageAvailable = true;
        } catch (e) {
            logger.warn('localStorage not available for cache persistence', e);
        }
        
        // Try indexedDB if localStorage failed
        if (!storageAvailable && typeof indexedDB !== 'undefined') {
            // IndexedDB implementation would go here
            // For simplicity, we're not implementing the full IndexedDB logic
        }
        
        if (!storageAvailable) {
            logger.warn('No storage mechanism available for cache persistence');
            this.config.persistToStorage = false;
        }
    };
    
    /**
     * Load cached resources from persistent storage
     * @private
     */
    FhirResourceCache.prototype._loadFromStorage = function() {
        if (!this.storage) return;
        
        try {
            var data = this.storage.get(this.config.storageKey);
            if (data && data.entries) {
                logger.info('Loading cached resources from storage', { count: data.entries.length });
                
                // Filter out expired entries
                var now = Date.now();
                var validEntries = data.entries.filter(function(entry) {
                    return !entry.expires || entry.expires > now;
                });
                
                validEntries.forEach(function(entry) {
                    var cacheKey = this._getCacheKey(entry.resourceType, entry.id);
                    this.cache.set(cacheKey, entry);
                    this.keyTimeIndex.push(cacheKey);
                }, this);
                
                // Load search results if available
                if (this.searchResultCache && data.searchResults) {
                    Object.keys(data.searchResults).forEach(function(key) {
                        var searchData = data.searchResults[key];
                        if (!searchData.expires || searchData.expires > now) {
                            this.searchResultCache.set(key, searchData);
                        }
                    }, this);
                }
            }
        } catch (e) {
            logger.error('Error loading cache from storage', e);
        }
    };
    
    /**
     * Save cache to persistent storage
     * @private
     */
    FhirResourceCache.prototype._saveToStorage = function() {
        if (!this.storage || !this.config.persistToStorage) return;
        
        try {
            var entries = [];
            this.cache.forEach(function(entry) {
                entries.push(entry);
            });
            
            var searchResults = {};
            if (this.searchResultCache) {
                this.searchResultCache.forEach(function(value, key) {
                    searchResults[key] = value;
                });
            }
            
            var data = {
                timestamp: Date.now(),
                entries: entries,
                searchResults: searchResults
            };
            
            this.storage.set(this.config.storageKey, data);
            logger.debug('Cache saved to persistent storage', {
                entries: entries.length,
                searchResults: Object.keys(searchResults).length
            });
        } catch (e) {
            logger.error('Error saving cache to storage', e);
        }
    };
    
    /**
     * Generate a consistent cache key
     * @private
     */
    FhirResourceCache.prototype._getCacheKey = function(resourceType, id) {
        return resourceType + '/' + id;
    };
    
    /**
     * Check if a resource type should be cached
     * @private
     */
    FhirResourceCache.prototype._shouldCacheResourceType = function(resourceType) {
        if (!this.config.enabled) return false;
        
        // Check exclusion list
        if (this.config.excludeResourceTypes && 
            this.config.excludeResourceTypes.indexOf(resourceType) !== -1) {
            return false;
        }
        
        // If specific resource types are defined, check inclusion
        if (this.config.resourceTypes && this.config.resourceTypes.length > 0) {
            return this.config.resourceTypes.indexOf(resourceType) !== -1;
        }
        
        // Default to true if no specific restrictions
        return true;
    };
    
    /**
     * Maintain cache size within limits using LRU policy
     * @private
     */
    FhirResourceCache.prototype._enforceMemoryLimits = function() {
        // If we're under the limit, no need to evict
        if (this.cache.size <= this.config.maxSize) return;
        
        logger.debug('Cache size exceeded, evicting resources', {
            current: this.cache.size,
            limit: this.config.maxSize
        });
        
        // Calculate how many items to remove
        var overflow = this.cache.size - Math.floor(this.config.maxSize * this.config.memoryThreshold);
        
        // Remove oldest entries first (from front of keyTimeIndex array)
        for (var i = 0; i < overflow; i++) {
            if (this.keyTimeIndex.length === 0) break;
            
            var oldestKey = this.keyTimeIndex.shift();
            var removed = this.cache.get(oldestKey);
            
            if (removed) {
                logger.debug('Evicting cached resource', {
                    resourceType: removed.resourceType,
                    id: removed.id,
                    age: Date.now() - removed.timestamp
                });
                this.cache.delete(oldestKey);
            }
        }
    };
    
    /**
     * Update access time for a cache entry (moves to end of LRU list)
     * @private
     */
    FhirResourceCache.prototype._updateAccessTime = function(cacheKey) {
        // Remove from current position
        var index = this.keyTimeIndex.indexOf(cacheKey);
        if (index !== -1) {
            this.keyTimeIndex.splice(index, 1);
        }
        
        // Add to end (most recently used)
        this.keyTimeIndex.push(cacheKey);
        
        // Increment access count
        var entry = this.cache.get(cacheKey);
        if (entry) {
            entry.accessCount++;
            entry.lastAccessed = Date.now();
        }
    };
    
    /**
     * Find related resource keys that should be invalidated
     * @private
     */
    FhirResourceCache.prototype._findRelatedResources = function(resourceType, id, resource) {
        if (!this.config.smartInvalidation) return [];
        
        var relatedKeys = [];
        
        // Different logic based on resource type
        switch (resourceType) {
            case 'Patient':
                // If a patient changes, invalidate all resources referencing this patient
                this.cache.forEach(function(entry, key) {
                    var res = entry.resource;
                    if (!res) return;
                    
                    // Check for patient reference
                    if (res.subject && res.subject.reference === 'Patient/' + id) {
                        relatedKeys.push(key);
                    }
                    if (res.patient && res.patient.reference === 'Patient/' + id) {
                        relatedKeys.push(key);
                    }
                });
                break;
                
            case 'Encounter':
                // If an encounter changes, invalidate associated resources
                this.cache.forEach(function(entry, key) {
                    var res = entry.resource;
                    if (!res) return;
                    
                    // Check for encounter reference
                    if (res.encounter && res.encounter.reference === 'Encounter/' + id) {
                        relatedKeys.push(key);
                    }
                    if (res.context && res.context.reference === 'Encounter/' + id) {
                        relatedKeys.push(key);
                    }
                });
                break;
        }
        
        return relatedKeys;
    };
    
    /**
     * Add a resource to the cache
     * 
     * @param {String} resourceType - FHIR resource type
     * @param {String} id - Resource ID
     * @param {Object} resource - Resource object
     * @param {Object} options - Cache options
     * @return {Boolean} - Success status
     */
    FhirResourceCache.prototype.put = function(resourceType, id, resource, options) {
        if (!this.config.enabled || !resourceType || !id || !resource) return false;
        
        // Check if resource type should be cached
        if (!this._shouldCacheResourceType(resourceType)) {
            return false;
        }
        
        options = options || {};
        var cacheKey = this._getCacheKey(resourceType, id);
        
        // Create cache entry
        var entry = new CacheEntry(resourceType, id, resource, {
            ttl: options.ttl || this.config.ttl,
            etag: options.etag,
            source: options.source
        });
        
        // Check for existing entry and compare versions
        var existing = this.cache.get(cacheKey);
        if (existing && existing.versionId && entry.versionId) {
            // If new version is not newer, don't update the cache
            if (existing.versionId === entry.versionId) {
                this._updateAccessTime(cacheKey);
                return true;
            }
        }
        
        // Add to cache
        this.cache.set(cacheKey, entry);
        this._updateAccessTime(cacheKey);
        
        // Find and invalidate related resources if smart invalidation is enabled
        if (this.config.smartInvalidation) {
            var relatedKeys = this._findRelatedResources(resourceType, id, resource);
            if (relatedKeys.length > 0) {
                logger.debug('Invalidating related resources', {
                    resourceType: resourceType,
                    id: id,
                    relatedCount: relatedKeys.length
                });
                
                relatedKeys.forEach(function(key) {
                    this.cache.delete(key);
                    
                    // Remove from keyTimeIndex as well
                    var index = this.keyTimeIndex.indexOf(key);
                    if (index !== -1) {
                        this.keyTimeIndex.splice(index, 1);
                    }
                }, this);
            }
        }
        
        // Process bundle resources if enabled
        if (this.config.cacheBundles && resourceType === 'Bundle' && resource.entry) {
            this._processBundleEntries(resource.entry, options);
        }
        
        // Pre-render references if enabled
        if (this.config.prerenderReferences) {
            this._prerenderReferences(resource);
        }
        
        // Enforce memory limits
        this._enforceMemoryLimits();
        
        // Persist to storage if enabled
        if (this.config.persistToStorage) {
            // Debounce storage writes to avoid performance issues
            clearTimeout(this._saveTimeout);
            this._saveTimeout = setTimeout(this._saveToStorage.bind(this), 1000);
        }
        
        return true;
    };
    
    /**
     * Process and cache individual resources from a bundle
     * @private
     */
    FhirResourceCache.prototype._processBundleEntries = function(entries, options) {
        if (!entries || !entries.length) return;
        
        entries.forEach(function(entry) {
            var resource = entry.resource || entry.content;
            if (!resource || !resource.resourceType || !resource.id) return;
            
            // Cache with bundle source marker
            this.put(resource.resourceType, resource.id, resource, {
                ttl: options.ttl,
                source: 'bundle'
            });
        }, this);
    };
    
    /**
     * Pre-render common references for improved performance
     * @private
     */
    FhirResourceCache.prototype._prerenderReferences = function(resource) {
        // This would pre-resolve common references for UI performance
        // Implementation would depend on specific UI rendering needs
    };
    
    /**
     * Get a resource from the cache
     * 
     * @param {String} resourceType - FHIR resource type
     * @param {String} id - Resource ID
     * @return {Object|null} - Cached resource or null if not found/expired
     */
    FhirResourceCache.prototype.get = function(resourceType, id) {
        if (!this.config.enabled || !resourceType || !id) return null;
        
        var cacheKey = this._getCacheKey(resourceType, id);
        var entry = this.cache.get(cacheKey);
        
        if (!entry) return null;
        
        // Check if expired
        if (entry.expires && Date.now() > entry.expires) {
            logger.debug('Cache entry expired', {
                resourceType: resourceType,
                id: id,
                age: Date.now() - entry.timestamp
            });
            
            this.cache.delete(cacheKey);
            
            // Remove from keyTimeIndex as well
            var index = this.keyTimeIndex.indexOf(cacheKey);
            if (index !== -1) {
                this.keyTimeIndex.splice(index, 1);
            }
            
            return null;
        }
        
        // Update access time
        this._updateAccessTime(cacheKey);
        
        return entry.resource;
    };
    
    /**
     * Delete a resource from the cache
     * 
     * @param {String} resourceType - FHIR resource type
     * @param {String} id - Resource ID
     * @return {Boolean} - Whether a resource was removed
     */
    FhirResourceCache.prototype.remove = function(resourceType, id) {
        if (!this.config.enabled || !resourceType || !id) return false;
        
        var cacheKey = this._getCacheKey(resourceType, id);
        var removed = this.cache.delete(cacheKey);
        
        if (removed) {
            // Remove from keyTimeIndex as well
            var index = this.keyTimeIndex.indexOf(cacheKey);
            if (index !== -1) {
                this.keyTimeIndex.splice(index, 1);
            }
            
            // Find and invalidate related resources
            if (this.config.smartInvalidation) {
                var relatedKeys = this._findRelatedResources(resourceType, id);
                relatedKeys.forEach(function(key) {
                    this.cache.delete(key);
                    
                    // Remove from keyTimeIndex as well
                    var keyIndex = this.keyTimeIndex.indexOf(key);
                    if (keyIndex !== -1) {
                        this.keyTimeIndex.splice(keyIndex, 1);
                    }
                }, this);
            }
            
            // Persist changes if enabled
            if (this.config.persistToStorage) {
                clearTimeout(this._saveTimeout);
                this._saveTimeout = setTimeout(this._saveToStorage.bind(this), 1000);
            }
        }
        
        return removed;
    };
    
    /**
     * Clear the entire cache or specific resource types
     * 
     * @param {String|Array} resourceTypes - Optional resource type(s) to clear
     */
    FhirResourceCache.prototype.clear = function(resourceTypes) {
        if (!this.config.enabled) return;
        
        if (!resourceTypes) {
            // Clear all
            this.cache.clear();
            this.keyTimeIndex = [];
            
            if (this.searchResultCache) {
                this.searchResultCache.clear();
            }
            
            logger.info('Cache cleared completely');
        } else {
            // Clear specific resource types
            var typesToClear = Array.isArray(resourceTypes) ? resourceTypes : [resourceTypes];
            
            var keysToRemove = [];
            this.cache.forEach(function(entry, key) {
                if (typesToClear.indexOf(entry.resourceType) !== -1) {
                    keysToRemove.push(key);
                }
            });
            
            keysToRemove.forEach(function(key) {
                this.cache.delete(key);
                
                // Remove from keyTimeIndex as well
                var index = this.keyTimeIndex.indexOf(key);
                if (index !== -1) {
                    this.keyTimeIndex.splice(index, 1);
                }
            }, this);
            
            logger.info('Cache cleared for specific resource types', {
                types: typesToClear,
                count: keysToRemove.length
            });
        }
        
        // Persist changes if enabled
        if (this.config.persistToStorage) {
            this._saveToStorage();
        }
    };
    
    /**
     * Cache search results
     * 
     * @param {String} url - Search URL
     * @param {Object} results - Search results (typically a Bundle)
     * @param {Object} options - Cache options
     */
    FhirResourceCache.prototype.putSearchResults = function(url, results, options) {
        if (!this.config.enabled || !this.config.cacheSearchResults || !url || !results) {
            return false;
        }
        
        options = options || {};
        
        // Cache the bundle itself
        if (results.resourceType === 'Bundle' && results.id) {
            this.put('Bundle', results.id, results, options);
        }
        
        // Cache the search results separately
        if (this.searchResultCache) {
            var now = Date.now();
            var ttl = options.searchResultsTtl || this.config.searchResultsTtl;
            
            this.searchResultCache.set(url, {
                timestamp: now,
                expires: ttl ? now + ttl : null,
                results: results
            });
            
            // Process bundle entries individually if enabled
            if (this.config.cacheBundles && results.entry) {
                this._processBundleEntries(results.entry, options);
            }
        }
        
        return true;
    };
    
    /**
     * Get cached search results
     * 
     * @param {String} url - Search URL
     * @return {Object|null} - Cached search results or null if not found/expired
     */
    FhirResourceCache.prototype.getSearchResults = function(url) {
        if (!this.config.enabled || !this.config.cacheSearchResults || !this.searchResultCache || !url) {
            return null;
        }
        
        var entry = this.searchResultCache.get(url);
        if (!entry) return null;
        
        // Check if expired
        if (entry.expires && Date.now() > entry.expires) {
            this.searchResultCache.delete(url);
            return null;
        }
        
        return entry.results;
    };
    
    /**
     * Get statistics about the cache
     * 
     * @return {Object} - Cache statistics
     */
    FhirResourceCache.prototype.getStats = function() {
        var resourceTypeCounts = {};
        var totalSize = 0;
        var oldestTimestamp = Date.now();
        var newestTimestamp = 0;
        
        this.cache.forEach(function(entry) {
            // Count by resource type
            resourceTypeCounts[entry.resourceType] = (resourceTypeCounts[entry.resourceType] || 0) + 1;
            
            // Track size (approximate)
            var resourceSize = 0;
            try {
                resourceSize = JSON.stringify(entry.resource).length;
            } catch (e) {
                resourceSize = 1024; // Fallback size
            }
            totalSize += resourceSize;
            
            // Track timestamps
            if (entry.timestamp < oldestTimestamp) oldestTimestamp = entry.timestamp;
            if (entry.timestamp > newestTimestamp) newestTimestamp = entry.timestamp;
        });
        
        var searchResultsCount = this.searchResultCache ? this.searchResultCache.size : 0;
        
        return {
            enabled: this.config.enabled,
            totalEntries: this.cache.size,
            byResourceType: resourceTypeCounts,
            memoryUsageBytes: totalSize,
            memoryUsageMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
            oldestEntryAge: oldestTimestamp < Date.now() ? Date.now() - oldestTimestamp : 0,
            newestEntryAge: newestTimestamp > 0 ? Date.now() - newestTimestamp : 0,
            searchResultsCount: searchResultsCount,
            persistenceEnabled: this.config.persistToStorage && !!this.storage,
            persistenceType: this.storage ? this.storage.type : null
        };
    };
    
    // Export the cache module
    module.exports = {
        FhirResourceCache: FhirResourceCache,
        createCache: function(config) {
            return new FhirResourceCache(config);
        }
    };
    
}).call(this);
