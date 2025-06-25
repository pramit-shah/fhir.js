# FHIR.js Modernization Roadmap

## Overview

This document outlines the current modernization efforts for FHIR.js and tracks progress on critical issues that need to be resolved for the project to be fully compatible with modern JavaScript environments and continue to be maintained effectively.

## Current Status

The project has been partially modernized with updates to the Node.js version support (from 6/8/10 to 14/16/18/20) in the CI/CD configuration. However, several critical issues remain that are blocking successful releases and further development.

## Critical Issues

### 1. BUILD-001: Syntax Error in src/complexity.js

**Status**: Active

A syntax error in the `src/complexity.js` file (around line 858) is preventing successful builds. This appears to be related to older JavaScript syntax that's no longer valid in modern Node.js versions. The error occurs in a complex function that generates queries for the FHIR API.

[Full Details](/docs/project-management/issues/active/BUILD-001.md)

### 2. TEST-005: CoffeeScript Test Failures

**Status**: Active

Many test files are written in CoffeeScript which is causing compatibility issues with modern Node.js versions and testing frameworks. An initial attempt at migrating one test file (`test/cacheSpec.coffee` to `test/cacheSpec.js`) has been made, but a comprehensive solution is needed.

[Full Details](/docs/project-management/issues/active/TEST-005.md)

### 3. DEP-001: Outdated Dependencies

**Status**: Active

The project has numerous outdated dependencies that need to be updated for security, compatibility with modern Node.js versions, and to ensure the library remains maintainable. The project also uses a mix of npm and bower for dependency management, which should be simplified.

[Full Details](/docs/project-management/issues/active/DEP-001.md)

### 4. RELEASE-001: NPM Publishing Process Failures

**Status**: Active

Attempts to publish a new version (v1.0.1) to npm have failed due to build and test errors. The release process needs to be updated to match modern npm practices.

[Full Details](/docs/project-management/issues/active/RELEASE-001.md)

## Modernization Path

1. **Short-term fixes**:
   - Fix the syntax error in `src/complexity.js` to enable successful builds
   - Update critical dependencies with security vulnerabilities
   - Modify the npm scripts to allow publishing despite test failures

2. **Medium-term improvements**:
   - Migrate critical CoffeeScript test files to JavaScript
   - Update the testing framework to be compatible with modern Node.js
   - Remove bower dependencies

3. **Long-term goals**:
   - Complete migration to modern JavaScript (ES6+)
   - Implement comprehensive TypeScript type definitions
   - Modernize the build process with current best practices
   - Implement automated dependency updates and security checks

## Progress Tracking

Progress on these issues is tracked in the [Issues Tracker](/docs/project-management/issues/ISSUES_TRACKER.md).

## Contributing to Modernization

Contributors interested in helping with the modernization efforts should focus on the active issues listed above. See [CONTRIBUTING.md](/CONTRIBUTING.md) for guidelines on how to contribute to the project.
