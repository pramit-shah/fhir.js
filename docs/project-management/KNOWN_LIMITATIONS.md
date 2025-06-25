# Known Limitations and Open Issues

This document outlines known limitations, challenges, and issues in FHIR.js that require broader community collaboration to address. Unlike standard bugs that can be fixed with straightforward code changes, these items represent architectural, compatibility, or design challenges that benefit from diverse perspectives and expertise.

## How to Contribute

We welcome contributions from the community to help address these challenges:

1. Review the limitations listed below
2. Join discussions in the linked GitHub issues
3. Submit pull requests with proposed solutions
4. Create forks to experiment with alternative approaches
5. Share your use cases and requirements to help refine solutions

For major architectural changes, consider:

- Creating a fork to explore significant redesigns
- Documenting your approach in the GitHub issue
- Sharing benchmarks or performance metrics
- Contributing to the decision-making process

## Current Limitations

### 1. Cross-Version FHIR Compatibility

**Issue:** Supporting multiple FHIR versions (DSTU2, STU3, R4, R5) simultaneously is challenging due to breaking changes between versions.

**GitHub Issue:** [#GITHUB-123](https://github.com/your-org/fhir.js/issues/123)

**Impact:**
- Applications must target specific FHIR versions
- Multiple adapter instances needed for cross-version support
- Reference resolution may fail across version boundaries

**Community Approaches:**
- Version detection and automatic adaptation
- Version-specific middleware layers
- Profile-based normalization

### 2. Large Bundle Performance

**Issue:** Processing very large FHIR bundles (>1000 resources) can cause performance issues, particularly in browser environments.

**GitHub Issue:** [#GITHUB-124](https://github.com/your-org/fhir.js/issues/124)

**Impact:**
- Memory usage spikes during large bundle processing
- Possible browser tab crashes with extremely large datasets
- Performance degradation in mobile browsers

**Community Approaches:**
- Streaming processing of bundles
- Pagination and partial processing strategies
- Worker thread processing in browser environments

### 3. Legacy Framework Support

**Issue:** Supporting deprecated frameworks (AngularJS, YUI) creates security and maintenance challenges.

**GitHub Issue:** [#GITHUB-125](https://github.com/your-org/fhir.js/issues/125)

**Impact:**
- Increased attack surface due to framework vulnerabilities
- Maintenance burden for deprecated code paths
- Potentially misleading for new users who might adopt deprecated patterns

**Community Approaches:**
- Migration utilities for legacy frameworks
- Clear deprecation timelines and warnings
- Modularized adapter system for better isolation

### 4. Resource Graph Navigation

**Issue:** Reference resolution and resource graph navigation across deeply nested structures is inefficient and sometimes inconsistent.

**GitHub Issue:** [#GITHUB-126](https://github.com/your-org/fhir.js/issues/126)

**Impact:**
- Complex queries require multiple round-trips
- Circular references can cause infinite loops
- Performance degrades with deep resource graphs

**Community Approaches:**
- Graph-based data models
- Intelligent prefetching based on common patterns
- GraphQL-inspired resolution strategies

### 5. Offline Support Limitations

**Issue:** The current caching system doesn't fully support robust offline-first operations.

**GitHub Issue:** [#GITHUB-127](https://github.com/your-org/fhir.js/issues/127)

**Impact:**
- Applications requiring offline support need custom solutions
- Cache invalidation strategies are limited
- Conflict resolution during sync is not standardized

**Community Approaches:**
- IndexedDB-based persistent storage
- Conflict resolution strategies
- Delta synchronization protocols

### 6. SMART on FHIR Integration

**Issue:** Integration with SMART on FHIR authentication flows is currently implemented through examples rather than core features.

**GitHub Issue:** [#GITHUB-128](https://github.com/your-org/fhir.js/issues/128)

**Impact:**
- Developers must implement auth flows separately
- Inconsistent approaches across implementations
- Potential security issues with custom implementations

**Community Approaches:**
- First-class SMART on FHIR support
- OAuth 2.0 middleware components
- Pluggable authentication providers

### 7. TypeScript Definition Completeness

**Issue:** TypeScript definitions don't cover all FHIR resource types and operations comprehensively.

**GitHub Issue:** [#GITHUB-129](https://github.com/your-org/fhir.js/issues/129)

**Impact:**
- Reduced developer experience for TypeScript users
- Manual type assertions required in many cases
- Incomplete IntelliSense/autocomplete support

**Community Approaches:**
- Code generation from FHIR specification
- Community-maintained type definitions
- Integration with existing FHIR TypeScript libraries

## Architectural Challenges

These challenges may require significant architectural changes that benefit from community collaboration:

### 1. Reactive Programming Model

**Issue:** The current callback/promise-based API doesn't integrate well with reactive programming models.

**GitHub Issue:** [#GITHUB-130](https://github.com/your-org/fhir.js/issues/130)

**Community Approaches:**
- RxJS integration options
- Observable-based API layer
- Event-driven architecture alternatives

### 2. Binary Resource Handling

**Issue:** Large binary resources (images, documents) lack optimized handling, particularly for browser environments.

**GitHub Issue:** [#GITHUB-131](https://github.com/your-org/fhir.js/issues/131)

**Community Approaches:**
- Streaming uploads/downloads
- Integration with browser File API
- Chunked transfer implementations

### 3. Bulk Data API Support

**Issue:** Limited support for FHIR Bulk Data API operations impedes large dataset operations.

**GitHub Issue:** [#GITHUB-132](https://github.com/your-org/fhir.js/issues/132)

**Community Approaches:**
- Asynchronous job handling
- Parallelized data processing
- Progress tracking and resumable transfers

## Contributing to These Challenges

We encourage you to:

1. Join the discussion in the linked GitHub issues
2. Create experimental forks to test different approaches
3. Submit PRs with incremental improvements
4. Share use cases that illuminate requirements
5. Contribute to documentation and examples

Your input is invaluable in addressing these complex challenges!
