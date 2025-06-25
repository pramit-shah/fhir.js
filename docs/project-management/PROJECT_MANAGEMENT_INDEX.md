# FHIR.js Project Management

This document serves as a central index to all project management resources for the FHIR.js library.

## Quick Links

- [Project Status](/docs/project-management/PROJECT_STATUS.md)
- [Development Roadmap](/docs/project-management/ROADMAP.md)
- [Code Standards](/docs/project-management/CODE_STANDARDS.md)
- [Issue Tracker](/docs/project-management/issues/ISSUES_TRACKER.md)
- [Latest Release Notes](/docs/project-management/releases/RELEASE_v1.0.0.md)
- [Changelog](/CHANGELOG.md)
- [Security Policy](/SECURITY.md)

## Project Structure

The project management documentation is organized into the following directories:

### Issues

- [`active/`](/docs/project-management/issues/active/) - Currently active issues being worked on
- [`planned/`](/docs/project-management/issues/planned/) - Issues planned for future development
- [`resolved/`](/docs/project-management/issues/resolved/) - Resolved issues with their solutions
- [`blocked/`](/docs/project-management/issues/blocked/) - Issues that are blocked by dependencies or decisions

### Enhancements

- [`enhancements/`](/docs/project-management/issues/enhancements/) - Feature enhancement proposals
  - [`implementations/`](/docs/project-management/issues/enhancements/implementations/) - Detailed implementation plans for approved enhancements

### Releases

- [`releases/`](/docs/project-management/releases/) - Release notes for published versions
- [`releases/upcoming/`](/docs/project-management/releases/upcoming/) - Planning documents for upcoming releases

### Additional Resources

- [`meetings/`](/docs/project-management/meetings/) - Meeting notes and action items
- [`decisions/`](/docs/project-management/decisions/) - Architecture Decision Records (ADRs)
- [`audits/`](/docs/project-management/audits/) - Results of security and performance audits
- [`contributors/`](/docs/project-management/contributors/) - Contributor information and guidelines

## Issue Naming Convention

Each issue is assigned a unique identifier following this pattern:

- `{TYPE}-{NUMBER}` (e.g., SEC-001, PERF-002, FUNC-003)

Types include:

- `SEC`: Security issues
- `PERF`: Performance issues
- `FUNC`: Functionality issues
- `DOC`: Documentation issues
- `TEST`: Testing issues
- `ENH`: Enhancement proposals
- `BUG`: Bug reports

## Issue Tracking Workflow

1. New issues are created in the `active/` or `planned/` directory depending on their status
2. When work begins on a planned issue, it's moved to `active/`
3. Continuous updates are added to the issue's updates file (`{ID}-updates.md`)
4. When resolved, the issue is moved to `resolved/` with a summary of the solution
5. If an issue becomes blocked, it's moved to `blocked/` with details about the blocker

## Working with This System

1. **For new issues**: Create a new markdown file in the appropriate directory with the next sequential number for that issue type
2. **For updates**: Add to the issue's updates file rather than modifying the original issue description
3. **For resolutions**: Move the issue to `resolved/` and add a resolution summary
4. **For tracking status**: Update the main [Issue Tracker](/docs/project-management/issues/ISSUES_TRACKER.md)
