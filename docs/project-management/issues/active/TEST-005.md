# TEST-005: CoffeeScript Test Failures and Testing Framework Issues

## Description

The test suite contains CoffeeScript files that are failing to run properly with current Node.js versions and build tools. This prevents comprehensive testing and blocks releases.

## Details

- **Priority**: High
- **Status**: Active
- **Assigned To**: Testing Team
- **Created Date**: 2024-06-01
- **Due Date**: 2024-06-30
- **Issue Type**: Testing

## Background

The FHIR.js project uses CoffeeScript for many of its test files, which is an older technology that's becoming increasingly difficult to maintain with modern Node.js environments. During the Node.js version update (from 6.2/8/10 to 14/16/18/20), many of these tests started failing due to compatibility issues with the test runner and CoffeeScript compilation.

A first attempt at migrating one test file from CoffeeScript to JavaScript has been made (`test/cacheSpec.coffee` to `test/cacheSpec.js`), but a comprehensive solution for all test files is needed.

## Tasks

- [ ] Audit all CoffeeScript test files in the project
- [ ] Determine if the testing framework needs to be updated or replaced
- [ ] Create a migration plan for test files (CoffeeScript to JavaScript)
- [ ] Update the test configuration (mocha, karma) to work with modern Node.js
- [ ] Migrate high-priority test files to JavaScript
- [ ] Create a testing guide for contributors
- [ ] Update CI configuration to run tests properly

## Acceptance Criteria

- All tests run successfully on Node.js versions 14, 16, 18, and 20
- Testing framework is updated to current versions
- Critical test files are migrated to JavaScript
- CI pipeline executes tests correctly

## Dependencies

- Related to BUILD-001 (syntax errors)
- May require updates to development dependencies in package.json

## References

- Mocha documentation
- CoffeeScript to JavaScript conversion guides
- Existing test migration example: `test/cacheSpec.js`

## Notes

Consider using automated tools for CoffeeScript to JavaScript conversion as a starting point, followed by manual review and cleanup of the generated code. Also consider whether to keep using CoffeeScript at all or to fully migrate to JavaScript for all project files.
