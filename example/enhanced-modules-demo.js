/**
 * Enhanced Error Handling and Dependency Management Demo
 * 
 * This example demonstrates how to use the error handling, dependency management,
 * and logging systems independently without the full FHIR client.
 */

// Import our enhanced modules
const errorHandling = require('../src/error-handling');
const dependencyManager = require('../src/dependency-manager');
const logging = require('../src/logging');

// ===== LOGGING SYSTEM DEMO =====
console.log('\n===== LOGGING SYSTEM =====');

// Configure logging
logging.configure({
  level: 'debug',
  includeTimestamps: true,
  includeComponent: true
});

// Create component-specific loggers
const apiLogger = logging.getLogger('api');
const uiLogger = logging.getLogger('ui');

// Log at different levels
apiLogger.debug('API initialized with options:', { timeout: 30000, retries: 3 });
apiLogger.info('Connected to FHIR server');
apiLogger.warn('Using deprecated endpoint');
apiLogger.error('Failed to parse response');

// Component-specific log levels
logging.setComponentLogLevel('ui', 'warn');
uiLogger.debug('This debug message should NOT be visible');
uiLogger.info('This info message should NOT be visible');  
uiLogger.warn('This warning message should be visible');
uiLogger.error('This error message should be visible');


// ===== DEPENDENCY MANAGEMENT DEMO =====
console.log('\n===== DEPENDENCY MANAGEMENT =====');

// Register dependencies
dependencyManager.register('formatUtils', {
  formatDate: date => new Date(date).toISOString().split('T')[0],
  formatCurrency: (amount, currency = 'USD') => 
    `${currency} ${parseFloat(amount).toFixed(2)}`
});

dependencyManager.register('httpClient', {
  get: url => console.log(`[Mock] GET ${url}`),
  post: (url, data) => console.log(`[Mock] POST ${url}`, data)
});

// Use registered dependencies
const formatter = dependencyManager.get('formatUtils');
console.log('Today:', formatter.formatDate(new Date()));
console.log('Price:', formatter.formatCurrency(99.95));

const http = dependencyManager.get('httpClient');
http.get('https://example.com/api/patients');
http.post('https://example.com/api/patients', { name: 'Test Patient' });

// Feature detection
console.log('\nFeature detection:');
dependencyManager.registerFeature('advancedCharts', false);
dependencyManager.registerFeature('offlineMode', true);

if (dependencyManager.hasFeature('offlineMode')) {
  console.log('Offline mode is available');
}

if (!dependencyManager.hasFeature('advancedCharts')) {
  console.log('Advanced charts are not available');
}


// ===== ERROR HANDLING DEMO =====
console.log('\n===== ERROR HANDLING =====');

// Register custom error reporter
errorHandling.registerErrorReporter(error => {
  console.log('=== ERROR REPORT ===');
  console.log(`Type: ${error.classification}`);
  console.log(`Message: ${error.userMessage}`);
  console.log(`Details: ${JSON.stringify(error.context)}`);
  console.log('===================');
});

// Classify different errors
console.log('\nError Classification:');

const networkError = { status: 0, message: 'Failed to connect' };
console.log('Network Error:', errorHandling.classifyError(networkError));

const authError = { status: 401, message: 'Unauthorized' };
console.log('Auth Error:', errorHandling.classifyError(authError));

const serverError = { status: 500, message: 'Internal Server Error' };
console.log('Server Error:', errorHandling.classifyError(serverError));

// Enrich and report an error
console.log('\nError Enrichment:');
const originalError = { 
  status: 404,
  statusText: 'Not Found',
  url: 'https://example.com/api/patients/12345'
};

const enrichedError = errorHandling.enrichError(originalError, {
  method: 'GET',
  request: { id: '12345', type: 'Patient' },
  duration: 430
});

// Report the error through the registered reporter
errorHandling.reportError(enrichedError);

// Create a retry middleware
const retryMiddleware = errorHandling.createRetryMiddleware({
  maxRetries: 3,
  baseDelay: 100
});

// Function that fails the first two times then succeeds
let attempts = 0;
const flakeyFunction = function() {
  return new Promise((resolve, reject) => {
    attempts++;
    console.log(`Attempt ${attempts}...`);
    
    if (attempts <= 2) {
      reject({ status: 500, message: 'Temporary server error' });
    } else {
      resolve({ success: true, data: 'It finally worked!' });
    }
  });
};

// Apply retry middleware
console.log('\nRetry Policy:');
const retryableOperation = retryMiddleware(flakeyFunction);

// Execute with retry
retryableOperation({})
  .then(result => {
    console.log('Operation succeeded after retries:', result);
  })
  .catch(error => {
    console.log('Operation failed after all retry attempts:', error);
  });

console.log('\nExample complete!');
