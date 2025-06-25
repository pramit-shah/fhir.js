# Security Policy

## Supported Versions

This library is currently being maintained with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within this library, please send an email to [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com). All security vulnerabilities will be promptly addressed.

## Known Vulnerabilities

### AngularJS Dependency

This library provides an adapter for AngularJS, which is a deprecated framework with known security vulnerabilities. If you're using the AngularJS adapter, please be aware:

1. AngularJS is no longer maintained by Google and has multiple security vulnerabilities that cannot be fixed.
2. We recommend using the Native adapter or Node.js adapter instead.
3. If you must use AngularJS, ensure you're using version 1.8.3 or higher which has some (but not all) security issues addressed.

### Security Recommendations

1. **Use Modern Adapters**: Prefer the Native or Node.js adapters over the AngularJS, jQuery, or YUI adapters.
2. **Keep Dependencies Updated**: Always use the latest version of this library.
3. **Content Security Policy**: Implement a strict Content Security Policy to mitigate potential XSS attacks.
4. **Input Validation**: Validate all input data before processing, especially when handling FHIR resources.

## Dependency Vulnerabilities Management

The library uses several dependencies that may occasionally have security vulnerabilities. We regularly update dependencies to address these issues.

Run `npm audit` in your project to check for vulnerabilities in the dependency tree.
