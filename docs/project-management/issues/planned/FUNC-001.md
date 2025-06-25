# FUNC-001: Support for FHIR R5 Resources

## Description

Add support for FHIR R5 resources and operations to ensure the library remains compatible with the latest FHIR specification.

## Details

- **Priority**: Medium
- **Status**: Planned
- **Assigned To**: Core Team
- **Created Date**: 2025-06-25
- **Due Date**: 2025-08-15
- **Issue Type**: Functionality

## Background

FHIR R5 introduces several new resources and changes to existing resources. As FHIR implementations begin to adopt R5, FHIR.js needs to support these new resources and operations to remain relevant and useful for developers working with the latest FHIR servers.

## Tasks

- [ ] Analyze changes between FHIR R4 and R5
- [ ] Update resource handling code to support R5 resources
- [ ] Add support for new R5-specific operations
- [ ] Implement version detection for automatic handling
- [ ] Update documentation with R5 examples
- [ ] Create tests for R5-specific functionality
- [ ] Add R5 compatibility mode configuration option

## Acceptance Criteria

- Library correctly handles all R5 resources
- Library correctly executes R5-specific operations
- Automatic version detection works for R4 and R5 servers
- Documentation clearly explains R5 support and usage
- Tests validate R5 functionality

## Dependencies

- Access to FHIR R5 test server

## References

- [FHIR R5 Specification](http://hl7.org/fhir/R5/)
- [R4 to R5 Changes](http://hl7.org/fhir/R5/diff.html)

## Notes

This feature will be part of the v1.2.0 release as outlined in the roadmap.
