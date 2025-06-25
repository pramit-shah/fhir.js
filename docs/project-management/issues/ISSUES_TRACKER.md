# FHIR.js Issues Tracker

This document tracks known issues, planned improvements, and enhancement requests for the FHIR.js library.

## Active Issues

### Build & Release

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| BUILD-001 | Syntax Error in src/complexity.js | High | Active |
| RELEASE-001 | NPM Publishing Process Failures | High | Active |
| DEP-001 | Outdated Dependencies Requiring Modernization | High | Active |

### Security

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| SEC-001 | Security audit recommended for deprecated adapters (YUI, AngularJS) | High | In Progress |
| SEC-002 | Implement Content Security Policy compatibility checks | Medium | Planned |
| SEC-003 | Add CORS configuration documentation | Medium | Completed |

### Performance

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| PERF-001 | Memory usage optimization for large bundle processing | High | In Progress |
| PERF-002 | Implement request batching for search operations | Medium | Completed |
| PERF-003 | Add performance benchmarks | Medium | Planned |
| PERF-004 | Optimize dependency loading for browser environments | Low | Planned |

### Functionality

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| FUNC-001 | Support for FHIR R5 resources | Medium | Planned |
| FUNC-002 | Implement GraphQL integration | Medium | Planned |
| FUNC-003 | Add support for SMART on FHIR authentication | High | In Progress |
| FUNC-004 | Improve bulk data import/export capabilities | Medium | Planned |

### Documentation

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| DOC-001 | Comprehensive API documentation | High | In Progress |
| DOC-002 | Additional usage examples | Medium | Planned |
| DOC-003 | Improved TypeScript type definitions | Medium | Planned |
| DOC-004 | Migration guide from other FHIR clients | Low | Planned |

### Testing

| ID | Description | Priority | Status |
|----|-------------|----------|--------|
| TEST-001 | Increase unit test coverage | High | In Progress |
| TEST-002 | Add integration tests with real FHIR servers | Medium | Planned |
| TEST-003 | Implement automated browser tests | Medium | Planned |
| TEST-004 | Add performance regression tests | Low | Planned |
| TEST-005 | CoffeeScript Test Failures and Testing Framework Issues | High | Active |

## Resolved Issues

| ID | Description | Resolution | Version |
|----|-------------|------------|---------|
| BUG-001 | Reference resolution fails with relative URLs | Fixed URL handling logic | 1.0.0 |
| BUG-002 | Memory leak in caching middleware | Implemented proper cache cleanup | 1.0.0 |
| BUG-003 | Error handling inconsistent across adapters | Standardized error format | 1.0.0 |
| FUNC-005 | Support for _has FHIR search parameter | Implemented in search middleware | 1.0.0 |
| DOC-005 | Security documentation missing | Added SECURITY.md | 1.0.0 |

## Enhancement Requests

| ID | Description | Status |
|----|-------------|--------|
| ENH-001 | React/Vue component wrappers | Under Consideration |
| ENH-002 | Server-side rendering support | Under Consideration |
| ENH-003 | Offline mode with ServiceWorker | Under Consideration |
| ENH-004 | WebAssembly acceleration for complex operations | Under Consideration |
| ENH-005 | AI-assisted query building | Under Consideration |

## Issue Reporting

Please report new issues on the GitHub repository: [https://github.com/pramit-shah/fhir.js/issues](https://github.com/pramit-shah/fhir.js/issues)

When reporting issues, please include:

- Library version
- Environment details (browser/Node.js version)
- Minimal reproducible example
- Expected vs. actual behavior
- Any error messages or stack traces
