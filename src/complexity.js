/**
 * Complexity management system for FHIR.js
 * 
 * This module provides tools to handle complex FHIR interaction patterns:
 * 1. Resource dependency resolution and topological operations
 * 2. Batch and transaction management with dependency awareness
 * 3. Complex search parameter builders for multi-resource queries
 * 4. Pagination and result set management
 * 5. Resource validation against FHIR profiles
 */

(function() {
    var utils = require('./utils');
    var logging = require('./logging');
    
    // Initialize logger
    var logger = logging.getLogger('complexity');
    
    /**
     * Resource dependency graph for managing complex resource relationships
     * @private
     */
    var dependencyGraph = {
        nodes: {},
        edges: {}
    };
    
    /**
     * FHIR resource type definitions with cardinality and relationship information
     * @private
     */
    var resourceDefinitions = {};
    
    /**
     * Complexity level settings
     */
    var ComplexityLevel = {
        SIMPLE: 'simple',      // Basic CRUD operations
        STANDARD: 'standard',  // Standard FHIR operations
        ADVANCED: 'advanced',  // Advanced features like batch processing
        FULL: 'full'           // All features including resource graphs
    };
    
    // Current complexity level
    var currentComplexityLevel = ComplexityLevel.STANDARD;
    
    /**
     * Set the complexity level
     * 
     * @param {String} level - The complexity level to set
     */
    function setComplexityLevel(level) {
        if (Object.values(ComplexityLevel).indexOf(level) === -1) {
            throw new Error('Invalid complexity level: ' + level);
        }
        
        currentComplexityLevel = level;
        logger.info('Complexity level set', { level: level });
    }
    
    /**
     * Get the current complexity level
     * 
     * @return {String} - The current complexity level
     */
    function getComplexityLevel() {
        return currentComplexityLevel;
    }
    
    /**
     * Check if a feature is available at the current complexity level
     * 
     * @param {String} feature - Feature name
     * @param {String} requiredLevel - Minimum required level
     * @return {Boolean} - Whether the feature is available
     */
    function isFeatureAvailable(feature, requiredLevel) {
        var levels = Object.values(ComplexityLevel);
        var currentIdx = levels.indexOf(currentComplexityLevel);
        var requiredIdx = levels.indexOf(requiredLevel);
        
        return currentIdx >= requiredIdx;
    }
    
    /**
     * Add a resource definition for complex operations
     * 
     * @param {String} resourceType - The FHIR resource type
     * @param {Object} definition - Resource definition with relationship info
     */
    function addResourceDefinition(resourceType, definition) {
        resourceDefinitions[resourceType] = definition;
    }
    
    /**
     * Register a dependency between resources
     * 
     * @param {String} dependentType - The dependent resource type
     * @param {String} targetType - The target resource type
     * @param {String} searchParam - The search parameter that establishes the relationship
     */
    function registerDependency(dependentType, targetType, searchParam) {
        // Ensure nodes exist
        dependencyGraph.nodes[dependentType] = dependencyGraph.nodes[dependentType] || {
            type: dependentType,
            dependencies: []
        };
        
        dependencyGraph.nodes[targetType] = dependencyGraph.nodes[targetType] || {
            type: targetType,
            dependencies: []
        };
        
        // Add edge
        if (!dependencyGraph.edges[dependentType]) {
            dependencyGraph.edges[dependentType] = {};
        }
        
        dependencyGraph.edges[dependentType][targetType] = dependencyGraph.edges[dependentType][targetType] || [];
        dependencyGraph.edges[dependentType][targetType].push(searchParam);
        
        // Add to dependencies list
        if (dependencyGraph.nodes[dependentType].dependencies.indexOf(targetType) === -1) {
            dependencyGraph.nodes[dependentType].dependencies.push(targetType);
        }
        
        logger.debug('Dependency registered', { 
            from: dependentType, 
            to: targetType, 
            param: searchParam 
        });
    }
    
    /**
     * Get the topological order for creating/updating a set of resources
     * 
     * @param {Array<String>} resourceTypes - Array of resource types to order
     * @return {Array<String>} - Ordered array of resource types
     */
    function getTopologicalOrder(resourceTypes) {
        // Ensure this is a SET complexity operation
        if (!isFeatureAvailable('topologicalSort', ComplexityLevel.ADVANCED)) {
            throw new Error('Topological sorting requires ADVANCED complexity level');
        }
        
        var visited = {};
        var temp = {};
        var result = [];
        
        function visit(node) {
            if (temp[node]) {
                // Cyclic dependency detected
                throw new Error('Cyclic dependency detected in resource graph');
            }
            
            if (!visited[node]) {
                temp[node] = true;
                
                // Visit dependencies first
                var deps = (dependencyGraph.nodes[node] || {}).dependencies || [];
                deps.forEach(function(dep) {
                    if (resourceTypes.indexOf(dep) !== -1) {
                        visit(dep);
                    }
                });
                
                temp[node] = false;
                visited[node] = true;
                result.unshift(node);
            }
        }
        
        resourceTypes.forEach(function(type) {
            if (!visited[type]) {
                visit(type);
            }
        });
        
        return result;
    }
    
    /**
     * Create a bundle with resources ordered by their dependencies
     * 
     * @param {Array<Object>} resources - Array of FHIR resources
     * @param {String} type - Bundle type (transaction, batch, etc)
     * @return {Object} - FHIR Bundle resource
     */
    function createOrderedBundle(resources, type) {
        // Ensure this is a SET complexity operation
        if (!isFeatureAvailable('orderedBundle', ComplexityLevel.ADVANCED)) {
            throw new Error('Ordered bundle operations require ADVANCED complexity level');
        }
        
        // Get all resource types
        var resourceTypes = resources.map(function(r) {
            return r.resourceType;
        });
        
        // Get unique resource types
        resourceTypes = resourceTypes.filter(function(value, index, self) {
            return self.indexOf(value) === index;
        });
        
        // Get the correct order
        var orderedTypes = getTopologicalOrder(resourceTypes);
        
        // Create a map of resources by type
        var resourceMap = {};
        resources.forEach(function(resource) {
            if (!resourceMap[resource.resourceType]) {
                resourceMap[resource.resourceType] = [];
            }
            resourceMap[resource.resourceType].push(resource);
        });
        
        // Create the bundle entries in the correct order
        var entries = [];
        orderedTypes.forEach(function(type) {
            if (resourceMap[type]) {
                resourceMap[type].forEach(function(resource) {
                    entries.push({
                        resource: resource,
                        request: {
                            method: resource.id ? 'PUT' : 'POST',
                            url: resource.resourceType + (resource.id ? '/' + resource.id : '')
                        }
                    });
                });
            }
        });
        
        // Return the bundle
        return {
            resourceType: 'Bundle',
            type: type || 'transaction',
            entry: entries
        };
    }
    
    /**
     * Build a complex search query with multiple includes and reverse includes
     * 
     * @param {Object} params - Search parameters
     * @return {Object} - Search parameters with includes
     */
    function buildComplexQuery(params) {
        if (!isFeatureAvailable('complexQuery', ComplexityLevel.STANDARD)) {
            logger.warn('Complex query building used with insufficient complexity level', {
                current: currentComplexityLevel,
                required: ComplexityLevel.STANDARD
            });
        }
        
        var result = utils.clone(params);
        
        // Process includes
        if (params.include) {
            result._include = Array.isArray(params.include) 
                ? params.include 
                : [params.include];
            
            delete result.include;
        }
        
        // Process reverse includes
        if (params.revInclude) {
            result._revinclude = Array.isArray(params.revInclude) 
                ? params.revInclude 
                : [params.revInclude];
            
            delete result.revInclude;
        }
        
        // Process recursive includes (only available in ADVANCED mode)
        if (params.recurseInclude && isFeatureAvailable('recursiveInclude', ComplexityLevel.ADVANCED)) {
            result._include = result._include || [];
            params.recurseInclude.forEach(function(inc) {
                result._include.push(inc + ':iterate');
            });
            
            delete result.recurseInclude;
        }
        
        // Process recursive reverse includes (only available in ADVANCED mode)
        if (params.recurseRevInclude && isFeatureAvailable('recursiveRevInclude', ComplexityLevel.ADVANCED)) {
            result._revinclude = result._revinclude || [];
            params.recurseRevInclude.forEach(function(inc) {
                result._revinclude.push(inc + ':iterate');
            });
            
            delete result.recurseRevInclude;
        }
        
        // Process _has parameters for filtering by referenced resource
        if (params.has) {
            Object.keys(params.has).forEach(function(hasKey) {
                var parts = hasKey.split('.');
                if (parts.length === 2) {
                    var resourceType = parts[0];
                    var reference = parts[1];
                    var criteria = params.has[hasKey];
                    
                    result['_has:' + resourceType + ':' + reference + ':' + Object.keys(criteria)[0]] = 
                        criteria[Object.keys(criteria)[0]];
                }
            });
            
            delete result.has;
        }
        
        return result;
    }
    
    /**
     * Create a batch processor with proper dependency handling
     * 
     * @param {Function} client - FHIR client function
     * @param {Object} options - Batch options
     * @return {Function} - Batch processor function
     */
    function createBatchProcessor(client, options) {
        if (!isFeatureAvailable('batchProcessor', ComplexityLevel.ADVANCED)) {
            throw new Error('Batch processing requires ADVANCED complexity level');
        }
        
        options = options || {};
        var concurrency = options.concurrency || 5;
        var delayBetweenRequests = options.delay || 0;
        
        /**
         * Process a batch of requests with proper dependency handling
         * 
         * @param {Array<Object>} requests - Array of request objects
         * @return {Promise<Array>} - Promise resolving to array of results
         */
        return function processBatch(requests) {
            // If resources with possible dependencies, determine proper order
            if (options.respectDependencies) {
                var resourceTypes = requests.map(function(req) {
                    return req.type || (req.resource && req.resource.resourceType);
                }).filter(Boolean);
                
                // Get unique resource types
                resourceTypes = resourceTypes.filter(function(value, index, self) {
                    return self.indexOf(value) === index;
                });
                
                // Try to get proper order
                try {
                    var orderedTypes = getTopologicalOrder(resourceTypes);
                    
                    // Reorder requests based on resource type order
                    var requestsByType = {};
                    requests.forEach(function(req) {
                        var type = req.type || (req.resource && req.resource.resourceType);
                        if (!type) return;
                        
                        if (!requestsByType[type]) {
                            requestsByType[type] = [];
                        }
                        requestsByType[type].push(req);
                    });
                    
                    var orderedRequests = [];
                    orderedTypes.forEach(function(type) {
                        if (requestsByType[type]) {
                            orderedRequests = orderedRequests.concat(requestsByType[type]);
                        }
                    });
                    
                    // Add any requests without a resource type at the end
                    requests.forEach(function(req) {
                        var type = req.type || (req.resource && req.resource.resourceType);
                        if (!type) {
                            orderedRequests.push(req);
                        }
                    });
                    
                    requests = orderedRequests;
                    
                    logger.debug('Requests reordered by dependencies', { 
                        order: orderedTypes 
                    });
                } catch (e) {
                    logger.error('Failed to reorder requests by dependencies', { 
                        error: e.message 
                    });
                }
            }
            
            // Process requests with throttling
            var results = [];
            var index = 0;
            
            function processNext() {
                if (index >= requests.length) {
                    return Promise.resolve();
                }
                
                var req = requests[index++];
                var startTime = Date.now();
                
                // Execute the request
                var promise;
                
                if (req.resource && req.method) {
                    // Resource-based request
                    switch (req.method.toUpperCase()) {
                        case 'POST':
                            promise = client.create(req);
                            break;
                        case 'PUT':
                            promise = client.update(req);
                            break;
                        case 'GET':
                            promise = client.read(req);
                            break;
                        case 'DELETE':
                            promise = client.delete(req);
                            break;
                        default:
                            promise = Promise.reject(new Error('Unsupported method: ' + req.method));
                    }
                } else if (req.type && req.query) {
                    // Search request
                    promise = client.search(req);
                } else {
                    // Direct request - pass through to client
                    promise = client(req);
                }
                
                return promise.then(function(result) {
                    result.requestTime = Date.now() - startTime;
                    result.request = req;
                    results.push({ 
                        success: true, 
                        result: result 
                    });
                }).catch(function(error) {
                    results.push({
                        success: false, 
                        error: error,
                        request: req,
                        requestTime: Date.now() - startTime
                    });
                    
                    // Skip remaining dependent requests if this was a critical failure
                    if (options.abortOnError) {
                        return Promise.reject({
                            message: 'Batch processing aborted due to error',
                            error: error,
                            results: results
                        });
                    }
                }).then(function() {
                    // Add delay between requests if specified
                    if (delayBetweenRequests > 0) {
                        return new Promise(function(resolve) {
                            setTimeout(resolve, delayBetweenRequests);
                        });
                    }
                }).then(processNext);
            }
            
            // Create concurrent processors
            var processors = [];
            for (var i = 0; i < Math.min(concurrency, requests.length); i++) {
                processors.push(processNext());
            }
            
            return Promise.all(processors).then(function() {
                return results;
            });
        };
    }
    
    /**
     * Create an optimized batch processor with memory management
     * 
     * @param {Object} client - FHIR client instance
     * @param {Object} options - Batch processing options
     * @return {Function} - Batch processor function
     */
    function createOptimizedBatchProcessor(client, options) {
        options = options || {};
        
        return function(requests) {
            if (!requests || !requests.length) {
                return Promise.resolve({});
            }
            
            // Track the operation for performance metrics
            var timing = perfOptimization.timing.start('BatchProcess');
            
            // Check memory status before starting
            perfOptimization.memoryUsage.check();
            
            // Default options
            var maxConcurrent = options.maxConcurrent || 4;
            var abortOnError = options.abortOnError !== false;
            var cacheResults = options.cacheResults !== false;
            
            // Group requests by resource type for better organization
            var requestsByType = {};
            
            requests.forEach(function(req) {
                if (!req.type) return;
                
                if (!requestsByType[req.type]) {
                    requestsByType[req.type] = [];
                }
                
                requestsByType[req.type].push(req);
            });
            
            // Determine execution strategy based on memory and request size
            var useParallel = options.parallel !== false;
            var results = {};
            var errors = [];
            var resourceTypes = Object.keys(requestsByType);
            
            logger.info('Starting optimized batch processing', {
                resourceTypes: resourceTypes.length,
                totalRequests: requests.length,
                parallel: useParallel,
                maxConcurrent: maxConcurrent
            });
            
            // Helper to process a single chunk of requests
            function processChunk(reqs) {
                // Create promises for each request in the chunk
                var promises = reqs.map(function(req) {
                    return new Promise(function(resolve, reject) {
                        // Add to start timings for this specific request
                        var reqTiming = perfOptimization.timing.start('BatchRequest:' + req.type);
                        
                        // Execute appropriate client function based on request
                        var clientFn;
                        var clientArgs = {};
                        
                        if (req.id) {
                            clientFn = client.read;
                            clientArgs = { type: req.type, id: req.id };
                        } else if (req.query) {
                            clientFn = client.search;
                            clientArgs = { type: req.type, query: req.query };
                        } else {
                            // Unsupported request type
                            reject(new Error('Unsupported request type in batch'));
                            return;
                        }
                        
                        // Add any advanced retry configuration if provided
                        if (req.advancedRetry) {
                            clientArgs.advancedRetry = req.advancedRetry;
                        }
                        
                        // Execute the request
                        clientFn(clientArgs)
                            .then(function(response) {
                                // Record timing
                                perfOptimization.timing.end(reqTiming);
                                
                                // Extract resources if this is a Bundle
                                var resources;
                                if (response && response.resourceType === 'Bundle' && response.entry) {
                                    resources = response.entry.map(function(entry) {
                                        return entry.resource;
                                    }).filter(function(r) { return r != null; });
                                } else {
                                    resources = [response];
                                }
                                
                                resolve({
                                    request: req,
                                    response: response,
                                    resources: resources
                                });
                            })
                            .catch(function(error) {
                                // Record timing
                                perfOptimization.timing.end(reqTiming);
                                
                                // Enhance error with request context
                                error.request = req;
                                
                                reject(error);
                            });
                    });
                });
                
                return Promise.allSettled(promises);
            }
            
            // If using parallel execution
            if (useParallel) {
                // First, determine optimal chunking for each resource type
                var executionPlan = [];
                
                resourceTypes.forEach(function(type) {
                    var typeRequests = requestsByType[type];
                    var chunks = perfOptimization.resourceChunking.chunkResources(typeRequests, {
                        defaultSize: maxConcurrent
                    });
                    
                    chunks.forEach(function(chunk) {
                        executionPlan.push({
                            type: type,
                            chunk: chunk,
                            priority: chunk[0].advancedRetry ? 
                                     chunk[0].advancedRetry.priority || 'normal' : 
                                     'normal'
                        });
                    });
                });
                
                // Sort execution plan by priority
                var priorityRank = {
                    'critical': 0,
                    'high': 1,
                    'normal': 2,
                    'low': 3,
                    'background': 4
                };
                
                executionPlan.sort(function(a, b) {
                    return (priorityRank[a.priority] || 2) - (priorityRank[b.priority] || 2);
                });
                
                logger.debug('Execution plan created', {
                    chunks: executionPlan.length,
                    highPriority: executionPlan.filter(function(p) { 
                        return p.priority === 'critical' || p.priority === 'high'; 
                    }).length
                });
                
                // Process chunks with limited concurrency
                var activePromises = [];
                var completedChunks = 0;
                
                function processNextChunks() {
                    // Fill up active promises to max concurrent
                    while (activePromises.length < maxConcurrent && executionPlan.length > 0) {
                        var nextPlan = executionPlan.shift();
                        var chunkPromise = processChunk(nextPlan.chunk);
                        
                        // Keep track of this promise and remove when done
                        activePromises.push(chunkPromise);
                        
                        // When this chunk completes, process more chunks
                        chunkPromise
                            .then(function(chunkResults) {
                                // Process results
                                chunkResults.forEach(function(result) {
                                    if (result.status === 'fulfilled') {
                                        var req = result.value.request;
                                        var response = result.value.response;
                                        
                                        // Add to results for this resource type
                                        if (!results[req.type]) {
                                            results[req.type] = [];
                                        }
                                        
                                        // Add individual resources to results
                                        results[req.type] = results[req.type].concat(result.value.resources);
                                    } else {
                                        errors.push(result.reason);
                                        
                                        // If aborting on errors, stop processing
                                        if (abortOnError) {
                                            executionPlan = [];
                                        }
                                    }
                                });
                                
                                completedChunks++;
                                
                                // Check memory status periodically
                                if (completedChunks % 5 === 0) {
                                    perfOptimization.memoryUsage.check();
                                }
                                
                                // Remove from active promises
                                var index = activePromises.indexOf(chunkPromise);
                                if (index !== -1) {
                                    activePromises.splice(index, 1);
                                }
                                
                                // Process next chunks
                                if (executionPlan.length > 0 && !abortOnError || errors.length === 0) {
                                    processNextChunks();
                                }
                            });
                    }
                }
                
                // Start processing chunks
                return new Promise(function(resolve, reject) {
                    processNextChunks();
                    
                    // Check if all processing is complete
                    function checkCompletion() {
                        if (activePromises.length === 0 || (errors.length > 0 && abortOnError)) {
                            // Record overall batch timing
                            perfOptimization.timing.end(timing);
                            
                            // Check memory status after completion
                            var memoryStats = perfOptimization.memoryUsage.check();
                            
                            // If we had errors and abortOnError is true, reject
                            if (errors.length > 0 && abortOnError) {
                                reject(errors[0]);
                            } else {
                                // Return both results and any errors
                                resolve({
                                    results: results,
                                    errors: errors.length > 0 ? errors : null,
                                    stats: {
                                        timing: perfOptimization.timing.getStats('BatchProcess'),
                                        memory: memoryStats
                                    }
                                });
                            }
                        } else {
                            setTimeout(checkCompletion, 50);
                        }
                    }
                    
                    // Start checking for completion
                    checkCompletion();
                });
            } 
            // For sequential execution
            else {
                // Flatten all requests while preserving priority
                var allRequests = [];
                
                // Sort resource types by priority (critical resources first)
                var sortedTypes = resourceTypes.sort(function(a, b) {
                    var aPriority = requestsByType[a][0].advancedRetry ? 
                                   requestsByType[a][0].advancedRetry.priority || 'normal' : 
                                   'normal';
                    var bPriority = requestsByType[b][0].advancedRetry ? 
                                   requestsByType[b][0].advancedRetry.priority || 'normal' : 
                                   'normal';
                    
                    var priorityRank = {
                        'critical': 0,
                        'high': 1,
                        'normal': 2,
                        'low': 3,
                        'background': 4
                    };
                    
                    return (priorityRank[aPriority] || 2) - (priorityRank[bPriority] || 2);
                });
                
                // Add requests in priority order
                sortedTypes.forEach(function(type) {
                    allRequests = allRequests.concat(requestsByType[type]);
                });
                
                // Process requests sequentially
                var promise = Promise.resolve();
                
                allRequests.forEach(function(req) {
                    promise = promise.then(function() {
                        // Add to start timings for this specific request
                        var reqTiming = perfOptimization.timing.start('BatchRequest:' + req.type);
                        
                        // Execute appropriate client function based on request
                        var clientFn;
                        var clientArgs = {};
                        
                        if (req.id) {
                            clientFn = client.read;
                            clientArgs = { type: req.type, id: req.id };
                        } else if (req.query) {
                            clientFn = client.search;
                            clientArgs = { type: req.type, query: req.query };
                        } else {
                            // Unsupported request type
                            throw new Error('Unsupported request type in batch');
                        }
                        
                        // Add any advanced retry configuration if provided
                        if (req.advancedRetry) {
                            clientArgs.advancedRetry = req.advancedRetry;
                        }
                        
                        // Execute the request
                        return clientFn(clientArgs)
                            .then(function(response) {
                                // Record timing
                                perfOptimization.timing.end(reqTiming);
                                
                                // Extract resources if this is a Bundle
                                var resources;
                                if (response && response.resourceType === 'Bundle' && response.entry) {
                                    resources = response.entry.map(function(entry) {
                                        return entry.resource;
                                    }).filter(function(r) { return r != null; });
                                } else {
                                    resources = [response];
                                }
                                
                                // Add to results for this resource type
                                if (!results[req.type]) {
                                    results[req.type] = [];
                                }
                                
                                // Add individual resources to results
                                results[req.type] = results[req.type].concat(resources);
                                
                                // Check memory status periodically
                                if (Object.keys(results[req.type]).length % 10 === 0) {
                                    perfOptimization.memoryUsage.check();
                                }
                            })
                            .catch(function(error) {
                                // Record timing
                                perfOptimization.timing.end(reqTiming);
                                
                                // Enhance error with request context
                                error.request = req;
                                errors.push(error);
                                
                                // If aborting on errors, stop processing
                                if (abortOnError) {
                                    throw error;
                                }
                            });
                });
                
                return promise.then(function() {
                    // Record overall batch timing
                    perfOptimization.timing.end(timing);
                    
                    // Check memory status after completion
                    var memoryStats = perfOptimization.memoryUsage.check();
                    
                    // Return both results and any errors
                    return {
                        results: results,
                        errors: errors.length > 0 ? errors : null,
                        stats: {
                            timing: perfOptimization.timing.getStats('BatchProcess'),
                            memory: memoryStats
                        }
                    };
                }).catch(function(error) {
                    // Record overall batch timing even on error
                    perfOptimization.timing.end(timing);
                    throw error;
                });
            }
        }; // Changed to semicolon from comma
    }

    /**
     * Build a complex chained parameter query
     * 
     * @param {String} resourceType - The resource type to search
     * @param {Object} chainedParams - Chained parameters object
     * @return {Object} - Search parameters object
     */
    function buildChainedParameters(resourceType, chainedParams) {
        var result = {};
        
        Object.keys(chainedParams).forEach(function(key) {
            var value = chainedParams[key];
            
            // Check if this is a chained parameter
            if (key.indexOf('.') !== -1) {
                var parts = key.split('.');
                var chainedPath = parts.slice(0, -1).join('.');
                var finalParam = parts[parts.length - 1];
                
                result[chainedPath + '.' + finalParam] = value;
            } else {
                result[key] = value;
            }
        });
        
        return result;
    }
    
    /**
     * Initialize with standard FHIR resource dependencies
     */
    function initializeResourceDependencies() {
        // Common FHIR resource dependencies
        registerDependency('AllergyIntolerance', 'Patient', 'patient');
        registerDependency('CarePlan', 'Patient', 'patient');
        registerDependency('Claim', 'Patient', 'patient');
        registerDependency('Condition', 'Patient', 'patient');
        registerDependency('DiagnosticReport', 'Patient', 'patient');
        registerDependency('DocumentReference', 'Patient', 'patient');
        registerDependency('Encounter', 'Patient', 'patient');
        registerDependency('Goal', 'Patient', 'patient');
        registerDependency('Immunization', 'Patient', 'patient');
        registerDependency('MedicationRequest', 'Patient', 'patient');
        registerDependency('MedicationStatement', 'Patient', 'patient');
        registerDependency('Observation', 'Patient', 'patient');
        registerDependency('Procedure', 'Patient', 'patient');
        
        // Resources with dependencies on other resources
        registerDependency('MedicationRequest', 'Medication', 'medication');
        registerDependency('MedicationStatement', 'Medication', 'medication');
        registerDependency('DiagnosticReport', 'Observation', 'result');
        registerDependency('Observation', 'DiagnosticReport', 'has-member');
        registerDependency('Observation', 'Encounter', 'encounter');
        registerDependency('DiagnosticReport', 'Encounter', 'encounter');
        registerDependency('Procedure', 'Encounter', 'encounter');
        registerDependency('DocumentReference', 'Encounter', 'encounter');
        registerDependency('CarePlan', 'Goal', 'goal');
    }
    
    // Initialize resource dependencies
    initializeResourceDependencies();
    
    /**
     * Memory optimization and performance tuning for complex operations
     * @private
     */
    var perfOptimization = {
        // Memory tracking and optimization
        memoryUsage: {
            track: true,
            highWatermark: 0,
            lastCheck: Date.now(),
            checkInterval: 30000, // Check memory usage every 30 seconds
            
            // Check and report memory usage
            check: function() {
                // Skip if not in Node.js environment
                if (typeof process === 'undefined' || !process.memoryUsage) {
                    return null;
                }
                
                // Skip if not tracking or checked recently
                if (!this.track || (Date.now() - this.lastCheck) < this.checkInterval) {
                    return null;
                }
                
                try {
                    var memory = process.memoryUsage();
                    var heapUsed = memory.heapUsed;
                    var heapTotal = memory.heapTotal;
                    var usage = {
                        rss: Math.round(memory.rss / 1024 / 1024), // MB
                        heapTotal: Math.round(heapTotal / 1024 / 1024), // MB
                        heapUsed: Math.round(heapUsed / 1024 / 1024), // MB
                        percent: Math.round((heapUsed / heapTotal) * 100),
                        external: memory.external ? Math.round(memory.external / 1024 / 1024) : 0 // MB
                    };
                    
                    // Update high watermark
                    if (usage.heapUsed > this.highWatermark) {
                        this.highWatermark = usage.heapUsed;
                    }
                    
                    // Log if usage is high
                    if (usage.percent > 80) {
                        logger.warn('High memory usage detected', usage);
                        
                        // Suggest garbage collection if available
                        if (global.gc && typeof global.gc === 'function') {
                            logger.info('Triggering garbage collection');
                            global.gc();
                            
                            // Update stats after GC
                            var memoryAfterGC = process.memoryUsage();
                            var gcSavings = Math.round((heapUsed - memoryAfterGC.heapUsed) / 1024 / 1024);
                            
                            logger.info('Garbage collection complete', {
                                saved: gcSavings + ' MB',
                                percentSaved: Math.round((heapUsed - memoryAfterGC.heapUsed) / heapUsed * 100) + '%'
                            });
                        }
                    }
                    
                    this.lastCheck = Date.now();
                    return usage;
                } catch (e) {
                    logger.error('Error checking memory usage', e);
                    return null;
                }
            }
        },
        
        // Operation timing and performance tracking
        timing: {
            operations: {},
            
            // Start timing an operation
            start: function(name) {
                if (!name) return null;
                
                var opKey = name.toLowerCase();
                if (!this.operations[opKey]) {
                    this.operations[opKey] = {
                        name: name,
                        count: 0,
                        totalTime: 0,
                        minTime: Number.MAX_SAFE_INTEGER,
                        maxTime: 0,
                        lastExecutionTime: 0
                    };
                }
                
                return {
                    name: name,
                    startTime: Date.now(),
                    opKey: opKey
                };
            },
            
            // End timing an operation
            end: function(timing) {
                if (!timing || !timing.startTime || !timing.opKey) return null;
                
                var duration = Date.now() - timing.startTime;
                var op = this.operations[timing.opKey];
                
                if (op) {
                    op.count++;
                    op.totalTime += duration;
                    op.lastExecutionTime = duration;
                    
                    if (duration < op.minTime) op.minTime = duration;
                    if (duration > op.maxTime) op.maxTime = duration;
                    
                    // Log slow operations
                    if (duration > 1000) {
                        logger.warn('Slow operation detected', {
                            operation: timing.name,
                            duration: duration + 'ms'
                        });
                    }
                }
                
                return duration;
            },
            
            // Get timing stats for all operations or a specific one
            getStats: function(name) {
                if (name) {
                    var opKey = name.toLowerCase();
                    var op = this.operations[opKey];
                    
                    if (!op) return null;
                    
                    return {
                        name: op.name,
                        count: op.count,
                        totalTime: op.totalTime,
                        avgTime: Math.round(op.totalTime / op.count),
                        minTime: op.minTime,
                        maxTime: op.maxTime,
                        lastTime: op.lastExecutionTime
                    };
                }
                
                // Return stats for all operations
                var stats = {};
                var totalTime = 0;
                
                Object.keys(this.operations).forEach(function(key) {
                    var op = this.operations[key];
                    
                    stats[op.name] = {
                        count: op.count,
                        totalTime: op.totalTime,
                        avgTime: Math.round(op.totalTime / op.count),
                        minTime: op.minTime === Number.MAX_SAFE_INTEGER ? 0 : op.minTime,
                        maxTime: op.maxTime
                    };
                    
                    totalTime += op.totalTime;
                }, this);
                
                return {
                    operations: stats,
                    totalTime: totalTime
                };
            }
        },
        
        // Smart resource chunking for large operations
        resourceChunking: {
            // Calculate optimal chunk size based on resource complexity
            getOptimalChunkSize: function(resources, options) {
                options = options || {};
                var defaultSize = options.defaultSize || 20;
                
                if (!resources || !resources.length) {
                    return defaultSize;
                }
                
                // Get a sample of resources to analyze
                var sampleSize = Math.min(resources.length, 10);
                var totalSize = 0;
                
                for (var i = 0; i < sampleSize; i++) {
                    var resource = resources[i];
                    if (!resource) continue;
                    
                    // Estimate resource size
                    var size = 0;
                    try {
                        size = JSON.stringify(resource).length;
                    } catch(e) {
                        // Use an approximation if serialization fails
                        size = 1000;  // Arbitrary default size
                    }
                    
                    totalSize += size;
                }
                
                // Calculate average resource size
                var avgSize = totalSize / sampleSize;
                
                // Very large resources, use smaller chunks
                if (avgSize > 50000) {
                    return 10;
                }
                // Medium resources
                else if (avgSize > 10000) {
                    return 20;
                }
                // Small resources, can use larger chunks
                else {
                    return 50;
                }
            },
            
            // Split resources into optimal chunks
            chunkResources: function(resources, options) {
                if (!resources || !resources.length) {
                    return [[]];
                }
                
                var chunkSize = this.getOptimalChunkSize(resources, options);
                var chunks = [];
                
                for (var i = 0; i < resources.length; i += chunkSize) {
                    chunks.push(resources.slice(i, i + chunkSize));
                }
                
                return chunks;
            }
        }
    };
    
    // Export public API
    module.exports = {
        ComplexityLevel: ComplexityLevel,
        setComplexityLevel: setComplexityLevel,
        getComplexityLevel: getComplexityLevel,
        isFeatureAvailable: isFeatureAvailable,
        
        // Resource dependency management
        registerDependency: registerDependency,
        getTopologicalOrder: getTopologicalOrder,
        createOrderedBundle: createOrderedBundle,
        
        // Complex query building
        buildComplexQuery: buildComplexQuery,
        buildChainedParameters: buildChainedParameters,
        
        // Batch processing
        createBatchProcessor: createBatchProcessor,
        createOptimizedBatchProcessor: createOptimizedBatchProcessor,
        
        // Pagination
        createPaginationHandler: createPaginationHandler,
        
        // Performance optimization
        memoryUsage: perfOptimization.memoryUsage,
        operationTiming: perfOptimization.timing,
        resourceChunking: perfOptimization.resourceChunking
    };
    
}).call(this);
