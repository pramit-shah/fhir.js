# CP-001: Server-Side Rendering Support for React Components

## Proposal Information

- **Proposal Title**: Server-Side Rendering Support for React Components
- **Proposed By**: @react-healthcare-dev
- **Date Submitted**: 2025-06-20
- **Proposal Type**: Enhancement

## Problem Statement

The current React component wrappers in the proposed ENH-001 don't support server-side rendering (SSR), which is critical for applications that need SEO optimization or improved performance on slower connections. This limitation makes it difficult to use FHIR.js with Next.js or similar frameworks that leverage SSR.

## Proposal Summary

Enhance the React component wrappers (from ENH-001) to support server-side rendering by adding appropriate detection of the execution environment and handling data fetching in both client and server contexts.

## Detailed Description

The proposed implementation includes:

1. **Environment Detection**:
   - Add utilities to detect whether code is running on the client or server
   - Conditionally execute certain operations based on the environment

2. **Data Prefetching API**:
   - Create a data prefetching API that works with Next.js `getServerSideProps` and similar patterns
   - Support hydration of prefetched data on the client

3. **Static Generation Support**:
   - Add support for static generation scenarios where FHIR data is fetched at build time
   - Provide strategies for revalidation and incremental static regeneration

4. **State Serialization**:
   - Implement proper serialization/deserialization of FHIR resource state
   - Handle complex data types that don't serialize well to JSON

5. **Code Example**:

```jsx
// Server-side (in getServerSideProps)
export async function getServerSideProps() {
  const fhirClient = createFhirClient({
    baseUrl: 'https://example.fhir.org/r4',
    // Server-side specific options
    serverContext: true
  });

  const patientData = await fhirClient.prefetchResource('Patient', '123');
  
  return {
    props: {
      initialFhirData: fhirClient.serializeState(patientData)
    }
  };
}

// Client-side component
function PatientViewer({ initialFhirData }) {
  const { data, error } = useFhirResource({
    resourceType: 'Patient',
    id: '123',
    initialData: initialFhirData // Hydration from SSR
  });
  
  // Render using the data...
}
```

## Benefits

- Enables use of FHIR.js in SSR applications like Next.js
- Improves initial page load performance
- Supports SEO requirements for healthcare applications
- Provides consistent data between server and client renders
- Works with static site generation for public-facing health resources

## Drawbacks

- Increases complexity of the React wrapper implementation
- Requires additional testing across different rendering strategies
- Potential bundle size increase if not carefully implemented
- May require separate handling for certain authentication scenarios

## Alternative Approaches

1. **Client-side only**: Keep the implementation client-side only, but this fails to meet SSR requirements
2. **Separate packages**: Create separate packages for SSR and client-side, but this complicates maintenance
3. **Framework-specific adapters**: Create specific adapters for Next.js, Remix, etc., which increases maintenance burden

## Integration Plan

This enhancement would be incorporated into the ENH-001 React component wrappers, either as part of the initial implementation or as a follow-up enhancement. Key steps:

1. Add environment detection utilities
2. Implement data prefetching API
3. Add serialization helpers
4. Create SSR-specific examples and documentation
5. Test across different SSR frameworks (Next.js, Remix, etc.)

## Testing Strategy

1. Unit tests for environment detection
2. Integration tests with a simplified Next.js application
3. Tests for data serialization/deserialization
4. Performance tests comparing SSR vs. client-side-only rendering

## Community Feedback

Initial feedback from @next-js-dev indicated strong support for this feature, noting that many healthcare applications built with Next.js could benefit. Several other community members mentioned this capability would be essential for their production applications.

## Review Status

- **Review Date**: 2025-06-22
- **Reviewed By**: Frontend Team
- **Status**: Under Review
- **Integration Target**: v1.2.0 (with ENH-001)

## Implementation

- **Implementation Status**: Not Started
- **PR Link**: N/A
- **Associated Issues**: ENH-001, GH-123

## Notes

This proposal is dependent on the base implementation of React component wrappers in ENH-001. If ENH-001 is accepted, this proposal should be considered as an enhancement to that implementation.
