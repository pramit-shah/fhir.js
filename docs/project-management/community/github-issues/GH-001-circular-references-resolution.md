# GH-001: Reference Resolution Fails with Circular References

## GitHub Issue Reference

- **GitHub Issue URL**: [https://github.com/example/fhir.js/issues/1]
- **Original Reporter**: @healthcare-dev-123
- **Date Reported**: 2025-05-10
- **Issue Type**: Bug
- **Associated Internal Issue**: BUG-005

## Summary

Reference resolution fails when circular references exist between resources, causing an infinite loop and eventually a stack overflow error.

## Details

When two FHIR resources reference each other (e.g., a Patient resource references a RelatedPerson, and that RelatedPerson references back to the Patient), attempting to resolve references will enter an infinite loop.

Steps to reproduce:

1. Create a Patient resource with a link to a RelatedPerson
2. Create a RelatedPerson resource with a patient reference back to the original Patient
3. Attempt to resolve references in either resource

Expected: The reference resolution should detect circular references and handle them gracefully.
Actual: The process enters an infinite loop, eventually causing a stack overflow error.

## Community Discussion

Several community members confirmed experiencing this issue. User @fhir-expert-456 suggested implementing cycle detection in the reference resolution algorithm.

User @medical-systems-dev shared a workaround using a custom middleware that tracks visited references.

## Current Status

- **Status**: Cannot Fix Completely
- **Last Updated**: 2025-06-15
- **Assigned To**: Core Team

## Internal Assessment

### Technical Evaluation

The issue stems from the recursive nature of the reference resolution algorithm. While we can implement cycle detection, this adds overhead to every reference resolution, potentially impacting performance for the common case where no cycles exist.

Additionally, the FHIR specification does not clearly define how circular references should be handled during resolution, making it difficult to implement a solution that works for all use cases.

### Impact Analysis

- **Severity**: Medium
- **Affected Users**: Users working with complex resource relationships, particularly in healthcare systems with family relationships
- **Workarounds Available**: Yes - implement custom middleware to track and break cycles

### Action Plan

- [x] Add cycle detection in reference resolution (implemented partially)
- [x] Document limitation and workarounds
- [x] Add example of custom middleware to handle circular references
- [ ] Consider configuration option to enable/disable strict cycle detection

## Resolution

This issue cannot be fully fixed without significant performance implications for all users. Instead, we have:

1. Implemented basic cycle detection that prevents crashes but may not resolve all references in circular structures
2. Documented the limitation in the Known Limitations document
3. Provided example code for a custom middleware that users can employ for more sophisticated cycle handling

## Notes

This is an inherent challenge in any system that needs to resolve potentially circular references. Most FHIR servers and clients face similar challenges.
