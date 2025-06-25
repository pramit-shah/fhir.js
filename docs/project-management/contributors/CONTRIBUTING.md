# Contributor Guidelines

Thank you for your interest in contributing to the FHIR.js project! This document provides guidelines and information for contributors.

## Getting Started

### Prerequisites

- Node.js 14 or higher
- Git
- Basic knowledge of FHIR and JavaScript

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally
3. Install dependencies:

   ```bash
   npm install
   ```

4. Run tests to ensure everything is working:

   ```bash
   npm test
   ```

## Development Workflow

1. Create a new branch for your feature or bugfix
2. Make your changes
3. Add tests for your changes
4. Ensure all tests pass
5. Update documentation as needed
6. Submit a pull request

## Coding Standards

Please follow the [Code Standards](/docs/project-management/CODE_STANDARDS.md) document for details on coding style and best practices.

### Key Points

- Use ES6+ syntax where appropriate
- Follow consistent indentation (2 spaces)
- Include JSDoc comments for all functions and methods
- Write tests for all new functionality

## Testing

- Write unit tests for all new code
- Ensure existing tests pass with your changes
- Add integration tests for significant features

To run tests:

```bash
npm test
```

## Documentation

- Update API documentation for any changed functionality
- Add examples for new features
- Keep the README.md up to date

## Pull Request Process

1. Update the README.md and other documentation with details of your changes
2. Update the CHANGELOG.md with notes on your changes
3. Your PR should be reviewed by at least one maintainer
4. Once approved, your PR will be merged by a maintainer

## Issue Reporting

- Use the GitHub issue tracker to report bugs
- Provide detailed steps to reproduce the issue
- Include version information and environment details
- Check if the issue has already been reported

## Community

- Join our discussion on GitHub Discussions (link to be added)
- Follow our Code of Conduct (link to be added)
- Ask questions and share ideas

## Becoming a Maintainer

Contributors who consistently provide high-quality contributions may be invited to become maintainers. Maintainers have additional responsibilities:

- Reviewing pull requests
- Triaging issues
- Participating in project planning
- Helping maintain project quality

## License

By contributing to FHIR.js, you agree that your contributions will be licensed under the project's MIT license.
