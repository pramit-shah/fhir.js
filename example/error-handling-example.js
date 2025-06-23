/**
 * Example showing the enhanced error handling and logging capabilities
 * 
 * To run this example:
 * node example/error-handling-example.js
 */

// Import required modules
const mkFhir = require('../src/adapters/node');
const errorHandling = require('../src/error-handling');
const dependencyManager = require('../src/dependency-manager');
const logging = require('../src/logging');

// Configure logging system
logging.configure({
  level: 'debug', // Set to debug, info, warn, error, or none
  includeTimestamps: true,
  includeComponent: true
});

// Create a logger for this example
const logger = logging.getLogger('example');

// Create a FHIR client
const client = mkFhir({
  baseUrl: 'https://hapi.fhir.org/baseR4',
  
  // Configure default retry settings
  retries: 2,
  retryDelay: 1000
});

// Configure custom error reporter
errorHandling.registerErrorReporter(function(error) {
  console.error(`[ERROR REPORTER] ${error.userMessage}`);
  
  // Log to a hypothetical monitoring service
  if (process.env.NODE_ENV === 'production') {
    // In a real application, you might send to a service like Sentry, New Relic, etc.
    console.log(`Would send to error monitoring service: ${JSON.stringify({
      message: error.userMessage,
      type: error.classification,
      status: error.status,
      url: error.url
    })}`);
  }
});

// Example 1: Successful request
console.log('=== Example 1: Successful request ===');
client.search({
  type: 'Patient',
  query: { _count: 1 }
})
.then(response => {
  console.log(`Successfully fetched ${response.data.entry ? response.data.entry.length : 0} patients`);
})
.catch(error => {
  console.error('Error fetching patients:', error.userMessage);
});

// Example 2: Error handling for non-existent endpoint
console.log('\n=== Example 2: Error handling for non-existent endpoint ===');
client.search({
  type: 'NonExistentResource', // This will cause a 404
  query: { _count: 1 }
})
.then(response => {
  console.log('This should not happen');
})
.catch(error => {
  console.error('Expected error occurred:', error.userMessage);
  console.log('Error classification:', error.classification);
  console.log('Is this error retriable?', client.errors.isRetriable(error) ? 'Yes' : 'No');
});

// Example 3: Network error simulation with middleware
console.log('\n=== Example 3: Network error simulation with middleware ===');
// Create a function that will fail with network error
const simulatedFailingOperation = function() {
  return new Promise((resolve, reject) => {
    // Simulate a network error
    reject({
      status: 0,
      message: 'Network error'
    });
  });
};

// Create a retry middleware
const retryMiddleware = errorHandling.createRetryMiddleware({
  maxRetries: 2,
  baseDelay: 100,
  exponential: true,
  jitter: true
});

// Apply the retry middleware to our failing operation
const operationWithRetry = retryMiddleware(simulatedFailingOperation);

// Execute the operation
operationWithRetry({})
.then(() => {
  console.log('This should not happen');
})
.catch(error => {
  console.log('Retry policy exhausted after multiple attempts');
});

// Example 4: Using dependency management
console.log('\n=== Example 4: Using dependency management ===');
// Register a custom utility
dependencyManager.register('customFormatter', {
  formatDate: function(date) {
    return new Date(date).toISOString().substring(0, 10);
  }
});

// Get the registered dependency
const formatter = dependencyManager.get('customFormatter');
console.log('Formatted date:', formatter.formatDate(new Date()));

// Check for features
console.log('Environment features:');
console.log('- Running in Node.js?', dependencyManager.hasFeature('isNode') ? 'Yes' : 'No');
console.log('- Has native fetch?', dependencyManager.hasFeature('fetch') ? 'Yes' : 'No');
console.log('- Has AbortController?', dependencyManager.hasFeature('abortController') ? 'Yes' : 'No');

// Example 5: Custom logging
console.log('\n=== Example 5: Custom logging ===');
const myLogger = logging.getLogger('myComponent');

myLogger.debug('This is a debug message');
myLogger.info('This is an info message');
myLogger.warn('This is a warning message');
myLogger.error('This is an error message');

// Set global log level
console.log('\nChanging global log level to ERROR:');
logging.setLevel('error');

myLogger.debug('This debug message should NOT be visible');
myLogger.info('This info message should NOT be visible');
myLogger.warn('This warning message should NOT be visible');
myLogger.error('This error message should still be visible');

console.log('\nExample complete!');
