# Update Notifications

To stay informed about updates to FHIR.js, you can subscribe to notifications through several channels:

## Subscribe to Updates

Choose one or more of the following methods:

1. **GitHub Watch**: Click the "Watch" button at the top of our [GitHub repository](https://github.com/pramit-shah/fhir.js) to receive notifications about new releases and issues.

2. **Email Updates**: Send an email to [updates@fhirjs.org](mailto:updates@fhirjs.org) with the subject "Subscribe" to join our update mailing list.

3. **RSS Feeds**:
   - Releases: [https://github.com/pramit-shah/fhir.js/releases.atom](https://github.com/pramit-shah/fhir.js/releases.atom)
   - Commits: [https://github.com/pramit-shah/fhir.js/commits/main.atom](https://github.com/pramit-shah/fhir.js/commits/main.atom)
   - Issues: [https://github.com/pramit-shah/fhir.js/issues.atom](https://github.com/pramit-shah/fhir.js/issues.atom)

4. **Dependabot**: If you're using FHIR.js as a dependency in a GitHub repository, enable Dependabot alerts for automated notifications about updates and vulnerabilities.

## Checking for Updates Manually

### Package Users

If you've installed FHIR.js as an npm package:

```bash
# Check for outdated packages
npm outdated fhir-js-enhanced

# Update to the latest version
npm update fhir-js-enhanced
```

### Project Users

If you've forked or cloned the repository:

```bash
# Add the upstream remote (if you haven't already)
git remote add upstream https://github.com/pramit-shah/fhir.js.git

# Fetch and show updates
git fetch upstream
git log HEAD..upstream/main --oneline
```

## Release History

All releases and their release notes are documented in the [CHANGELOG.md](../CHANGELOG.md) file and on the [GitHub Releases page](https://github.com/pramit-shah/fhir.js/releases).

## Webhook Integration

For organizations that require programmatic notifications, we offer webhook integration. Contact [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com) for more details.

## Further Information

For more details about using FHIR.js as a project vs. package, including update notifications, see [PROJECT_VS_PACKAGE.md](PROJECT_VS_PACKAGE.md).
