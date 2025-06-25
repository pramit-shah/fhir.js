# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.0.1](https://github.com/pramit-shah/fhir.js/compare/v0.0.22...v1.0.1) (2025-06-25)


### Bug Fixes

* update deps to address security vulnerabilities ([00dbe33](https://github.com/pramit-shah/fhir.js/commit/00dbe33a468a9650c6a879179d22771b155c98f5))

# Changelog

## v1.0.0 (2025-06-25)

- Major: Modernized build system (Webpack 5, Mocha/Karma, CoffeeScript 2)
- Major: TypeScript definitions included and auto-discovered
- Major: Node.js 14+ and browser support (ES modules, bundlers)
- Major: Peer dependencies for Angular and jQuery
- Major: Removed Bower and legacy scripts
- Major: Improved multi-resource FHIR search
- Major: Comprehensive error handling and retry policies
- Major: Advanced dependency management and feature detection
- Major: Multi-level logging and performance tracking
- Major: Enhanced adapters (Node.js, Angular, jQuery, YUI)
- Major: Example scripts for Node.js and browser usage
- Major: Advanced resource caching and memory optimization
- Major: Priority-based request handling and batch processing
- Major: Server health monitoring and adaptive retry
- Major: Security documentation and vulnerability management

## v0.1.0 (Unreleased)

- Fixed search parameter for `include`, added search parameter `revinclude` [#121](https://github.com/FHIR/fhir.js/issues/121) [PR#99](https://github.com/FHIR/fhir.js/pull/99)
- native.js credentials [#122](https://github.com/FHIR/fhir.js/issues/122)
- Missing defer property in Adapter object of native.js [#119](https://github.com/FHIR/fhir.js/issues/119)
