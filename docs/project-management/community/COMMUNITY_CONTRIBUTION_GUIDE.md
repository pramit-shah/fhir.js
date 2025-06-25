# Community Contribution and Issue Tracking

This document outlines the process for tracking external GitHub issues, community contributions, and alternative implementations for the FHIR.js project.

## Overview

The FHIR.js project welcomes community contributions and actively tracks issues reported through GitHub. This system provides a structured way to incorporate community feedback while maintaining internal documentation of the decision-making process.

## Directory Structure

- `/docs/project-management/community/` - Root directory for community-related documentation
  - `/github-issues/` - Tracking documents for GitHub issues
  - `/proposals/` - Community feature or enhancement proposals
  - `/contributions/` - Documentation of significant community contributions
  - `/alternative-implementations/` - Analysis of alternative FHIR.js implementations

## GitHub Issues Tracking Process

### When an Issue is Reported on GitHub

1. **Issue Triage**:
   - A team member reviews the new GitHub issue
   - The issue is categorized (bug, feature request, question, etc.)

2. **Documentation Creation**:
   - Create a tracking document in `/docs/project-management/community/github-issues/` using the `GITHUB_ISSUE_TEMPLATE.md`
   - Name the file `GH-[NUMBER]-[short-description].md` (e.g., `GH-123-reference-resolution-bug.md`)
   - Link to the internal issue if one is created

3. **Regular Updates**:
   - Update the tracking document with new information from the GitHub discussion
   - Document internal discussion and decisions related to the issue
   - Update the status as appropriate

4. **Resolution**:
   - Document the final resolution of the issue
   - Include links to any PRs that addressed the issue
   - Note any permanent limitations or decisions not to fix

### Categories for GitHub Issues

- **Fixable**: Issues that can be addressed in the codebase
- **Known Limitations**: Issues that represent known limitations in the design
- **Cannot Fix**: Issues that cannot be fixed due to technical constraints
- **Will Not Fix**: Issues that will not be fixed due to strategic decisions
- **External**: Issues related to external dependencies or environments

## Community Proposals Process

1. **Proposal Submission**:
   - Community members submit proposals through GitHub issues or discussions
   - A team member creates a tracking document using the `COMMUNITY_PROPOSAL_TEMPLATE.md`

2. **Review Process**:
   - The proposal is reviewed by relevant team members
   - Feedback and discussion are documented

3. **Decision**:
   - The proposal is accepted, rejected, or sent back for revision
   - The decision and rationale are documented

4. **Implementation**:
   - If accepted, implementation details are tracked
   - Links to relevant PRs are added

## Alternative Implementations Tracking

For projects that fork or create alternative implementations of FHIR.js:

1. **Documentation**:
   - Create a document using the `ALTERNATIVE_IMPLEMENTATION_TEMPLATE.md`
   - Document key differences and innovations

2. **Analysis**:
   - Analyze the approach and implementation
   - Identify valuable techniques or features

3. **Integration Consideration**:
   - Evaluate whether to incorporate ideas from the alternative implementation
   - Document decisions and rationale

## Contact Information

Since this repository is a fork of the original FHIR.js, community members should be directed to the appropriate communication channels:

- **GitHub Issues**: Use the GitHub Issues tab for bug reports and feature requests
- **Security Issues**: Email [security@fhirjs.org](mailto:security@fhirjs.org) for security concerns
- **General Questions**: Email [pylabsinc@gmail.com](mailto:pylabsinc@gmail.com) for general inquiries

> Note: Ensure that the contact information is kept updated if the repository ownership changes.

## Contribution Acknowledgment

All community contributions are acknowledged in:

1. Release notes for the version that includes the contribution
2. The CONTRIBUTORS.md file
3. Documentation where appropriate

## Integration with Internal Issue Tracking

When an external GitHub issue is related to an internal issue:

1. Link the GitHub issue tracking document to the internal issue
2. Update both documents when significant progress occurs
3. Ensure consistency in communication between internal and external tracking

This approach ensures that the project benefits from community involvement while maintaining structured internal tracking.
