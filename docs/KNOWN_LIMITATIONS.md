# Known Limitations and Unfixable Issues

This document tracks issues and limitations in FHIR.js that cannot be fixed due to technical constraints, architectural decisions, or compatibility requirements. Documenting these issues helps users understand the boundaries of the library and possible workarounds.

## Technical Limitations

### 1. Legacy Adapter Security Issues

**Issue**: Security vulnerabilities in deprecated adapters (YUI, AngularJS)

**Why It Cannot Be Fixed**: These vulnerabilities exist in the underlying frameworks that are no longer maintained by their original developers.

**Workaround**: Use modern adapters (Native, Node.js) which do not have these security issues.

**Reference**: [SEC-001](/docs/project-management/issues/active/SEC-001.md), [Security Audit](/docs/project-management/audits/SECURITY-AUDIT-2025-06-20.md)

### 2. Memory Usage with Large Bundles

**Issue**: Processing very large FHIR bundles (10,000+ resources) can lead to high memory usage in constrained environments like browsers.

**Why It Cannot Be Fixed Completely**: JavaScript's memory model and the need to maintain bundle integrity during processing creates a fundamental limitation.

**Partial Fix**: Memory usage optimizations have been implemented to reduce the impact ([PERF-001](/docs/project-management/issues/active/PERF-001.md)), but the issue cannot be eliminated entirely.

**Workaround**: Use server-side processing for very large bundles or implement streaming approaches when supported by the FHIR server.

## Compatibility Constraints

### 1. ES5 Support Limitations

**Issue**: Some advanced features require ES6+ environments.

**Why It Cannot Be Fixed**: Supporting older environments would require significant code duplication and maintenance burden.

**Workaround**: Use transpilation tools like Babel for deployment to ES5-only environments, but be aware that some features may have reduced functionality.

### 2. Internet Explorer Compatibility

**Issue**: Limited support for Internet Explorer 11.

**Why It Cannot Be Fixed**: Providing full support would require extensive polyfills and workarounds that would impact performance for all users.

**Workaround**: Basic functionality is supported with polyfills, but advanced features require modern browsers.

## Architectural Limitations

### 1. Synchronous Reference Resolution

**Issue**: Reference resolution must be done asynchronously, which can complicate certain usage patterns.

**Why It Cannot Be Fixed**: The nature of FHIR references often requires server requests, which are inherently asynchronous.

**Workaround**: Preload resources when possible and utilize the caching middleware to minimize asynchronous operations.

### 2. Bundle Size Impact with All Features

**Issue**: Including all features results in a large bundle size.

**Why It Cannot Be Fixed**: The comprehensive nature of FHIR requires significant code.

**Workaround**: Use tree-shaking with modern bundlers to only include required features.

## Integration with External Systems

### 1. SMART on FHIR Integration Complexity

**Issue**: Complex integration with some SMART on FHIR implementations.

**Why It Cannot Be Fixed Within FHIR.js**: The varying implementations of SMART on FHIR across different EHR systems makes full compatibility difficult to achieve.

**Workaround**: Use adapter patterns for specific EHR systems.

## Adding to This Document

If you discover an issue that cannot be fixed due to fundamental limitations, please document it here by following these steps:

1. Create a GitHub issue describing the limitation in detail
2. Create a tracking document in the appropriate location
3. Add an entry to this document with a clear explanation of why it cannot be fixed
4. Include workarounds where possible

This information helps set appropriate expectations for users of the library and guides them toward successful implementation patterns.
