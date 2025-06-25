# Integration Options for FHIR.js

This document outlines different ways to integrate FHIR.js into your projects, with guidance on when to choose each approach.

## Overview of Integration Options

| Integration Method | Best For | Ease of Updates | Customization |
|-------------------|----------|----------------|--------------|
| NPM Package | Production apps | ★★★★★ | ★★☆☆☆ |
| Git Submodule | Framework extensions | ★★★★☆ | ★★★☆☆ |
| Fork Repository | Deep customization | ★★☆☆☆ | ★★★★★ |
| Copy Source | Isolated environments | ★☆☆☆☆ | ★★★★★ |

## 1. NPM Package (Recommended for Most Users)

Install the package from NPM:

```bash
npm install fhir-js-enhanced
```

**Benefits:**
- Simplest integration method
- Clear versioning through package.json
- Automatic updates through npm update
- No repository bloat

**Update Notifications:**
- Dependabot alerts for security updates
- npm outdated command shows available updates
- Semantic versioning protects against breaking changes

**Example usage:**

```javascript
// ES module import
import fhir from 'fhir-js-enhanced';

// CommonJS require
const fhir = require('fhir-js-enhanced');
```

## 2. Git Submodule

Add FHIR.js as a git submodule to your repository:

```bash
git submodule add https://github.com/pramit-shah/fhir.js.git vendors/fhir.js
git submodule update --init --recursive
```

**Benefits:**
- Full source code available within your project
- Can pin to specific commits or tags
- Ability to make local modifications
- Updates controlled through git commands

**Update Notifications:**
- Manual process to check for updates
- Use git submodule status to see if updates are available
- Update with git submodule update --remote

**Example integration:**

```bash
# Update the submodule to latest
git submodule update --remote vendors/fhir.js

# Check status
git submodule status
```

## 3. Fork Repository

Create your own fork of the repository:

1. Fork on GitHub: https://github.com/pramit-shah/fhir.js/fork
2. Clone your fork: `git clone https://github.com/YOUR-USERNAME/fhir.js.git`
3. Keep synced with upstream:

```bash
git remote add upstream https://github.com/pramit-shah/fhir.js.git
git fetch upstream
git merge upstream/main
```

**Benefits:**
- Complete control over the codebase
- Ability to make extensive modifications
- Can contribute improvements back to the main project
- Full development environment

**Update Notifications:**
- Watch the upstream repository on GitHub
- Manual sync process with upstream
- GitHub can show how many commits you're behind

## 4. Copy Source (Not Recommended)

Copy the source files directly into your project:

```bash
# Not recommended, but if necessary:
cp -R node_modules/fhir-js-enhanced/src ./vendor/fhir.js
```

**Benefits:**
- Complete isolation from upstream changes
- No external dependencies
- Unlimited customization

**Update Notifications:**
- No automated notifications
- Must manually check for updates
- Difficult to merge upstream changes

**Drawbacks:**
- No update path
- Security vulnerabilities won't be automatically flagged
- Maintenance burden falls entirely on your team

## Setting Up Update Notifications

### GitHub Notifications

1. Go to the [FHIR.js repository](https://github.com/pramit-shah/fhir.js)
2. Click "Watch" at the top right
3. Select your notification preferences:
   - "All Activity": Get all updates
   - "Releases only": Only be notified of new releases
   - "Custom": Configure specific notification types

### RSS Feed

Subscribe to the GitHub releases RSS feed:
- Release feed: `https://github.com/pramit-shah/fhir.js/releases.atom`
- Commit feed: `https://github.com/pramit-shah/fhir.js/commits/main.atom`

### Email Notifications

- Watch the repository to get email notifications
- Subscribe to the [mailing list](mailto:subscribe@fhirjs.org) (send an email to subscribe)

### Dependabot Alerts (For NPM users)

Enable Dependabot alerts in your GitHub repository:
1. Go to your repo
2. Go to Settings > Security & analysis
3. Enable "Dependabot alerts"

## Separating Application and Library Code

When integrating FHIR.js, it's important to separate your application code from the library:

```
your-application/
├── src/
│   ├── components/
│   ├── services/
│   │   └── fhir-service.js  # Wrapper for FHIR.js
│   └── app.js
├── vendor/                   # If using submodule or copy
│   └── fhir.js/
└── package.json              # If using NPM
```

Create a service layer in your application that:
- Wraps FHIR.js functionality
- Isolates library usage to specific modules
- Makes future updates or replacements easier

## Questions?

If you have questions about integration options, please:
- Open a GitHub issue with the "question" label
- Email support@fhirjs.org
- Check the [documentation](/docs) for more information
