# Advanced Performance Optimization in fhir.js

This document provides guidance on using the advanced performance optimization features in fhir.js for high-throughput, resource-intensive applications.

## Table of Contents

1. [Resource Caching](#resource-caching)
2. [Memory Management](#memory-management)
3. [Optimized Batch Processing](#optimized-batch-processing)
4. [Performance Monitoring](#performance-monitoring)
5. [Configuration Examples](#configuration-examples)

## Resource Caching

The fhir.js library includes a sophisticated caching system for reducing server load and improving application performance.

### Basic Configuration

```javascript
const client = fhir({
  baseUrl: 'https://example.fhir.org/r4',
  cache: {
    enabled: true,               // Enable caching
    maxSize: 500,                // Store up to 500 resources
    ttl: 5 * 60 * 1000,          // 5 minute TTL
    cacheSearchResults: true     // Cache search results
  }
});
```

### Advanced Cache Configuration

```javascript
const client = fhir({
  baseUrl: 'https://example.fhir.org/r4',
  cache: {
    enabled: true,
    maxSize: 1000,
    ttl: 10 * 60 * 1000,         // 10 minute TTL for most resources
    resourceTypes: null,         // Cache all resource types
    excludeResourceTypes: [      // Except these types
      'AuditEvent',
      'Provenance'
    ],
    persistToStorage: true,      // Keep cache between sessions
    smartInvalidation: true,     // Automatically invalidate related resources
    cacheBundles: true,          // Extract and cache resources from bundles
    prerenderReferences: false,  // Pre-resolve common references
    cacheSearchResults: true,    // Cache search results
    searchResultsTtl: 30 * 1000, // 30 second TTL for search results
    memoryThreshold: 0.9         // Purge when memory usage exceeds 90% of max
  }
});
```

### Working with the Cache

```javascript
// Manually invalidate cache for specific resources
client.clearCache('Patient');

// Check cache statistics
const stats = client.getCacheStats();
console.log('Cache size:', stats.totalEntries);
console.log('Memory usage:', stats.memoryUsageMB + ' MB');
console.log('Resources by type:', stats.byResourceType);
```

## Memory Management

For applications that process large volumes of FHIR resources, memory management is critical.

### Memory Usage Monitoring

```javascript
// Get current memory status
const memoryInfo = client.complexity.memoryUsage.check();
console.log('Memory usage:', memoryInfo);

// Track memory high watermark
console.log('Peak memory used:', client.complexity.memoryUsage.highWatermark + ' MB');
```

### Resource Chunking

Large operations are automatically chunked to optimize memory usage:

```javascript
// Create batch request with many resources
const resources = loadThousandsOfResources();

// This will be automatically chunked based on resource size
const batchProcessor = client.complexity.createOptimizedBatchProcessor(client, {
  maxConcurrent: 3,
  abortOnError: false
});

const results = await batchProcessor(resources);
```

## Optimized Batch Processing

The optimized batch processor supports:

1. Priority-based processing (critical resources first)
2. Memory-aware operation
3. Automatic chunking based on resource size
4. Parallel or sequential execution
5. Granular error handling

### Example

```javascript
const results = await client.processBatch([
  // Critical priority resources
  { 
    type: 'Patient', 
    id: '123',
    advancedRetry: { priority: 'critical' }
  },
  // High priority resources
  { 
    type: 'Condition', 
    query: { patient: '123' },
    advancedRetry: { priority: 'high' }
  },
  // Normal priority resources (default)
  { 
    type: 'Observation', 
    query: { patient: '123', code: 'http://loinc.org|8480-6' }
  },
  // Low priority resources
  { 
    type: 'DocumentReference', 
    query: { patient: '123' },
    advancedRetry: { priority: 'low' }
  }
], {
  parallel: true,         // Process in parallel
  maxConcurrent: 3,       // Maximum concurrent requests
  abortOnError: false,    // Continue on errors
  cacheResults: true      // Cache results
});
```

## Performance Monitoring

Track performance of FHIR operations:

```javascript
// Start timing an operation
const timing = client.complexity.operationTiming.start('LoadPatientData');

// Do your work...
await loadPatientData();

// End timing
const duration = client.complexity.operationTiming.end(timing);
console.log('Operation took:', duration + 'ms');

// Get statistics for all operations
const stats = client.complexity.operationTiming.getStats();
console.log('Operation statistics:', stats);
```

## Configuration Examples

### Low Memory Environment (Mobile/Edge)

```javascript
const client = fhir({
  baseUrl: 'https://example.fhir.org/r4',
  cache: {
    enabled: true,
    maxSize: 100,                // Small cache
    ttl: 10 * 60 * 1000,         // 10 minute TTL
    persistToStorage: false,     // Don't persist to storage
    cacheSearchResults: true,    // Cache search results
    memoryThreshold: 0.75        // Aggressive memory management
  },
  complexity: {
    level: 'standard',           // Simpler complexity level
    batchSize: 10                // Small batch size
  }
});
```

### High Performance Server Environment

```javascript
const client = fhir({
  baseUrl: 'https://example.fhir.org/r4',
  cache: {
    enabled: true,
    maxSize: 10000,              // Large cache
    ttl: 30 * 60 * 1000,         // 30 minute TTL
    persistToStorage: true,      // Persist to storage
    cacheSearchResults: true,    // Cache search results
    searchResultsTtl: 60 * 1000, // 1 minute search TTL
    memoryThreshold: 0.95        // Use more memory before purging
  },
  complexity: {
    level: 'advanced',           // Full complex features
    batchSize: 50,               // Large batch size
    pagination: {
      defaultCount: 100,         // Get more results per page
      maxConcurrent: 5           // More concurrent pagination
    }
  },
  retry: {
    maxRetries: 3,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 0.3,     // Open after 30% failures
      resetTimeout: 30 * 1000    // Try to recover after 30 seconds
    }
  }
});
```
