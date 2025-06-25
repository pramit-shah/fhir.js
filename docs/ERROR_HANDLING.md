# Error Handling Guide for FHIR.js

This guide provides comprehensive information about the error handling capabilities in FHIR.js.

## Table of Contents

- [Introduction](#introduction)
- [Error Classification](#error-classification)
- [Error Structure](#error-structure)
- [Error Handling Best Practices](#error-handling-best-practices)
- [Retry Mechanisms](#retry-mechanisms)
- [Custom Error Reporters](#custom-error-reporters)
- [Error Middleware](#error-middleware)
- [HTTP Status Code Handling](#http-status-code-handling)
- [Common Error Scenarios](#common-error-scenarios)
- [Debugging Tips](#debugging-tips)
- [Examples](#examples)

## Introduction

FHIR.js provides a robust error handling system designed to handle various error scenarios that can occur during FHIR API operations. The system classifies errors, provides context, supports automatic retries, and allows for custom error reporting.

## Error Classification

Errors in FHIR.js are classified into the following categories:

| Error Type | Description | Typically Retriable? |
|------------|-------------|----------------------|
| `NETWORK` | Network connectivity issues | Yes |
| `TIMEOUT` | Request timeouts | Yes |
| `AUTH` | Authentication/authorization failures | No |
| `SERVER` | Server-side errors (5xx) | Yes |
| `VALIDATION` | Invalid requests (400, 422) | No |
| `CLIENT` | Other client errors (4xx) | No |
| `PARSING` | Response parsing failures | No |
| `REFERENCE` | Invalid resource references | No |
| `PROFILE` | FHIR profile validation failures | No |
| `UNKNOWN` | Uncategorized errors | No |

## Error Structure

FHIR.js error objects contain the following properties:

```javascript
{
  // Standard properties
  message: "Failed to fetch Patient/123: Server error",
  stack: "Error: Failed to fetch...",
  
  // Enhanced properties
  status: 500,                           // HTTP status code if applicable
  errorType: "server_error",             // Classification from ErrorTypes
  retriable: true,                       // Whether the error can be retried
  url: "http://example.org/fhir/Patient/123", // Request URL
  method: "GET",                         // HTTP method

  // Context information
  resourceType: "Patient",               // Resource type if applicable
  operation: "read",                     // FHIR operation
  attempt: 1,                            // Retry attempt number
  startTime: 1624547846135,              // Request start timestamp
  endTime: 1624547846735,                // Request end timestamp
  duration: 600,                         // Request duration in ms

  // User-friendly information
  userMessage: "Unable to retrieve patient data. The server is experiencing issues.",
  
  // Original data
  data: { ... },                        // Response data if available
  originalError: { ... }                // Original error object
}
```

## Error Handling Best Practices

### 1. Always Use Try/Catch with Async/Await

```javascript
async function fetchPatient(id) {
  try {
    const response = await client.read({ type: 'Patient', id });
    return response.data;
  } catch (error) {
    handleError(error);
  }
}
```

### 2. Check Error Types for Specific Handling

```javascript
function handleError(error) {
  switch(error.errorType) {
    case client.errorTypes.NETWORK:
      showConnectivityError();
      break;
    case client.errorTypes.AUTH:
      promptForReauthentication();
      break;
    case client.errorTypes.SERVER:
      showServerError(error.status, error.message);
      break;
    case client.errorTypes.VALIDATION:
      showValidationErrors(error.data);
      break;
    default:
      showGenericError();
  }
}
```

### 3. Check If Errors Are Retriable

```javascript
function performOperation() {
  return client.read({ type: 'Patient', id: '123' })
    .catch(error => {
      if (error.retriable) {
        return client.errors.retry(() => 
          client.read({ type: 'Patient', id: '123' })
        );
      } else {
        throw error; // Re-throw non-retriable errors
      }
    });
}
```

### 4. Provide User-Friendly Messages

```javascript
function displayErrorToUser(error) {
  const userMessage = error.userMessage || 
    'An unexpected error occurred. Please try again later.';
    
  showErrorDialog(userMessage);
  
  // Log technical details for debugging
  console.error('Technical error details:', error);
}
```

### 5. Log Errors Appropriately

```javascript
function logError(error) {
  const logger = client.logging.getLogger('errorHandler');
  
  // Log with appropriate severity
  if (error.status >= 500) {
    logger.error('Server error', error);
  } else if (error.errorType === client.errorTypes.NETWORK) {
    logger.warn('Network issue', error);
  } else {
    logger.info('Operation failed', error);
  }
}
```

## Retry Mechanisms

FHIR.js provides built-in retry capabilities for transient errors.

### Basic Retry Configuration

```javascript
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  retries: 3,              // Number of retry attempts
  retryDelay: 1000         // Base delay in ms
});
```

### Advanced Retry Configuration

```javascript
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  advancedRetry: {
    maxRetries: {
      default: 3,
      read: 5,              // More retries for read operations
      search: 2             // Fewer retries for search operations
    },
    delayCalculation: 'exponential', // 'linear', 'exponential', or 'custom'
    baseDelay: 1000,
    maxDelay: 30000,        // Cap delay at 30 seconds
    factor: 2,              // Exponential backoff factor
    jitter: true,           // Add randomness to avoid thundering herd
    jitterFactor: 0.1,      // 10% jitter
    retryCondition: function(error) {
      // Custom logic to determine if error should be retried
      return error.status >= 500 || error.errorType === 'network_error';
    },
    onRetry: function(error, attempt, delay) {
      console.log(`Retrying after error (attempt ${attempt}, delay ${delay}ms)`);
    }
  }
});
```

### Manual Retry

```javascript
function fetchWithRetry() {
  return client.errors.retry(
    // Function that returns a promise
    () => client.read({ type: 'Patient', id: '123' }),
    
    // Retry options
    {
      maxRetries: 5,
      initialDelay: 1000,
      factor: 2,
      jitter: true,
      onRetry: (error, attempt, delay) => {
        console.log(`Retry ${attempt} after ${delay}ms`);
      }
    }
  );
}
```

### Adaptive Retries

```javascript
// Advanced retry with server health monitoring
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  advancedRetry: {
    adaptive: true,       // Enable adaptive retries
    healthCheck: {
      enabled: true,      // Monitor server health
      endpoint: '_health', // Health check endpoint
      interval: 30000,    // Check every 30 seconds
      timeout: 5000       // Health check timeout
    },
    circuitBreaker: {
      enabled: true,      // Enable circuit breaker pattern
      threshold: 5,       // Number of failures before opening
      resetTimeout: 60000 // Time before attempting to close circuit
    }
  }
});
```

## Custom Error Reporters

FHIR.js allows you to register custom error reporters to handle errors globally.

```javascript
// Register an error reporter for analytics
client.errors.registerErrorReporter(function(error) {
  // Send to monitoring service
  sendToMonitoringService({
    type: error.errorType,
    url: error.url,
    statusCode: error.status,
    message: error.message,
    timestamp: new Date().toISOString(),
    userId: getCurrentUserId()
  });
  
  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    console.error(`FHIR.js Error (${error.errorType}):`, error);
  }
});
```

Multiple reporters can be registered and will be called in sequence.

## Error Middleware

You can create custom middleware to handle errors in specific ways.

```javascript
// Error transformation middleware
function errorEnhancerMiddleware(client) {
  // Store the original http implementation
  const originalHttp = client._adapter.http;
  
  // Override with enhanced error handling
  client._adapter.http = function(args) {
    return originalHttp(args).catch(error => {
      // Add business context to the error
      if (args.resourceType === 'Patient') {
        error.businessContext = {
          department: 'Registration',
          impact: 'High',
          procedure: 'Patient Registration'
        };
      }
      
      // Continue with the error chain
      throw error;
    });
  };
  
  return client;
}

// Apply the middleware
const enhancedClient = errorEnhancerMiddleware(client);
```

## HTTP Status Code Handling

FHIR.js handles HTTP status codes according to the FHIR specification:

| Status Code | Error Type | Handling |
|-------------|------------|----------|
| 401, 403 | AUTH | Authentication errors, typically need user action |
| 404 | CLIENT | Resource not found |
| 400, 422 | VALIDATION | Invalid request, check OperationOutcome for details |
| 5XX | SERVER | Server errors, typically retriable |
| 408 | TIMEOUT | Request timeout, typically retriable |

## Common Error Scenarios

### Authentication Errors

```javascript
client.read({ type: 'Patient', id: '123' })
  .catch(error => {
    if (error.errorType === client.errorTypes.AUTH) {
      if (error.status === 401) {
        // Token expired, refresh token
        return refreshToken().then(() => 
          client.read({ type: 'Patient', id: '123' })
        );
      } else if (error.status === 403) {
        // Insufficient permissions
        showPermissionError();
      }
    }
  });
```

### Network Errors

```javascript
client.read({ type: 'Patient', id: '123' })
  .catch(error => {
    if (error.errorType === client.errorTypes.NETWORK) {
      // Check online status
      if (!navigator.onLine) {
        showOfflineMessage();
        // Queue for later execution when online
        addToOfflineQueue(() => 
          client.read({ type: 'Patient', id: '123' })
        );
      } else {
        // Online but network error occurred
        showNetworkErrorMessage();
      }
    }
  });
```

### Resource Validation Errors

```javascript
client.create({ 
  type: 'Patient', 
  resource: newPatient 
})
.catch(error => {
  if (error.errorType === client.errorTypes.VALIDATION) {
    // Extract validation errors from OperationOutcome
    const validationErrors = [];
    
    if (error.data && error.data.issue) {
      error.data.issue.forEach(issue => {
        validationErrors.push({
          field: issue.expression ? issue.expression[0] : 'unknown',
          severity: issue.severity,
          message: issue.diagnostics || issue.details?.text || 'Validation error'
        });
      });
    }
    
    // Display validation errors to user
    showValidationErrorsInForm(validationErrors);
  }
});
```

## Debugging Tips

### Enable Debug Mode

```javascript
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  debug: true  // Enable debug logging
});
```

### Use Logging for Detailed Information

```javascript
// Configure detailed logging
client.logging.configure({
  level: 'debug',
  includeTimestamps: true,
  includeComponent: true
});

// Create a request-specific logger
const requestLogger = client.logging.getLogger('requests');
requestLogger.debug('Making request', { resource: 'Patient', id: '123' });
```

### Inspect Network Requests

In browser environments:

1. Open Developer Tools (F12)
2. Navigate to the Network tab
3. Filter for requests to your FHIR server
4. Examine request/response details

### Check FHIR Server Capabilities

```javascript
// Fetch the server's capability statement
client.conformance()
  .then(response => {
    const capabilities = response.data;
    console.log('Server supports these resources:', 
      capabilities.rest[0].resource.map(r => r.type));
  })
  .catch(error => {
    console.error('Could not fetch capabilities:', error);
  });
```

## Examples

### Complete Error Handling Example

```javascript
async function fetchPatientWithErrorHandling(id) {
  const logger = client.logging.getLogger('patientApi');
  
  try {
    logger.debug('Fetching patient', { id });
    const response = await client.read({ type: 'Patient', id });
    logger.info('Successfully fetched patient', { id });
    return response.data;
  } catch (error) {
    logger.error('Error fetching patient', { id, error });
    
    // Check error type
    switch(error.errorType) {
      case client.errorTypes.AUTH:
        // Handle authentication errors
        if (error.status === 401) {
          logger.info('Token expired, refreshing');
          await refreshToken();
          // Retry after token refresh
          return fetchPatientWithErrorHandling(id);
        } else {
          showPermissionError('You do not have permission to view this patient');
        }
        break;
        
      case client.errorTypes.NETWORK:
        showConnectivityError('Network connectivity issue. Please check your connection');
        // Queue for offline handling if appropriate
        if (offlineSupport) {
          queueForOffline('fetchPatient', { id });
        }
        break;
        
      case client.errorTypes.SERVER:
        // Log server error details
        logger.error('Server error details', { 
          status: error.status,
          url: error.url,
          response: error.data
        });
        
        showServerError('The server encountered an error. Our team has been notified.');
        
        // Try alternate server if available
        if (fallbackServerAvailable) {
          logger.info('Attempting fallback server');
          return fetchPatientFromFallbackServer(id);
        }
        break;
        
      case client.errorTypes.VALIDATION:
        // For validation errors, these are typically client-side issues
        logger.warn('Validation error', { details: error.data });
        showValidationError('Invalid patient ID format');
        break;
        
      default:
        showGenericError('An unexpected error occurred');
        // Report to error tracking service
        reportToErrorTrackingService(error);
    }
    
    // Re-throw the error for upstream handling
    throw error;
  }
}
```

### Error Handling in a React Component

```jsx
import React, { useState, useEffect } from 'react';
import fhir from 'fhir.js';

const client = fhir({ baseUrl: 'http://example.org/fhir' });

function PatientDetail({ patientId }) {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Reset state when patient ID changes
    setLoading(true);
    setError(null);
    
    client.read({ type: 'Patient', id: patientId })
      .then(response => {
        setPatient(response.data);
        setLoading(false);
      })
      .catch(error => {
        setLoading(false);
        
        // Format user-friendly error message
        let userMessage;
        
        switch(error.errorType) {
          case client.errorTypes.AUTH:
            userMessage = 'You need to log in again to view this patient';
            // Trigger auth workflow
            redirectToLogin();
            break;
            
          case client.errorTypes.NETWORK:
            userMessage = 'Unable to connect to the server. Please check your internet connection';
            break;
            
          case client.errorTypes.SERVER:
            userMessage = 'The server encountered an error. Please try again later';
            break;
            
          case client.errorTypes.CLIENT:
            if (error.status === 404) {
              userMessage = `Patient ${patientId} not found`;
            } else {
              userMessage = 'There was a problem with the request';
            }
            break;
            
          default:
            userMessage = 'An unexpected error occurred';
        }
        
        // Set user-friendly error message
        setError({ message: userMessage, technical: error });
        
        // Log the technical error
        console.error('Error fetching patient:', error);
      });
  }, [patientId]);

  if (loading) {
    return <div>Loading patient data...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>Error</h3>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  return (
    <div className="patient-detail">
      <h2>{patient.name?.[0]?.given?.join(' ')} {patient.name?.[0]?.family}</h2>
      <p>Birth Date: {patient.birthDate}</p>
      <p>Gender: {patient.gender}</p>
      {/* Additional patient details */}
    </div>
  );
}
```

### Implementing Custom Retry Logic

```javascript
// Custom retry logic for specific resources
function patientRetryStrategy(client) {
  // Store original read method
  const originalRead = client.read;
  
  // Enhance read method with custom retry logic
  client.read = function(params) {
    // Only apply custom retry to Patient resource
    if (params.type === 'Patient') {
      const options = {
        maxRetries: 5,
        initialDelay: 500,
        factor: 1.5,
        jitter: true,
        onRetry: (error, attempt, delay) => {
          console.log(`Patient retry ${attempt}, waiting ${delay}ms`);
        }
      };
      
      return client.errors.retry(() => originalRead.call(client, params), options);
    } else {
      // Use standard retry policy for other resources
      return originalRead.call(client, params);
    }
  };
  
  return client;
}

// Apply the strategy
const enhancedClient = patientRetryStrategy(client);
```

For more examples, see the `/example/error-handling-example.js` file in the FHIR.js repository.
