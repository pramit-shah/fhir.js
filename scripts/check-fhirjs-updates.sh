#!/bin/bash

# FHIR.js Update Checker
# This script checks for updates to the FHIR.js library
# Usage: ./check-fhirjs-updates.sh [--notify]

set -e

# Configuration
REPO_URL="https://api.github.com/repos/pramit-shah/fhir.js"
PACKAGE_NAME="fhir-js-enhanced"
CONFIG_FILE="${HOME}/.fhirjs-update-config"
NOTIFY_FLAG=""

# Process flags
for arg in "$@"; do
  case $arg in
    --notify)
      NOTIFY_FLAG="true"
      shift
      ;;
  esac
done

# Create config file if it doesn't exist
if [ ! -f "${CONFIG_FILE}" ]; then
  echo "last_check=$(date +%s)" > "${CONFIG_FILE}"
  echo "last_version=0.0.0" >> "${CONFIG_FILE}"
  echo "Created configuration file at ${CONFIG_FILE}"
fi

# Load configuration
source "${CONFIG_FILE}"

# Function to compare semantic versions
version_gt() {
  test "$(printf '%s\n' "$1" "$2" | sort -V | head -n 1)" != "$1"
}

# Check for GitHub updates
echo "Checking for updates to FHIR.js..."

# Get latest release from GitHub API
github_release=$(curl -s "${REPO_URL}/releases/latest")
if [ $? -ne 0 ]; then
  echo "Error: Failed to fetch data from GitHub API."
  exit 1
fi

github_version=$(echo "${github_release}" | grep -o '"tag_name": *"[^"]*"' | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+')
if [ -z "${github_version}" ]; then
  echo "Error: Could not determine latest version from GitHub."
  exit 1
fi

# Get latest version from npm
npm_version=$(npm view ${PACKAGE_NAME} version 2>/dev/null)
if [ $? -ne 0 ]; then
  echo "Warning: Failed to check npm version. Continuing with GitHub check only."
  npm_version="0.0.0"
fi

# Determine latest version
latest_version="${github_version}"
if version_gt "${npm_version}" "${github_version}"; then
  latest_version="${npm_version}"
fi

echo "Current known version: ${last_version}"
echo "Latest available version: ${latest_version}"

# Check if new version is available
if version_gt "${latest_version}" "${last_version}"; then
  echo "=========================================="
  echo "🔔 UPDATE AVAILABLE: ${latest_version}"
  echo "=========================================="
  echo "Release notes: https://github.com/pramit-shah/fhir.js/releases/tag/${latest_version}"
  
  # Update the last known version
  sed -i "s/last_version=.*/last_version=${latest_version}/" "${CONFIG_FILE}"
  
  # Send desktop notification if requested
  if [ -n "${NOTIFY_FLAG}" ] && command -v notify-send &> /dev/null; then
    notify-send "FHIR.js Update Available" "Version ${latest_version} is now available. Check the release notes for details."
  fi
  
  # Output update commands
  echo ""
  echo "To update your package:"
  echo "  npm install ${PACKAGE_NAME}@${latest_version}"
  echo ""
  echo "To update your forked repository:"
  echo "  git fetch upstream"
  echo "  git checkout main"
  echo "  git merge upstream/main"
  echo ""
else
  echo "✅ You have the latest version: ${latest_version}"
fi

# Update last check timestamp
sed -i "s/last_check=.*/last_check=$(date +%s)/" "${CONFIG_FILE}"

echo "Last checked: $(date)"
echo "Done."
