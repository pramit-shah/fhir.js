# FHIR.js Project Management

This directory contains project management resources for the FHIR.js library.

## Getting Started

If you're new to this project management system, start with:

- [Project Management Index](/docs/project-management/PROJECT_MANAGEMENT_INDEX.md) - Overview of the project management structure
- [Project Status](/docs/project-management/PROJECT_STATUS.md) - Current status of the project
- [Roadmap](/docs/project-management/ROADMAP.md) - Future development plans

## Directory Structure

- [`issues/`](/docs/project-management/issues/) - Issue tracking
  - [`active/`](/docs/project-management/issues/active/) - Currently active issues
  - [`planned/`](/docs/project-management/issues/planned/) - Issues planned for future development
  - [`resolved/`](/docs/project-management/issues/resolved/) - Resolved issues with solutions
  - [`blocked/`](/docs/project-management/issues/blocked/) - Issues blocked by dependencies or decisions
  - [`enhancements/`](/docs/project-management/issues/enhancements/) - Feature enhancements
    - [`implementations/`](/docs/project-management/issues/enhancements/implementations/) - Implementation details for enhancements
- [`releases/`](/docs/project-management/releases/) - Release notes and planning
  - [`upcoming/`](/docs/project-management/releases/upcoming/) - Planning documents for upcoming releases
- [`meetings/`](/docs/project-management/meetings/) - Meeting notes and action items
- [`decisions/`](/docs/project-management/decisions/) - Architecture Decision Records (ADRs)
- [`audits/`](/docs/project-management/audits/) - Security and performance audits
- [`contributors/`](/docs/project-management/contributors/) - Contributor information and guidelines
- [`templates/`](/docs/project-management/templates/) - Templates for creating new documents

## Working with This System

### Creating New Issues

1. Find the next available ID number for the issue type
2. Use the [Issue Template](/docs/project-management/templates/ISSUE_TEMPLATE.md)
3. Place the issue in the appropriate directory (`active/`, `planned/`, or `blocked/`)
4. Update the main [Issue Tracker](/docs/project-management/issues/ISSUES_TRACKER.md)

### Tracking Issue Progress

1. Create an updates file for the issue (e.g., `SEC-001-updates.md`)
2. Document all updates, discussions, and progress in this file
3. Keep the original issue file unchanged to maintain the initial requirements

### Resolving Issues

1. Move the issue to the `resolved/` directory
2. Add a resolution summary to the issue
3. Update the main [Issue Tracker](/docs/project-management/issues/ISSUES_TRACKER.md)

## Templates

Templates are available for common document types:

- [Issue Template](/docs/project-management/templates/ISSUE_TEMPLATE.md)
- [Enhancement Template](/docs/project-management/templates/ENHANCEMENT_TEMPLATE.md)
- [Updates Template](/docs/project-management/templates/UPDATES_TEMPLATE.md)
- [Meeting Template](/docs/project-management/templates/MEETING_TEMPLATE.md)
- [Architecture Decision Record Template](/docs/project-management/templates/ADR_TEMPLATE.md)
- [Release Template](/docs/project-management/templates/RELEASE_TEMPLATE.md)
