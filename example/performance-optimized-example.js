/**
 * Advanced performance optimized FHIR.js example
 * 
 * This example demonstrates optimal performance configurations:
 * 1. Resource caching with smart invalidation
 * 2. Batch request optimization
 * 3. Adaptive retry with priority-based requests
 * 4. Dependency graph for complex resources
 * 5. Performance logging and monitoring
 */

// Initialize FHIR client with performance optimizations
var fhir = require('../src/adapters/node')({
  baseUrl: 'https://hapi.fhir.org/baseR4',
  
  // Cache configuration for optimal performance
  cache: {
    enabled: true,
    maxSize: 1000,                   // Cache up to 1000 resources
    ttl: 10 * 60 * 1000,             // Default TTL: 10 minutes
    persistToStorage: true,          // Persist cache between sessions
    smartInvalidation: true,         // Automatically invalidate related resources
    cacheBundles: true,              // Extract and cache resources from bundles
    cacheSearchResults: true,        // Cache search results
    searchResultsTtl: 30 * 1000      // Shorter TTL for search results (30 seconds)
  },
  
  // Configure retry policies with priority
  retry: {
    maxRetries: 3,
    policies: {
      patient: {
        priority: 'critical',
        maxRetries: 5,
        baseDelay: 200
      },
      observation: {
        priority: 'high',
        maxRetries: 3,
        baseDelay: 300
      },
      default: {
        priority: 'normal',
        maxRetries: 2,
        baseDelay: 500
      }
    },
    // Circuit breaker configuration
    circuitBreaker: {
      enabled: true,
      failureThreshold: 0.3,         // Open after 30% failures
      resetTimeout: 30 * 1000        // Try to recover after 30 seconds
    }
  },
  
  // Configure complexity level for advanced features
  complexity: {
    level: 'advanced',               // Enable all advanced features
    batchSize: 20,                   // Optimal batch size for server
    graphDepth: 3,                   // Maximum depth for resource dependency graphs
    pagination: {
      defaultCount: 50,
      maxConcurrent: 3
    }
  },
  
  // Configure detailed logging
  logging: {
    level: 'info',                   // Normal operation level
    performance: {
      enabled: true,                 // Track performance metrics
      slowThresholdMs: 1000          // Log requests slower than 1 second
    },
    console: false,                  // Don't log to console in production
    custom: function(level, message, context) {
      // In production, you would send to your monitoring system
      if (level === 'error' || (level === 'warn' && context.retriable === false)) {
        console.error('[' + level + '] ' + message, context);
      }
      
      // Track all performance issues
      if (context.duration && context.duration > 1000) {
        console.warn('Slow FHIR operation', {
          operation: context.operation,
          resourceType: context.resourceType,
          duration: context.duration
        });
      }
    }
  }
});

// Example: Optimized patient data loading with caching
async function loadPatientData(patientId) {
  console.log('Loading data for patient:', patientId);
  
  try {
    // First, load patient demographics - with critical priority
    const patientResult = await fhir.read({
      type: 'Patient',
      id: patientId,
      // This will use adaptive retry with 'critical' priority from config
      advancedRetry: { waitForEtag: false }
    });
    
    // Check cache stats
    const cacheStats = fhir.cache.getStats();
    console.log('Cache statistics:', {
      totalEntries: cacheStats.totalEntries,
      patientResources: cacheStats.byResourceType['Patient'] || 0,
      memoryUsageMB: cacheStats.memoryUsageMB
    });
    
    // Build optimized batch request for related resources
    // This will auto-split into optimal sized batches if needed
    const patientData = await fhir.processBatch([
      // Get patient's conditions - high priority
      { 
        type: 'Condition', 
        query: { patient: patientId, _sort: '-onset-date' },
        advancedRetry: { priority: 'high' }
      },
      // Get patient's medications - high priority
      {
        type: 'MedicationRequest',
        query: { patient: patientId, status: 'active' },
        advancedRetry: { priority: 'high' }
      },
      // Get patient's recent observations - normal priority
      {
        type: 'Observation',
        query: { patient: patientId, _count: 50, _sort: '-date' },
        advancedRetry: { priority: 'normal' }
      },
      // Get patient's appointments - lower priority
      {
        type: 'Appointment',
        query: { patient: patientId, status: 'booked' },
        advancedRetry: { priority: 'low' }
      }
    ], {
      // Options for batch processing
      parallel: true,           // Execute requests in parallel
      abortOnError: false,      // Continue on non-critical errors
      cacheResults: true,       // Cache all results 
      maxConcurrent: 3          // Maximum parallel requests
    });
    
    // Create a dependency graph for complex operations
    // This helps understand resource relationships for updates
    const resourceGraph = fhir.createDependencyGraph([
      patientData.Condition,
      patientData.MedicationRequest,
      patientData.Observation,
      patientData.Appointment
    ]);
    
    // Check for circular dependencies or invalid references
    const validationIssues = resourceGraph.validate();
    if (validationIssues.length > 0) {
      console.warn('Resource graph validation issues:', validationIssues);
    }
    
    return {
      patient: patientResult,
      conditions: patientData.Condition,
      medications: patientData.MedicationRequest,
      observations: patientData.Observation,
      appointments: patientData.Appointment,
      graph: resourceGraph
    };
  } catch (error) {
    console.error('Error loading patient data:', error);
    
    // The enhanced error object contains detailed info
    if (error.retryContext) {
      console.log('Retry attempts:', error.retryContext.attempts);
      console.log('Retry duration:', error.retryContext.duration + 'ms');
      
      // Check circuit breaker state
      const cbState = fhir.circuitBreaker.getState();
      console.log('Circuit breaker state:', cbState);
      
      // Reset the circuit breaker if needed
      if (cbState === 'open') {
        fhir.circuitBreaker.reset();
      }
    }
    
    throw error;
  }
}

// Function to analyze perfomance of a FHIR operation
async function measurePerformance(fn, ...args) {
  const startTime = Date.now();
  let result;
  
  try {
    result = await fn(...args);
    const duration = Date.now() - startTime;
    
    console.log('Performance measurement:', {
      operation: fn.name,
      duration: duration + 'ms',
      cacheStats: fhir.cache.getStats()
    });
    
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error('Operation failed after ' + duration + 'ms', error);
    throw error;
  }
}

// Run the optimized example
(async function() {
  try {
    // First load - should be slower as it populates the cache
    const patientData = await measurePerformance(loadPatientData, '123456');
    console.log('Patient data loaded:', {
      name: patientData.patient.name?.[0]?.given?.join(' ') + ' ' + patientData.patient.name?.[0]?.family,
      conditions: patientData.conditions?.length || 0,
      medications: patientData.medications?.length || 0,
      observations: patientData.observations?.length || 0
    });
    
    // Second load - should be faster due to caching
    console.log('\nPerforming second load (should be faster)...');
    const patientData2 = await measurePerformance(loadPatientData, '123456');
    
    // Show performance comparison
    console.log('Performance comparison complete');
    
  } catch (error) {
    console.error('Example failed:', error.message);
  }
})();
