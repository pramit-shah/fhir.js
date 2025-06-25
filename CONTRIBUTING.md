# Contributing to FHIR.js

Thank you for your interest in contributing to FHIR.js! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)
- [Staying Updated](#staying-updated)
- [Using as a Dependency vs. Forking](#using-as-a-dependency-vs-forking)

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## How Can I Contribute?

### Reporting Bugs

- Ensure the bug has not already been reported by searching GitHub Issues
- If you're unable to find an open issue addressing the problem, open a new one
- Include a clear title and description
- Include as much relevant information as possible
- Include a code sample or test case demonstrating the issue

### Feature Requests

- Use the feature request template on GitHub
- Clearly describe the feature and its use case
- Explain how it would benefit the broader community
- Provide examples of how the API might work
- Reference related features or patterns in other libraries if applicable

### Documentation Improvements

- Help improve existing documentation
- Add examples and use cases
- Fix typos and clarify confusing sections
- Add missing documentation for existing features

### Code Contributions

- Address open issues
- Add new features
- Improve performance
- Enhance test coverage
- Fix bugs

## Development Setup

### Prerequisites

- Node.js 14 or higher
- npm or yarn

### Environment Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/fhir.js.git`
3. Navigate to the project directory: `cd fhir.js`
4. Install dependencies: `npm install`

### Running Tests

- Run all tests: `npm test`
- Run browser tests: `npm run integrate`
- Watch mode: `npm run test:watch`

### Building

- Build the project: `npm run build`

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Add or update tests as necessary
4. Update documentation as needed
5. Ensure all tests pass
6. Run the linter: `npm run lint`
7. Submit a pull request to the `main` branch
8. Respond to code review feedback

### Pull Request Guidelines

- Keep pull requests focused on addressing a single concern
- Include tests for new features or bug fixes
- Update relevant documentation
- Reference any related issues
- Follow the coding standards
- Explain the purpose and benefits of your changes

## Coding Standards

Please refer to [CODE_STANDARDS.md](/docs/project-management/CODE_STANDARDS.md) for detailed coding standards.

## Testing Guidelines

- Write tests for all new functionality
- Maintain or increase overall test coverage
- Include both positive and negative test cases
- Mock external dependencies
- Keep tests fast and independent

## Documentation

- Use JSDoc for API documentation
- Keep README and other documentation files up to date
- Include examples for new features
- Document breaking changes

## Community

- Join discussions in GitHub Issues
- Participate in feature planning
- Help other users with questions
- Spread the word about the project

## Staying Updated

### Subscribe to Repository Updates

To stay updated with changes to this repository:

1. **Watch the Repository**: 
   - Go to the [repository page](https://github.com/pramit-shah/fhir.js)
   - Click the "Watch" button in the top-right corner
   - Select notification preferences (All Activity, Releases only, etc.)

2. **Star the Repository**:
   - Click the "Star" button to bookmark for future reference
   - GitHub will notify you of significant updates

3. **Subscribe to Release Notes**:
   - Release notes are published in [docs/project-management/releases](/docs/project-management/releases/)
   - Each release is also tagged with detailed notes on GitHub

4. **RSS Feed for Releases**:
   - Subscribe to the [releases RSS feed](https://github.com/pramit-shah/fhir.js/releases.atom)
   - Add to your favorite RSS reader for automatic notifications

### Sync Your Fork

If you maintain a fork of this repository:

```bash
# Add the upstream remote (if you haven't already)
git remote add upstream https://github.com/pramit-shah/fhir.js.git

# Fetch upstream changes
git fetch upstream

# Merge upstream changes into your local branch
git checkout main
git merge upstream/main

# Push the updated code to your fork
git push origin main
```

## Using as a Dependency vs. Forking

### Package Dependency

If you're building an application that uses FHIR.js:

```bash
# Install as an NPM package
npm install fhir-js-enhanced
```

Benefits of using as a package:
- Easily update to new versions
- Clear dependency management
- Smaller repository size

### Forking the Repository

For deeper customization or development:

1. Fork the repository on GitHub
2. Clone your fork locally
3. Make your changes
4. Consider submitting improvements back to the main repository

Benefits of forking:
- Full access to modify the code
- Ability to adapt to specialized requirements
- Contribute improvements back to the community

For detailed guidance on project structure and contribution workflow, see the [project management documentation](/docs/project-management/PROJECT_MANAGEMENT_INDEX.md).

Thank you for contributing to FHIR.js!
