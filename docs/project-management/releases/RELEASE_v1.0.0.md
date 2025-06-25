# FHIR.js Release Notes

## Version 1.0.0 (June 25, 2025)

### Major Features

- **Modernized Build System**:
  - Upgraded to Webpack 5
  - Support for latest Mocha/Karma
  - Full CoffeeScript 2 compatibility
  - TypeScript definitions included and auto-discovered by editors

- **Error Handling System**:
  - Comprehensive error classification (network, timeout, auth, server, etc.)
  - Smart retry policies with exponential backoff and jitter
  - Custom error reporters
  - Contextual debugging information
  - Error enrichment with FHIR context

- **Dependency Management**:
  - Environment feature detection
  - Framework capability reporting
  - Dependency registration and retrieval
  - Fallbacks for missing dependencies
  - Cross-browser compatibility layer

- **Enhanced Logging**:
  - Multiple log levels (debug, info, warn, error)
  - Component-specific logging
  - Performance tracking with timing information
  - Request/response logging
  - Dynamic log level adjustment

- **Advanced Resource Caching**:
  - Smart cache invalidation
  - Version-aware caching
  - LRU cache with configurable TTL
  - Search result caching
  - Bundle resource caching

- **Multi-resource FHIR Search**:
  - Support for _has parameters
  - Chained queries
  - Includes and reverse includes
  - Combined search and reference resolution
  - Search result normalization

### Notable Improvements

- **Security Enhancements**:
  - Security documentation and vulnerability management
  - Adapter security warnings
  - CORS support improvements
  - Authentication improvements

- **Browser Support**:
  - ES modules and bundler compatibility
  - Modern browser APIs with fallbacks
  - Native adapter improvements
  - AbortController support for cancelling requests

- **Node.js Support**:
  - Node.js 14+ compatibility
  - Native fetch support
  - Improved HTTP client
  - Better error handling

- **Performance Optimization**:
  - Memory usage reduction
  - Request batching
  - Connection pooling
  - Priority-based request handling

### Breaking Changes

- Removed Bower support (see REMOVED_BOWER_README_NOTICE.md)
- Angular adapter now requires Angular 1.8.3+
- jQuery adapter now requires jQuery 3.0.0+
- Deprecated YUI adapter (still available but with security warnings)
- Changed error handling API

### Bug Fixes

- Fixed reference resolution in bundles
- Corrected URL handling for relative paths
- Improved error reporting for network issues
- Fixed memory leaks in caching middleware
- Addressed TypeScript definition issues

### Documentation

- Added API Reference
- Created Error Handling Guide
- Developed Performance Optimization Guide
- Added Integration Examples
- Included Security Guidelines

## Upgrading from Previous Versions

### From 0.x to 1.0

1. Update your dependencies:

   ```bash
   npm install fhir-js-enhanced@latest
   ```

2. If using Bower:
   - Migrate to npm (see REMOVED_BOWER_FILES_NOTICE.md for instructions)

3. Update imports:
   - TypeScript/ES modules: `import fhir from 'fhir.js'`
   - CommonJS: `const fhir = require('fhir.js')`

4. Review adapter-specific changes:
   - Angular: Ensure using version 1.8.3+
   - jQuery: Ensure using version 3.0.0+
   - YUI: Consider migrating to native or node adapter

5. Update error handling code to use new error types:

   ```javascript
   if (error.errorType === client.errorTypes.AUTH) {
     // Handle authentication errors
   }
   ```

## Future Plans

- Enhanced TypeScript support
- Expanded test coverage
- GraphQL integration
- FHIR R5 support
- Web Components integration
