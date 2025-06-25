# Update Notification and Fork Management Guide

This guide explains how developers can fork the FHIR.js repository, receive notifications about updates, and manage the relationship between package and project usage.

## Forking and Update Notifications

### Why Fork FHIR.js?

Forking the FHIR.js repository is beneficial if you:

1. Want to modify the codebase for your specific needs
2. Plan to contribute improvements back to the main project
3. Need to maintain a specialized version for your organization
4. Want to experiment with new features or architectural changes

### Setting Up Your Fork

1. **Create a GitHub Fork**:
   - Visit [https://github.com/pramit-shah/fhir.js](https://github.com/pramit-shah/fhir.js)
   - Click the "Fork" button in the upper right corner
   - Select your account or organization as the destination

2. **Clone Your Fork Locally**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/fhir.js.git
   cd fhir.js
   ```

3. **Add the Upstream Remote**:
   ```bash
   git remote add upstream https://github.com/pramit-shah/fhir.js.git
   ```

### Update Notification System

We provide several methods to keep you informed about updates to FHIR.js:

1. **Subscribe to Email Notifications**:
   - Send an email to [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com) with the subject "FHIR.js Update Notifications"
   - Include your name, organization, and GitHub username in the body
   - You'll be added to our update notification mailing list

2. **GitHub Watch Settings**:
   - Go to the main repository on GitHub
   - Click "Watch" -> "Custom" -> Enable "Releases", "Discussions", and "Security alerts"
   - You'll receive notifications according to your GitHub notification settings

3. **Update Checker Script**:
   For automated checking, we provide a script you can run periodically:
   
   ```bash
   # Download the update checker
   curl -O https://raw.githubusercontent.com/pramit-shah/fhir.js/main/scripts/check-fhirjs-updates.sh
   chmod +x check-fhirjs-updates.sh
   
   # Run to check for updates
   ./check-fhirjs-updates.sh
   ```

4. **RSS Feed**:
   - Add `https://github.com/pramit-shah/fhir.js/releases.atom` to your RSS reader

## Package vs. Project Separation

FHIR.js follows a clear separation between the package distribution and the project repository:

### Package Usage

The npm package `fhir-js-enhanced` is designed for:

- Application developers who need a ready-to-use FHIR client
- Projects that consume the library through a dependency manager
- Standard usage patterns that follow the documented API

**Install the Package**:
```bash
npm install fhir-js-enhanced
```

**Update the Package**:
```bash
npm update fhir-js-enhanced
```

### Project Usage

The GitHub repository is designed for:

- Contributors who want to modify the source code
- Developers creating extensions or plugins
- Users who need to understand the implementation details
- Organizations maintaining their own fork

## Maintaining a Custom Fork

If you maintain a custom fork of FHIR.js:

1. **Document Your Changes**:
   - Create a `FORK_CHANGES.md` file in your repository
   - Document all significant modifications and their purpose
   - Update this file with each new change

2. **Version Management**:
   - Use a custom version scheme in your `package.json`:
     ```json
     "version": "1.0.0-yourorg.1"
     ```
   - Increment your custom suffix with each change

3. **Staying Updated**:
   ```bash
   # Fetch upstream changes
   git fetch upstream
   
   # Create a merge branch to review changes
   git checkout -b upstream-merge
   git merge upstream/main
   
   # Review changes carefully before merging to your main branch
   ```

4. **Publishing a Custom Version**:
   If you need to publish your fork to npm:
   
   ```bash
   # Use a scoped package name
   # In package.json:
   "name": "@your-org/fhir-js"
   
   # Publish to npm
   npm publish
   ```

## Sharing Improvements

We encourage fork maintainers to share their improvements:

1. **Submit Pull Requests**:
   - For generally useful improvements, submit PRs to the main repository
   - Include comprehensive tests and documentation

2. **Share Extensions**:
   - For specialized functionality, create separate extension packages
   - Register your extension in our [Extensions Registry](/docs/project-management/community/EXTENSIONS.md)

3. **Report Use Cases**:
   - Even if code isn't shareable, describe your use cases and improvements
   - This helps guide future development priorities

## Contact Information

For questions about forking, updates, or contributions:

- **Email**: [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com)
- **GitHub Discussions**: Use the Discussions tab in the main repository
- **Issue Tracker**: For specific bugs or feature requests
