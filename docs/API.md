# FHIR.js API Reference

This document provides detailed API documentation for FHIR.js.

## Table of Contents

- [Installation](#installation)
- [Initialization](#initialization)
- [Core FHIR Operations](#core-fhir-operations)
  - [Read](#read)
  - [Create](#create)
  - [Update](#update)
  - [Delete](#delete)
  - [Search](#search)
  - [History](#history)
  - [Transaction](#transaction)
  - [Operation](#operation)
- [Enhanced Features](#enhanced-features)
  - [Error Handling](#error-handling)
  - [Dependency Management](#dependency-management)
  - [Logging](#logging)
  - [Caching](#caching)
  - [Retry Mechanism](#retry-mechanism)
  - [Multi-resource Search](#multi-resource-search)
  - [Reference Resolution](#reference-resolution)
- [Adapters](#adapters)
  - [Node.js Adapter](#nodejs-adapter)
  - [Native Browser Adapter](#native-browser-adapter)
  - [jQuery Adapter](#jquery-adapter)
  - [AngularJS Adapter](#angularjs-adapter)
  - [YUI Adapter (Deprecated)](#yui-adapter-deprecated)
- [Middleware](#middleware)
  - [Core Middleware](#core-middleware)
  - [Authorization Middleware](#authorization-middleware)
  - [Patient Context Middleware](#patient-context-middleware)
  - [Custom Middleware](#custom-middleware)
- [TypeScript Support](#typescript-support)
- [Examples](#examples)

## Installation

### npm

```bash
npm install fhir-js-enhanced --save
```

### Direct Download

Download the bundled file from the [releases page](https://github.com/pramit-shah/fhir.js/releases).

## Initialization

### Basic Initialization

```javascript
// Node.js
const fhir = require('fhir.js');

// ES Modules
import fhir from 'fhir.js';

// Create a client instance
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  credentials: 'same-origin'
});
```

### With Configuration Options

```javascript
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  auth: {
    bearer: 'TOKEN'
  },
  credentials: 'include',
  headers: {
    'Accept': 'application/fhir+json',
    'X-Custom-Header': 'value'
  },
  timeout: 10000,
  retries: 3,
  retryDelay: 1000,
  cache: {
    enabled: true,
    maxSize: 100,
    ttl: 60 * 1000 // 1 minute
  },
  patient: 'patient-id', // For patient-compartment requests
  debug: true
});
```

## Core FHIR Operations

### Read

Retrieve a resource by its id.

```javascript
client.read({ type: 'Patient', id: '123' })
  .then(response => {
    console.log('Patient resource:', response.data);
  })
  .catch(error => {
    console.error('Error reading patient:', error);
  });
```

#### Parameters

- `type` (string): The resource type
- `id` (string): The resource id

### Create

Create a new resource.

```javascript
const newPatient = {
  resourceType: 'Patient',
  name: [{ given: ['John'], family: 'Doe' }],
  gender: 'male',
  birthDate: '1970-01-01'
};

client.create({ type: 'Patient', resource: newPatient })
  .then(response => {
    console.log('Created patient with id:', response.data.id);
  })
  .catch(error => {
    console.error('Error creating patient:', error);
  });
```

#### Parameters

- `type` (string): The resource type
- `resource` (object): The resource object to create

### Update

Update an existing resource.

```javascript
const updatedPatient = {
  resourceType: 'Patient',
  id: '123',
  name: [{ given: ['John'], family: 'Smith' }],
  gender: 'male',
  birthDate: '1970-01-01'
};

client.update({ type: 'Patient', id: '123', resource: updatedPatient })
  .then(response => {
    console.log('Updated patient:', response.data);
  })
  .catch(error => {
    console.error('Error updating patient:', error);
  });
```

#### Parameters

- `type` (string): The resource type
- `id` (string): The resource id
- `resource` (object): The updated resource object

### Delete

Delete a resource.

```javascript
client.delete({ type: 'Patient', id: '123' })
  .then(response => {
    console.log('Deleted patient:', response);
  })
  .catch(error => {
    console.error('Error deleting patient:', error);
  });
```

#### Parameters

- `type` (string): The resource type
- `id` (string): The resource id

### Search

Search for resources.

```javascript
client.search({ type: 'Patient', query: { name: 'smith', _count: 10 } })
  .then(response => {
    console.log('Found patients:', response.data);
    console.log('Total count:', response.data.total);
    response.data.entry.forEach(entry => {
      console.log('Patient:', entry.resource);
    });
  })
  .catch(error => {
    console.error('Error searching for patients:', error);
  });
```

#### Parameters

- `type` (string): The resource type
- `query` (object): The search parameters
  - Standard FHIR search parameters
  - Special parameters:
    - `$has`: Cross-resource search with _has parameter
    - `$include`: Resource inclusion
    - `$revInclude`: Reverse inclusion

#### Advanced Search Example

```javascript
client.search({
  type: 'Patient',
  query: {
    name: 'smith',
    gender: 'female',
    'address-city': 'Boston',
    _count: 10,
    _sort: '-birthDate',
    $has: {
      'Observation.subject': {
        code: 'http://loinc.org|8480-6',
        'value-quantity': 'gt140'
      }
    },
    $include: {
      Patient: 'organization'
    }
  }
})
.then(handleResponse)
.catch(handleError);
```

### History

Get the history of a resource or type.

```javascript
// Resource history
client.history({ type: 'Patient', id: '123' })
  .then(response => {
    console.log('History:', response.data);
  });

// Type history
client.typeHistory({ type: 'Patient' })
  .then(response => {
    console.log('Type history:', response.data);
  });

// System history
client.systemHistory()
  .then(response => {
    console.log('System history:', response.data);
  });
```

#### Parameters

- `type` (string): The resource type
- `id` (string, optional): The resource id for resource history
- `query` (object, optional): History search parameters (_count, _since, etc.)

### Transaction

Execute a FHIR transaction bundle.

```javascript
const transactionBundle = {
  resourceType: 'Bundle',
  type: 'transaction',
  entry: [
    {
      request: {
        method: 'POST',
        url: 'Patient'
      },
      resource: {
        resourceType: 'Patient',
        name: [{ given: ['John'], family: 'Doe' }]
      }
    },
    {
      request: {
        method: 'GET',
        url: 'Patient?name=smith'
      }
    }
  ]
};

client.transaction({ bundle: transactionBundle })
  .then(response => {
    console.log('Transaction results:', response.data);
  })
  .catch(error => {
    console.error('Transaction error:', error);
  });
```

#### Parameters

- `bundle` (object): The transaction bundle

### Operation

Execute a FHIR operation.

```javascript
// System level operation
client.operation({
  name: 'validate',
  method: 'POST',
  resource: { resourceType: 'Patient', name: [{ family: 'Smith' }] }
})
.then(response => console.log('Validation result:', response.data));

// Type level operation
client.operation({
  name: 'validate',
  type: 'Patient',
  method: 'POST',
  resource: { resourceType: 'Patient', name: [{ family: 'Smith' }] }
})
.then(response => console.log('Validation result:', response.data));

// Instance level operation
client.operation({
  name: 'everything',
  type: 'Patient',
  id: '123'
})
.then(response => console.log('Everything result:', response.data));
```

#### Parameters

- `name` (string): The operation name
- `type` (string, optional): The resource type for type/instance operations
- `id` (string, optional): The resource id for instance operations
- `method` (string, optional): The HTTP method (default: GET)
- `parameters` (object, optional): URL parameters
- `resource` (object, optional): The resource to send with the operation

## Enhanced Features

### Error Handling

The library provides a comprehensive error handling system.

```javascript
// Register custom error reporter
client.errors.registerErrorReporter(function(error) {
  console.error(`${error.errorType} (${error.status}): ${error.message}`);
  sendToMonitoringService(error);
});

// Check if an error is retriable
if (client.errors.isRetriable(error)) {
  // Retry the operation
}

// Error retry with exponential backoff
client.errors.retry(failingOperation, { 
  maxRetries: 3, 
  initialDelay: 1000,
  factor: 2,
  jitter: true
})
.then(result => console.log('Success after retry!', result))
.catch(error => console.error('All retries failed', error));

// Error types available
console.log(client.errorTypes);
// {
//   NETWORK: 'network_error',
//   TIMEOUT: 'timeout_error',
//   AUTH: 'authentication_error',
//   SERVER: 'server_error',
//   VALIDATION: 'validation_error',
//   CLIENT: 'client_error',
//   PARSING: 'parsing_error',
//   REFERENCE: 'reference_error',
//   PROFILE: 'profile_violation',
//   UNKNOWN: 'unknown_error'
// }
```

### Dependency Management

Manage dependencies and detect environment capabilities.

```javascript
// Register a utility or dependency
client.dependencies.register('formattingUtils', {
  formatDate: date => new Date(date).toISOString().substring(0, 10),
  parseDate: dateStr => new Date(dateStr)
});

// Retrieve a registered dependency
const formatter = client.dependencies.get('formattingUtils');
console.log(formatter.formatDate(new Date()));

// Check for environment features
if (client.dependencies.hasFeature('fetch')) {
  console.log('Native fetch is available!');
}

// Check adapter capabilities
const features = client.dependencies.getFeatures();
console.log('CORS support:', features.cors);
```

### Logging

Configure logging for debugging and monitoring.

```javascript
// Configure global logging
client.logging.configure({
  level: 'info',
  includeTimestamps: true,
  includeComponent: true,
  colorizeConsole: true
});

// Create component-specific loggers
const logger = client.logging.getLogger('myComponent');

// Log at different levels
logger.debug('Detailed debugging information');
logger.info('General operational information');
logger.warn('Potential issues or warnings');
logger.error('Error events that might still allow the application to continue');

// Set log level dynamically
client.logging.setLevel('warn'); // Only warnings and errors will be logged
```

### Caching

Configure caching for improved performance.

```javascript
// Configure cache middleware when creating client
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  cache: {
    enabled: true,
    maxSize: 100,
    ttl: 60000, // 1 minute
    cacheSearchResults: true
  }
});

// Get cache statistics
const cacheStats = client.getCacheStats();
console.log('Cache entries:', cacheStats.totalEntries);
console.log('Cache hit rate:', cacheStats.hitRate);
console.log('Cache by resource type:', cacheStats.byResourceType);

// Clear cache
client.clearCache();

// Clear specific resources
client.clearCache('Patient');
client.clearCache('Patient', '123');
```

### Retry Mechanism

Configure automatic retries for transient failures.

```javascript
// Configure retries when creating client
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  retries: 3,
  retryDelay: 1000,
  advancedRetry: {
    serverErrorRetries: 5,
    networkErrorRetries: 3,
    retryBackoffFactor: 1.5,
    retryJitter: true,
    retryWaitingCallback: (attempt, delay) => {
      console.log(`Retry attempt ${attempt}, waiting ${delay}ms`);
    }
  }
});

// Dynamic retry for specific operation
client.withRetry({ 
  retries: 5,
  priority: 'high'
}).read({ type: 'Patient', id: '123' });
```

### Multi-resource Search

Perform complex searches across multiple resource types.

```javascript
// Find all patients who have observations with high systolic blood pressure
client.search({
  type: 'Patient',
  query: {
    $has: {
      'Observation.subject': {
        'code': 'http://loinc.org|8480-6',
        'value-quantity': 'gt140'
      }
    }
  }
})
.then(handleBundle)
.catch(handleError);

// Find all female patients who have active coverage
client.search({
  type: 'Patient',
  query: {
    gender: 'female',
    $has: {
      'Coverage.beneficiary': {
        status: 'active'
      }
    }
  }
});
```

### Reference Resolution

Resolve references within resources.

```javascript
// Resolve references in a single resource
client.resolve({ 
  resource: patient,
  references: ['Patient.managingOrganization']
})
.then(resolved => {
  console.log('Resolved organization:', resolved.managingOrganization);
});

// Combined search and reference resolution
client.searchWithReferences(
  { type: 'Patient', query: { _count: 5 } },
  ['Patient.managingOrganization', 'Patient.generalPractitioner']
)
.then(results => {
  // Access the search results
  const patients = results.data.entry;
  
  // Access resolved references
  const orgReference = 'Organization/123';
  const organization = results.resolvedReferences[orgReference];
});
```

## Adapters

FHIR.js supports different adapters for various environments.

### Node.js Adapter

```javascript
// CommonJS
const fhir = require('fhir.js/src/adapters/node');

const client = fhir({
  baseUrl: 'http://example.org/fhir',
  auth: {
    bearer: 'TOKEN'
  }
});
```

### Native Browser Adapter

```javascript
// ES Modules
import fhir from 'fhir.js/src/adapters/native';

const client = fhir({
  baseUrl: 'http://example.org/fhir',
  credentials: 'include'
});
```

### jQuery Adapter

```javascript
// With jQuery available globally
import fhir from 'fhir.js/src/adapters/jquery';

const client = fhir({
  baseUrl: 'http://example.org/fhir'
});
```

### AngularJS Adapter

```javascript
// With AngularJS
import fhir from 'fhir.js/src/adapters/angularjs';
import angular from 'angular';

// In your Angular module
angular.module('myApp', [])
  .factory('fhirClient', function() {
    return fhir({
      baseUrl: 'http://example.org/fhir'
    });
  });
```

### YUI Adapter (Deprecated)

```javascript
// Not recommended - see SECURITY.md
import fhir from 'fhir.js/src/adapters/yui';

const client = fhir({
  baseUrl: 'http://example.org/fhir'
});
```

## Middleware

FHIR.js uses middleware for extending functionality.

### Core Middleware

```javascript
// Basic middleware concept
function myMiddleware(client) {
  // Extend client with custom capabilities
  client.customFeature = function() {
    // Implementation
  };
  
  // Return the enhanced client
  return client;
}

// Apply middleware
const enhancedClient = myMiddleware(client);
```

### Authorization Middleware

```javascript
// Create a client with authentication
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  auth: {
    bearer: 'TOKEN'  // Bearer token auth
    // OR
    user: 'username',
    pass: 'password'  // Basic auth
  }
});
```

### Patient Context Middleware

```javascript
// Create a client with patient context
const client = fhir({
  baseUrl: 'http://example.org/fhir',
  patient: '123'  // Patient compartment
});

// Patient-scoped search (automatically adds patient=123)
client.search({ type: 'Observation' });
```

### Custom Middleware

```javascript
// Custom response formatter middleware
function responseFormatter(client) {
  // Store original read function
  const originalRead = client.read;
  
  // Override with enhanced functionality
  client.read = function(params) {
    return originalRead.call(client, params)
      .then(response => {
        // Add formatted data
        response.formatted = {
          resourceSummary: `${response.data.resourceType}/${response.data.id}`
        };
        return response;
      });
  };
  
  return client;
}

// Apply the middleware
const enhancedClient = responseFormatter(client);
```

## TypeScript Support

FHIR.js includes TypeScript definitions.

```typescript
import fhir from 'fhir.js';
import { FhirClient, FhirResource, Bundle, Patient } from 'fhir.js';

const client: FhirClient = fhir({
  baseUrl: 'http://example.org/fhir'
});

async function getPatient(id: string): Promise<Patient> {
  const response = await client.read({ type: 'Patient', id });
  return response.data as Patient;
}

async function searchPatients(name: string): Promise<Bundle> {
  const response = await client.search({ 
    type: 'Patient', 
    query: { name } 
  });
  return response.data as Bundle;
}
```

## Examples

See the `/example` directory for complete, runnable examples:

- Basic CRUD operations
- Search with complex parameters
- Error handling patterns
- Reference resolution
- Caching strategies
- Performance optimization
