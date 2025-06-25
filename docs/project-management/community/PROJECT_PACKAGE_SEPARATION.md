# Project and Package Separation Guide

This document explains the separation between the FHIR.js project repository and the npm package, and how developers can effectively work with both.

## Understanding the Separation

FHIR.js maintains a clear separation between:

1. **The Project Repository** - The GitHub repository containing the full source code, development tools, tests, documentation, and project management files
2. **The Package Distribution** - The npm package containing only the necessary files for using FHIR.js in your applications

This separation allows different workflows for different types of users and use cases.

## Package Users vs. Project Contributors

### Package Users

**Who they are:**

- Application developers using FHIR.js as a library
- Teams building healthcare applications
- Developers who primarily need the compiled code

**What they need:**

- Stable, versioned releases
- Clear API documentation
- Installation via package managers
- Minimal dependencies and size

**How they work with FHIR.js:**

```bash
# Installing the package
npm install fhir-js-enhanced

# Importing in their code
const fhir = require('fhir-js-enhanced');
// or
import fhir from 'fhir-js-enhanced';
```

### Project Contributors

**Who they are:**

- Developers modifying the FHIR.js source code
- Contributors fixing bugs or adding features
- Fork maintainers developing alternative implementations
- Extension developers building on top of FHIR.js

**What they need:**

- Full source code access
- Development tools and build system
- Test suites and documentation
- Project management information

**How they work with FHIR.js:**

```bash
# Cloning the repository
git clone https://github.com/pramit-shah/fhir.js.git
cd fhir.js

# Installing dependencies
npm install

# Building the project
npm run build

# Running tests
npm test
```

## Benefits of This Separation

1. **Smaller Package Size**: The npm package excludes development files, tests, and documentation
2. **Cleaner Dependency Tree**: Package users aren't affected by development dependencies
3. **Version Stability**: Package users get stable releases while development can continue
4. **Proper Development Environment**: Contributors get the full development environment

## How the Separation Works

### Package Contents

The npm package includes:

- Compiled JavaScript files
- TypeScript definitions
- LICENSE file
- README with essential documentation
- Package metadata

### Project Contents

The GitHub repository includes everything:

- Source code
- Development configuration files
- Tests and test fixtures
- Documentation and examples
- Project management documents
- Build scripts and tooling

## Working in Both Modes

### Local Development with npm link

If you're developing FHIR.js while also using it in a project:

```bash
# In the fhir.js directory
npm run build
npm link

# In your application directory
npm link fhir-js-enhanced
```

This creates a symbolic link from your global npm modules to your local FHIR.js build, allowing you to develop and use the library simultaneously.

### Testing Your Changes

When you make changes to the FHIR.js source:

1. Build the project: `npm run build`
2. Run the tests: `npm test`
3. Test in your application (if using npm link)

### Publishing Your Version

If you maintain a fork and want to publish your own version:

1. Update the package.json with your package name (e.g., `@your-org/fhir-js`)
2. Update the version number
3. Build the project
4. Publish to npm: `npm publish`

## Future Development

As we continue to develop FHIR.js, we'll maintain this separation and improve both the project and package experiences:

1. **For package users**: More streamlined dependencies, better tree-shaking, and improved TypeScript support
2. **For project contributors**: Enhanced development tools, better documentation, and clearer contribution paths

## Questions and Support

If you have questions about the project/package separation:

- See the [UPDATE_NOTIFICATION_GUIDE.md](/docs/project-management/community/UPDATE_NOTIFICATION_GUIDE.md) for more details on staying updated
- Contact us at [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com) for specific questions
- Open a GitHub issue for suggestions on improving the separation
