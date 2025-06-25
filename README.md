# fhir.js

## Major Improvements (2025)

- Modernized build system: Webpack 5, latest Mocha/Karma, and CoffeeScript 2 support
- TypeScript definitions included and auto-discovered by editors
- Node.js 14+ and browser support (with ES modules and bundlers)
- Peer dependencies for Angular and jQuery for better compatibility
- Removed Bower and legacy scripts
- Improved multi-resource FHIR search (including _has and chained queries)
- Comprehensive error handling system with classification, retry policies, and error reporting
- Advanced dependency management with feature detection and fallbacks
- Multi-level logging system with contextual information and performance tracking
- Enhanced adapters (Node.js, Angular, jQuery, YUI) with consistent error handling
- Example scripts for Node.js and browser usage, including error handling scenarios
- Advanced resource caching with smart invalidation and persistence options
- Memory optimization and performance tuning for high-volume applications
- Priority-based request handling with optimized batch processing
- Server health monitoring and adaptive retry mechanisms
- Funding and maintainers info added
- Comprehensive project management documentation and issue tracking system

For detailed information about the project management, issue tracking, and roadmap, see the [Project Management Documentation](/docs/project-management/PROJECT_MANAGEMENT_INDEX.md).

## Security Considerations

This library provides adapters for multiple frameworks, including some legacy frameworks that have known security vulnerabilities:

- The AngularJS adapter depends on the original AngularJS framework, which is deprecated and has unfixed security vulnerabilities
- We recommend using the Native adapter (for browsers) or Node.js adapter for modern applications
- See [SECURITY.md](SECURITY.md) for detailed information about security policies and recommendations

## Goals

- Support FHIR CRUD operations
- Friendly and expressive query syntax
- Support for adapters that provide idiomatic interfaces in angular, jQuery, extjs, etc
- Support for access control (HTTP basic, OAuth2, Cookies)
- ...

## Development

`Node.js` is required for build.

We recommend installing Node.js using [nvm](https://github.com/nvm-sh/nvm)

Build & test:

```bash
git clone https://github.com/FHIR/fhir.js
cd fhir.js
npm install

# build fhir.js
npm run build

# run tests in node
npm run test

# run tests in browser/karma
npm run integrate
```

## TypeScript

TypeScript definitions are included. Use `import fhir from 'fhir.js'` in your TS project.

## Advanced Features

### Error Handling

The library includes a comprehensive error handling system that provides:

```javascript
// Register a custom error reporter
client.errors.registerErrorReporter(function(error) {
  console.error(`Error: ${error.userMessage}`);
  
  // Log to monitoring service in production
  if (process.env.NODE_ENV === 'production') {
    sendToMonitoringService({
      message: error.userMessage,
      type: error.classification,
      status: error.status,
      url: error.url
    });
  }
});

// Check if an error is retriable
const canRetry = client.errors.isRetriable(error);

// Implement retry with exponential backoff
client.errors.retry(failingOperation, { 
  maxRetries: 3, 
  initialDelay: 1000,
  factor: 2,
  jitter: true
})
.then(result => console.log('Success after retry!', result))
.catch(error => console.error('All retries failed', error));
```

Error types available include:

- `NETWORK`: Network connectivity issues
- `TIMEOUT`: Request timeouts
- `AUTH`: Authentication/authorization failures
- `SERVER`: Server-side errors (5xx)
- `VALIDATION`: Invalid requests (400, 422)
- `CLIENT`: Other client errors
- `PARSING`: Response parsing failures
- `REFERENCE`: Invalid resource references
- `PROFILE`: FHIR profile validation failures

### Dependency Management

The library includes a dependency management system:

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

### Logging System

The library includes a flexible logging system:

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

See the [error-handling-example.js](example/error-handling-example.js) for more examples of these features.

## Browser Builds

Use the files in `dist/` after running `npm run build`.

## Bower

Bower is no longer supported. See REMOVED_BOWER_README_NOTICE.md for details.

## Enhanced Integration Features

- **Cross-version compatibility**: Automatically handles both DSTU2 and R4 bundle formats
- **Enhanced HTTP**: Configurable timeouts, retries, and abort capability
- **Fetch API adapter**: Easy integration with modern Fetch API instead of XMLHttpRequest
- **Reference resolution**: Improved handling of references across different FHIR versions
- **Response caching**: Optional middleware for caching GET responses
- **Multi-resource search**: Support for complex cross-resource queries with _has parameters
- **Chainable middleware**: Compose your own middleware stack
- **Seamless integration**: Combined multi-resource search and reference resolution

### Working with Enhanced Features

#### Enhanced HTTP with timeouts and retries

```js
// Configure enhanced HTTP with timeouts and retries
const client = fhir({
  baseUrl: 'http://myfhirserver.com/fhir',
  useEnhancedHttp: true,  // Enabled by default
  timeout: 10000,         // 10 second timeout
  retries: 2,             // Retry failed requests twice
  retryDelay: 1000        // Wait 1 second between retries
}, adapter);

// The client's requests can be aborted if needed
const promise = client.search({type: 'Patient'});
// Later if needed:
if (promise.abort) {
  promise.abort(); // Cancel the request
}
```

#### Working with the Fetch API

```js
// Create a client using the Fetch API instead of XMLHttpRequest
const fetchAdapter = fhir.fetchAdapter(fetch, {
  credentials: 'include', // Include cookies in cross-origin requests
  timeout: 30000          // 30 second timeout
});

const client = fhir({
  baseUrl: 'http://myfhirserver.com/fhir'
}, fetchAdapter);
```

#### Multi-resource searching with _has parameter

```js
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

#### Combined search and reference resolution

```js
// Search and automatically resolve references in one operation
const searchParams = {
  type: 'Patient', 
  query: {
    $has: {
      'Coverage.beneficiary': {
        status: 'active'
      }
    },
    $include: {
      Patient: 'organization'
    }
  }
};

// References to resolve
const resolveParams = ['Patient.managingOrganization'];

// Combined search and reference resolution
fhir.integration.searchWithReferences(client, searchParams, resolveParams)
  .then(results => {
    // Access the search results
    const patients = results.data.entry;
    
    // Access resolved references
    const orgReference = 'Organization/123';
    const organization = results.resolvedReferences[orgReference];
    
    console.log(`Patient is managed by ${organization.name}`);
  });
```

#### Response caching

```js
// Create a cache middleware with 5 minute TTL
const cacheMiddleware = fhir.cacheMiddleware({
  ttl: 300000,  // 5 minutes in milliseconds
  size: 100     // Store up to 100 responses
});

// Apply to an existing adapter
const originalAdapter = client._adapter;
const cachedAdapter = {
  defer: originalAdapter.defer,
  http: cacheMiddleware(originalAdapter.http)
};

// Create a new client with caching
const cachedClient = fhir({
  baseUrl: 'http://myfhirserver.com/fhir'
}, cachedAdapter);

// Now repeated GET requests will use the cache
cachedClient.read({type: 'Patient', id: '123'});
```

#### Normalizing bundle formats

```js
// Works with both R4 and DSTU2 bundle formats
client.search({type: 'Patient'})
  .then(bundle => {
    // Normalize bundle to have consistent access patterns
    const normalized = fhir.integration.normalizeBundle(bundle);
    
    // Now all entries have both .resource and .content properties
    normalized.entry.forEach(entry => {
      console.log(entry.resource.id);  // Works for both R4 and DSTU2
    });
  });
```

## Documentation

- [API Reference](./docs/API.md)
- [Error Handling Guide](./docs/ERROR_HANDLING.md)
- [Performance Optimization Guide](./docs/PERFORMANCE_OPTIMIZATION.md)
- [Integration Examples](./docs/INTEGRATION.md)









This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.## LicenseContributions are welcome! Please open issues or pull requests on GitHub. See our [Security Policy](./SECURITY.md) for reporting vulnerabilities.## Contributing## Scripts

- `npm run build`: Build the project
- `npm run test`: Run tests in Node.js
- `npm run integrate`: Run tests in browser/karma
- `npm run dev`: "npm run webpack:watch & npm run coffee:watch"
