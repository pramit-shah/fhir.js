/**
 * Basic error handling test
 */

// First, ensure required modules
function ensureErrorHandlingModule() {
  // Check if error handling module exports properly
  const errorHandling = require('../src/error-handling');
  console.log("Error handling module exports:", Object.keys(errorHandling));
  
  // Test basic error classification
  const testError = { status: 404, statusText: 'Not Found' };
  const classification = errorHandling.classifyError(testError);
  console.log("Error classification test:", classification);
  
  return "✓ Error handling module OK";
}

function ensureDependencyModule() {
  // Check dependency manager exports
  const dependencyManager = require('../src/dependency-manager');
  console.log("Dependency manager exports:", Object.keys(dependencyManager));
  
  // Test registration
  dependencyManager.register('testDep', { version: '1.0.0' });
  const dep = dependencyManager.get('testDep');
  console.log("Dependency registration test:", dep);
  
  return "✓ Dependency manager module OK";
}

function ensureLoggingModule() {
  // Check logging module exports
  const logging = require('../src/logging');
  console.log("Logging module exports:", Object.keys(logging));
  
  // Create a test logger
  const logger = logging.getLogger('test');
  logger.info("This is a test log message");
  
  return "✓ Logging module OK";
}

// Run tests
try {
  console.log(ensureErrorHandlingModule());
  console.log(ensureDependencyModule());
  console.log(ensureLoggingModule());
  console.log("All modules working correctly!");
} catch (error) {
  console.error("Error testing modules:", error);
}
