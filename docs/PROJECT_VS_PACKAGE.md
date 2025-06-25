# Project vs. Package: Developer Guide

This document outlines the differences between using FHIR.js as a project (by forking/cloning) versus as a package (via npm), and explains how to receive update notifications.

## Project vs. Package Overview

| Aspect | Project Approach | Package Approach |
|--------|-----------------|-----------------|
| **Use Case** | Extending, customizing, or contributing | Using as a dependency in your application |
| **Installation** | Clone/fork from GitHub | Install via npm |
| **Updates** | Manual pull/merge from upstream | Update via package manager |
| **Customization** | Full access to source code | Limited to API usage |
| **Contribution** | Direct PRs possible | Feedback via issues |

## Installation Options

### 1. Using as a Package (Recommended for Most Users)

If you simply want to use FHIR.js as a dependency in your application:

```bash
# Install the latest version
npm install fhir-js-enhanced

# Install a specific version
npm install fhir-js-enhanced@1.0.0
```

To update:

```bash
# Check for updates
npm outdated

# Update to latest version
npm update fhir-js-enhanced
```

### 2. Using as a Project (For Contributors and Customizers)

If you want to customize the library or contribute:

```bash
# Clone the repository
git clone https://github.com/pramit-shah/fhir.js.git

# Navigate to the directory
cd fhir.js

# Install dependencies
npm install

# Build the project
npm run build
```

To update your local copy with upstream changes:

```bash
# Add the upstream remote (if not already done)
git remote add upstream https://github.com/pramit-shah/fhir.js.git

# Fetch upstream changes
git fetch upstream

# Merge upstream changes (assuming you're on your main branch)
git merge upstream/main

# Or rebase if you prefer
git rebase upstream/main
```

## Update Notifications

### Package Users

If you're using FHIR.js as a package, you can be notified about updates in several ways:

1. **Dependabot**: Enable GitHub Dependabot in your repository to receive automated PRs for dependency updates.

2. **npm outdated**: Regularly run `npm outdated` to check for updates.

3. **Email Notifications**: Subscribe to update notifications by sending an email to [updates@fhirjs.org](mailto:updates@fhirjs.org) with the subject "Subscribe".

4. **RSS Feed**: Subscribe to our release feed at [https://github.com/pramit-shah/fhir.js/releases.atom](https://github.com/pramit-shah/fhir.js/releases.atom)

### Project Users (Fork/Clone)

If you're using FHIR.js as a project, you can be notified about updates in several ways:

1. **Watch the Repository**: On GitHub, click "Watch" at the top right of the repository page and choose your notification preferences.

2. **GitHub Notifications**: Configure your GitHub notification settings to receive updates on watched repositories.

3. **Email Notifications**: Same as package users, subscribe by sending an email to [updates@fhirjs.org](mailto:updates@fhirjs.org).

4. **RSS Feeds**:
   - Releases: [https://github.com/pramit-shah/fhir.js/releases.atom](https://github.com/pramit-shah/fhir.js/releases.atom)
   - Commits: [https://github.com/pramit-shah/fhir.js/commits/main.atom](https://github.com/pramit-shah/fhir.js/commits/main.atom)
   - Issues: [https://github.com/pramit-shah/fhir.js/issues.atom](https://github.com/pramit-shah/fhir.js/issues.atom)

## Automating Update Checks

### Project Approach

Create a script in your project to check for updates:

```bash
#!/bin/bash
# Check for updates from upstream

# Store current branch
CURRENT_BRANCH=$(git branch --show-current)

# Fetch from upstream
git fetch upstream

# Compare current branch with upstream
BEHIND=$(git rev-list --count $CURRENT_BRANCH..upstream/main)

if [ "$BEHIND" -gt 0 ]; then
  echo "Your branch is behind upstream by $BEHIND commits"
  echo "Run 'git merge upstream/main' to update"
else
  echo "Your branch is up to date with upstream"
fi
```

### Package Approach

Add a script to your package.json:

```json
{
  "scripts": {
    "check-updates": "npx npm-check-updates -u"
  }
}
```

## Webhook Notifications

For advanced users or organizations that want programmatic notifications:

1. Set up a webhook endpoint in your system
2. Contact us at [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com) with your webhook URL
3. We'll add your webhook to our notification list

Your webhook endpoint should accept POST requests with this JSON structure:

```json
{
  "version": "1.0.0",
  "releaseDate": "2025-06-25",
  "summary": "FHIR.js version 1.0.0 has been released",
  "changelogUrl": "https://github.com/pramit-shah/fhir.js/blob/main/CHANGELOG.md",
  "releaseUrl": "https://github.com/pramit-shah/fhir.js/releases/tag/v1.0.0",
  "installCommand": "npm install fhir-js-enhanced@1.0.0",
  "contactEmail": "pylabsinc@gmail.com",
  "changelog": "..."
}
```

## Questions and Support

If you have questions about using FHIR.js as a project or package, please contact us:

- **GitHub Issues**: [https://github.com/pramit-shah/fhir.js/issues](https://github.com/pramit-shah/fhir.js/issues)
- **Email**: [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com)
- **Documentation**: [https://github.com/pramit-shah/fhir.js/tree/main/docs](https://github.com/pramit-shah/fhir.js/tree/main/docs)
