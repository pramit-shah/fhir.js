#!/bin/bash

# Script for managing FHIR.js project documentation
# Usage: ./manage-project.sh [command] [options]

set -e

DOCS_DIR="./docs/project-management"
TEMPLATES_DIR="$DOCS_DIR/templates"
ISSUES_DIR="$DOCS_DIR/issues"
RELEASES_DIR="$DOCS_DIR/releases"

# Display help information
function show_help {
  echo "FHIR.js Project Management Script"
  echo ""
  echo "Usage: ./manage-project.sh [command] [options]"
  echo ""
  echo "Commands:"
  echo "  create-issue TYPE ID TITLE     Create a new issue (TYPE: bug, sec, perf, func, doc, test)"
  echo "  update-issue ID                Add an update to an existing issue"
  echo "  move-issue ID STATUS           Move issue to a new status (STATUS: active, planned, resolved, blocked)"
  echo "  create-enhancement ID TITLE    Create a new enhancement proposal"
  echo "  create-adr ID TITLE            Create a new Architecture Decision Record"
  echo "  create-meeting DATE TITLE      Create a new meeting notes file"
  echo "  create-release VERSION         Create a new release planning document"
  echo "  list-issues [STATUS]           List all issues, optionally filtered by status"
  echo "  help                           Show this help message"
  echo ""
  echo "Examples:"
  echo "  ./manage-project.sh create-issue sec 004 'Implement CORS support'"
  echo "  ./manage-project.sh update-issue SEC-001"
  echo "  ./manage-project.sh move-issue PERF-001 resolved"
  echo "  ./manage-project.sh list-issues active"
}

# Validate issue ID format
function validate_issue_id {
  local id=$1
  if [[ ! $id =~ ^[A-Z]+-[0-9]{3}$ ]]; then
    echo "Error: Issue ID must be in the format TYPE-NNN (e.g., SEC-001)"
    exit 1
  fi
}

# Create a new issue
function create_issue {
  local type=$1
  local id=$2
  local title=$3
  local status=${4:-active}
  
  # Convert type to uppercase
  type=$(echo "$type" | tr '[:lower:]' '[:upper:]')
  
  # Map short type to full type
  case "$type" in
    BUG) type="BUG" ;;
    SEC) type="SEC" ;;
    PERF) type="PERF" ;;
    FUNC) type="FUNC" ;;
    DOC) type="DOC" ;;
    TEST) type="TEST" ;;
    *)
      echo "Error: Unknown issue type. Use one of: bug, sec, perf, func, doc, test"
      exit 1
      ;;
  esac
  
  # Format ID with leading zeros
  id=$(printf "%03d" "$id")
  full_id="$type-$id"
  
  # Check if issue already exists
  if [ -f "$ISSUES_DIR/$status/$full_id.md" ]; then
    echo "Error: Issue $full_id already exists."
    exit 1
  fi
  
  # Create issue file
  cp "$TEMPLATES_DIR/ISSUE_TEMPLATE.md" "$ISSUES_DIR/$status/$full_id.md"
  
  # Update issue file with title and other details
  sed -i "s/# Issue Template/# $full_id: $title/" "$ISSUES_DIR/$status/$full_id.md"
  sed -i "s/\[Brief description of the issue\]/$title/" "$ISSUES_DIR/$status/$full_id.md"
  sed -i "s/\[Status\]/$(echo "$status" | sed 's/.*/\u&/')/" "$ISSUES_DIR/$status/$full_id.md"
  sed -i "s/\[Issue Type\]/$(echo "$type" | sed 's/.*/\u&/')/" "$ISSUES_DIR/$status/$full_id.md"
  
  today=$(date +%Y-%m-%d)
  sed -i "s/\[YYYY-MM-DD\]/$today/" "$ISSUES_DIR/$status/$full_id.md"
  
  echo "Created issue $full_id in $status status."
  
  # Create updates file
  create_update_file "$full_id" "$status" "initial"
}

# Create an update file for an issue
function create_update_file {
  local id=$1
  local status=$2
  local initial=$3
  
  # Check if issue exists
  if [ ! -f "$ISSUES_DIR/$status/$id.md" ]; then
    echo "Error: Issue $id does not exist in $status status."
    exit 1
  fi
  
  # Create updates file if it doesn't exist
  if [ ! -f "$ISSUES_DIR/$status/$id-updates.md" ]; then
    cp "$TEMPLATES_DIR/UPDATES_TEMPLATE.md" "$ISSUES_DIR/$status/$id-updates.md"
    title=$(grep "^# " "$ISSUES_DIR/$status/$id.md" | sed 's/^# //')
    sed -i "s/\[Issue\/Enhancement ID\]/$title/" "$ISSUES_DIR/$status/$id-updates.md"
    
    today=$(date +%Y-%m-%d)
    if [ "$initial" == "initial" ]; then
      echo "Created initial updates file for $id."
    else
      # Open editor for the updates file
      echo "Opening updates file for $id. Add your update under the date $today."
      ${EDITOR:-nano} "$ISSUES_DIR/$status/$id-updates.md"
    fi
  else
    # Add a new update entry
    today=$(date +%Y-%m-%d)
    echo -e "\n### $today\n\n[Add your update here]\n\n#### Tasks Completed on $today\n\n- \n\n#### Next Actions as of $today\n\n- \n" >> "$ISSUES_DIR/$status/$id-updates.md"
    
    # Open editor for the updates file
    echo "Opening updates file for $id. Add your update under the date $today."
    ${EDITOR:-nano} "$ISSUES_DIR/$status/$id-updates.md"
  fi
}

# Move an issue to a different status
function move_issue {
  local id=$1
  local new_status=$2
  
  validate_issue_id "$id"
  
  # Check if new status is valid
  case "$new_status" in
    active|planned|resolved|blocked) ;;
    *)
      echo "Error: Invalid status. Use one of: active, planned, resolved, blocked"
      exit 1
      ;;
  esac
  
  # Find current status
  current_status=""
  for status in active planned resolved blocked; do
    if [ -f "$ISSUES_DIR/$status/$id.md" ]; then
      current_status=$status
      break
    fi
  done
  
  if [ -z "$current_status" ]; then
    echo "Error: Issue $id not found in any status."
    exit 1
  fi
  
  if [ "$current_status" == "$new_status" ]; then
    echo "Issue $id is already in $new_status status."
    exit 0
  fi
  
  # Move issue and updates files
  mv "$ISSUES_DIR/$current_status/$id.md" "$ISSUES_DIR/$new_status/$id.md"
  echo "Moved issue $id from $current_status to $new_status."
  
  if [ -f "$ISSUES_DIR/$current_status/$id-updates.md" ]; then
    mv "$ISSUES_DIR/$current_status/$id-updates.md" "$ISSUES_DIR/$new_status/$id-updates.md"
    echo "Moved updates file for $id."
  fi
  
  # Update status in the issue file
  sed -i "s/Status\]: [A-Za-z]*/Status\]: $(echo "$new_status" | sed 's/.*/\u&/')/" "$ISSUES_DIR/$new_status/$id.md"
  
  # Add a new update entry about the status change
  if [ -f "$ISSUES_DIR/$new_status/$id-updates.md" ]; then
    today=$(date +%Y-%m-%d)
    echo -e "\n### $today\n\nIssue moved from $current_status to $new_status status.\n\n#### Status Change Reason\n\n[Add reason for status change here]\n" >> "$ISSUES_DIR/$new_status/$id-updates.md"
    
    # Open editor for the updates file
    echo "Opening updates file for $id. Add the reason for the status change."
    ${EDITOR:-nano} "$ISSUES_DIR/$new_status/$id-updates.md"
  fi
}

# Create a new enhancement proposal
function create_enhancement {
  local id=$1
  local title=$2
  
  # Format ID with leading zeros
  id=$(printf "%03d" "$id")
  full_id="ENH-$id"
  
  # Check if enhancement already exists
  if [ -f "$ISSUES_DIR/enhancements/$full_id.md" ]; then
    echo "Error: Enhancement $full_id already exists."
    exit 1
  fi
  
  # Create enhancement file
  cp "$TEMPLATES_DIR/ENHANCEMENT_TEMPLATE.md" "$ISSUES_DIR/enhancements/$full_id.md"
  
  # Update enhancement file with title and other details
  sed -i "s/# Enhancement Template/# $full_id: $title/" "$ISSUES_DIR/enhancements/$full_id.md"
  sed -i "s/\[Brief description of the enhancement\]/$title/" "$ISSUES_DIR/enhancements/$full_id.md"
  
  today=$(date +%Y-%m-%d)
  sed -i "s/\[YYYY-MM-DD\]/$today/" "$ISSUES_DIR/enhancements/$full_id.md"
  
  echo "Created enhancement $full_id."
  
  # Create updates file
  cp "$TEMPLATES_DIR/UPDATES_TEMPLATE.md" "$ISSUES_DIR/enhancements/$full_id-updates.md"
  sed -i "s/\[Issue\/Enhancement ID\]/$full_id: $title/" "$ISSUES_DIR/enhancements/$full_id-updates.md"
  
  echo "Created updates file for enhancement $full_id."
}

# Create a new Architecture Decision Record
function create_adr {
  local id=$1
  local title=$2
  
  # Format ID with leading zeros
  id=$(printf "%03d" "$id")
  full_id="ADR-$id"
  
  # Check if ADR already exists
  if [ -f "$DOCS_DIR/decisions/$full_id-*.md" ]; then
    echo "Error: ADR $full_id already exists."
    exit 1
  fi
  
  # Format title for filename
  filename_title=$(echo "$title" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  
  # Create ADR file
  cp "$TEMPLATES_DIR/ADR_TEMPLATE.md" "$DOCS_DIR/decisions/$full_id-$filename_title.md"
  
  # Update ADR file with title and other details
  sed -i "s/# ADR-\[Number\]: \[Title\]/# $full_id: $title/" "$DOCS_DIR/decisions/$full_id-$filename_title.md"
  
  echo "Created ADR $full_id: $title."
}

# Create a new meeting notes file
function create_meeting {
  local date=$1
  local title=$2
  
  # Validate date format
  if [[ ! $date =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
    echo "Error: Date must be in the format YYYY-MM-DD."
    exit 1
  fi
  
  # Format title for filename
  if [ -z "$title" ]; then
    title="Team Meeting"
  fi
  
  filename_title=$(echo "$title" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
  
  # Create meeting notes file
  cp "$TEMPLATES_DIR/MEETING_TEMPLATE.md" "$DOCS_DIR/meetings/MEETING-$date-$filename_title.md"
  
  # Update meeting notes file with title and date
  sed -i "s/# Meeting Notes Template/# $title - $date/" "$DOCS_DIR/meetings/MEETING-$date-$filename_title.md"
  sed -i "s/\[YYYY-MM-DD\]/$date/" "$DOCS_DIR/meetings/MEETING-$date-$filename_title.md"
  
  echo "Created meeting notes file for $date: $title."
}

# Create a new release planning document
function create_release {
  local version=$1
  
  # Validate version format
  if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in the format x.y.z."
    exit 1
  fi
  
  # Create release planning file
  cp "$TEMPLATES_DIR/RELEASE_TEMPLATE.md" "$DOCS_DIR/releases/upcoming/RELEASE_PLAN_v$version.md"
  
  # Update release planning file with version
  sed -i "s/# Release Notes Template/# FHIR.js v$version Release Planning/" "$DOCS_DIR/releases/upcoming/RELEASE_PLAN_v$version.md"
  sed -i "s/\[X\.Y\.Z\]/$version/" "$DOCS_DIR/releases/upcoming/RELEASE_PLAN_v$version.md"
  
  today=$(date +%Y-%m-%d)
  quarter=$(( ($(date +%-m) - 1) / 3 + 1 ))
  year=$(date +%Y)
  sed -i "s/\[YYYY-MM-DD\]/$today/" "$DOCS_DIR/releases/upcoming/RELEASE_PLAN_v$version.md"
  sed -i "s/## Target Release Date/## Target Release Date\n\nQ$quarter $year/" "$DOCS_DIR/releases/upcoming/RELEASE_PLAN_v$version.md"
  
  echo "Created release planning document for v$version."
}

# List all issues, optionally filtered by status
function list_issues {
  local status=$1
  
  if [ -z "$status" ]; then
    echo "All Issues:"
    echo ""
    
    for s in active planned resolved blocked; do
      echo "## $s issues:"
      if ls "$ISSUES_DIR/$s/"*.md 2>/dev/null | grep -v -- "-updates.md" >/dev/null; then
        for file in "$ISSUES_DIR/$s/"*.md; do
          if [[ $file != *-updates.md ]]; then
            id=$(basename "$file" .md)
            title=$(grep "^# " "$file" | sed 's/^# //')
            echo "- $title"
          fi
        done
      else
        echo "No issues in $s status."
      fi
      echo ""
    done
    
    echo "## Enhancements:"
    if ls "$ISSUES_DIR/enhancements/"*.md 2>/dev/null | grep -v -- "-updates.md" >/dev/null; then
      for file in "$ISSUES_DIR/enhancements/"*.md; do
        if [[ $file != *-updates.md ]]; then
          id=$(basename "$file" .md)
          title=$(grep "^# " "$file" | sed 's/^# //')
          echo "- $title"
        fi
      done
    else
      echo "No enhancement proposals."
    fi
  else
    # Check if status is valid
    case "$status" in
      active|planned|resolved|blocked|enhancements) ;;
      *)
        echo "Error: Invalid status. Use one of: active, planned, resolved, blocked, enhancements"
        exit 1
        ;;
    esac
    
    echo "Issues with status '$status':"
    echo ""
    
    if ls "$ISSUES_DIR/$status/"*.md 2>/dev/null | grep -v -- "-updates.md" >/dev/null; then
      for file in "$ISSUES_DIR/$status/"*.md; do
        if [[ $file != *-updates.md ]]; then
          id=$(basename "$file" .md)
          title=$(grep "^# " "$file" | sed 's/^# //')
          echo "- $title"
        fi
      done
    else
      echo "No issues with status '$status'."
    fi
  fi
}

# Main script logic
case "$1" in
  create-issue)
    if [ "$#" -lt 4 ]; then
      echo "Error: Missing arguments for create-issue."
      echo "Usage: ./manage-project.sh create-issue TYPE ID TITLE [STATUS]"
      exit 1
    fi
    create_issue "$2" "$3" "$4" "${5:-active}"
    ;;
  update-issue)
    if [ "$#" -lt 2 ]; then
      echo "Error: Missing arguments for update-issue."
      echo "Usage: ./manage-project.sh update-issue ID"
      exit 1
    fi
    validate_issue_id "$2"
    
    # Find current status
    current_status=""
    for status in active planned resolved blocked; do
      if [ -f "$ISSUES_DIR/$status/$2.md" ]; then
        current_status=$status
        break
      fi
    done
    
    if [ -z "$current_status" ]; then
      if [ -f "$ISSUES_DIR/enhancements/$2.md" ]; then
        create_update_file "$2" "enhancements"
      else
        echo "Error: Issue $2 not found in any status."
        exit 1
      fi
    else
      create_update_file "$2" "$current_status"
    fi
    ;;
  move-issue)
    if [ "$#" -lt 3 ]; then
      echo "Error: Missing arguments for move-issue."
      echo "Usage: ./manage-project.sh move-issue ID STATUS"
      exit 1
    fi
    move_issue "$2" "$3"
    ;;
  create-enhancement)
    if [ "$#" -lt 3 ]; then
      echo "Error: Missing arguments for create-enhancement."
      echo "Usage: ./manage-project.sh create-enhancement ID TITLE"
      exit 1
    fi
    create_enhancement "$2" "$3"
    ;;
  create-adr)
    if [ "$#" -lt 3 ]; then
      echo "Error: Missing arguments for create-adr."
      echo "Usage: ./manage-project.sh create-adr ID TITLE"
      exit 1
    fi
    create_adr "$2" "$3"
    ;;
  create-meeting)
    if [ "$#" -lt 2 ]; then
      echo "Error: Missing arguments for create-meeting."
      echo "Usage: ./manage-project.sh create-meeting DATE [TITLE]"
      exit 1
    fi
    create_meeting "$2" "${3:-Team Meeting}"
    ;;
  create-release)
    if [ "$#" -lt 2 ]; then
      echo "Error: Missing arguments for create-release."
      echo "Usage: ./manage-project.sh create-release VERSION"
      exit 1
    fi
    create_release "$2"
    ;;
  list-issues)
    list_issues "${2:-}"
    ;;
  help)
    show_help
    ;;
  *)
    echo "Error: Unknown command '$1'"
    show_help
    exit 1
    ;;
esac

exit 0
