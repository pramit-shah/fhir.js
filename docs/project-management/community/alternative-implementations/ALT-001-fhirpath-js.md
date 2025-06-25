# ALT-001: FHIRpath.js - Alternative FHIR.js Implementation

## Alternative Implementation Information

- **Title**: FHIRpath.js
- **Author**: @fhir-innovator
- **Date Submitted**: 2025-06-15
- **Repository URL**: [https://github.com/fhir-innovator/fhirpath.js]

## Implementation Overview

FHIRpath.js is an alternative implementation of a FHIR client in JavaScript that takes a fundamentally different approach by centering all operations around the FHIRPath specification. It provides a unified query language for both client-side filtering and server interactions.

## Key Differences

1. **FHIRPath-centric**: All operations, including search and filtering, use FHIRPath expressions
2. **Streaming-first**: Built with a streaming architecture from the ground up
3. **Zero dependencies**: No external dependencies required
4. **Functional programming model**: Immutable data structures and pure functions
5. **Advanced caching**: Graph-based caching with relationship awareness

## Technical Approach

FHIRpath.js uses a fundamentally different architecture:

- Core operations are implemented as FHIRPath evaluators
- Resources are treated as immutable data structures
- Network operations use modern browser streaming APIs where available
- Operations can be composed as transformation pipelines
- Internal representation optimized for memory efficiency with structural sharing

## Features

- FHIRPath evaluation engine (Complete)
- FHIR search using FHIRPath expressions (Enhanced)
- Streaming resource processing (New)
- Memory-efficient resource handling (Enhanced)
- Static type generation from FHIR structure definitions (New)
- Built-in validation using FHIRPath (Enhanced)
- Offline-first capabilities with conflict resolution (New)

## Performance Characteristics

Performance benchmarks show significantly better memory usage for large bundles:

| Operation | FHIR.js | FHIRpath.js | Improvement |
|-----------|---------|-------------|-------------|
| Parse 10K bundle | 450MB peak | 120MB peak | 73% lower |
| Search processing | 300ms | 80ms | 73% faster |
| Reference resolution | O(n²) | O(n log n) | Scales better |

## Integration Possibilities

Several techniques from FHIRpath.js could be integrated into the main FHIR.js project:

1. Streaming bundle processing approach
2. Memory-efficient resource representation
3. FHIRPath-based filtering for client-side operations
4. Structural sharing for immutable data operations

## License and Compatibility

FHIRpath.js is released under the MIT license, which is compatible with FHIR.js. The author has expressed willingness to contribute specific components back to FHIR.js.

## Community Adoption

FHIRpath.js currently has approximately 300 GitHub stars and is being used by several specialized FHIR applications that require high performance with large datasets. It has a small but active community of contributors.

## Review Notes

FHIRpath.js takes an innovative approach that excels for specific use cases but may be more complex than necessary for simpler applications. The streaming architecture and memory optimizations are particularly noteworthy.

## Lessons Learned

Key takeaways from reviewing this implementation:

1. FHIRPath expressions offer a powerful unified approach to querying and filtering
2. Streaming architectures provide significant benefits for large dataset handling
3. Immutable data structures simplify complex state management
4. Memory usage can be dramatically reduced with careful resource representation

## Status

- **Review Date**: 2025-06-24
- **Reviewed By**: Performance Team
- **Status**: Considering Features

## Action Items

- [ ] Investigate streaming bundle processing for PERF-001
- [ ] Evaluate FHIRPath-based client-side filtering for potential inclusion
- [ ] Benchmark memory usage techniques for large bundles
- [ ] Consider collaboration with FHIRpath.js author on reference resolution improvements
