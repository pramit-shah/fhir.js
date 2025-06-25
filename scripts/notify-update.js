#!/usr/bin/env node

/**
 * Script to notify users about updates to the FHIR.js library
 * This script is called automatically after a new version is published
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const package = require('../package.json');

// Configuration
const VERSION = package.version;
const CONTACT_EMAIL = package.contactEmail || 'pylabsinc@gmail.com';
const REPO_URL = package.repository.url;
const WEBHOOK_URL = process.env.UPDATE_WEBHOOK_URL; // Set this in your CI environment

console.log(`📣 Preparing notifications for version ${VERSION}`);

// Read the changelog to get release notes
function getChangelogContent() {
  try {
    const changelog = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
    // Extract the section for the current version
    const versionRegex = new RegExp(`## v${VERSION.replace(/\./g, '\\.')}[\\s\\S]*?(?=## |$)`, 'gm');
    const match = changelog.match(versionRegex);
    return match ? match[0].trim() : `Version ${VERSION} released. See CHANGELOG.md for details.`;
  } catch (err) {
    console.error('Error reading changelog:', err);
    return `Version ${VERSION} released. See CHANGELOG.md for details.`;
  }
}

// Prepare notification content
const changelogContent = getChangelogContent();
const releaseDate = new Date().toISOString().split('T')[0];
const notificationContent = {
  version: VERSION,
  releaseDate: releaseDate,
  summary: `FHIR.js version ${VERSION} has been released.`,
  changelogUrl: `${REPO_URL.replace('.git', '')}/blob/main/CHANGELOG.md`,
  releaseUrl: `${REPO_URL.replace('.git', '')}/releases/tag/v${VERSION}`,
  installCommand: `npm install fhir-js-enhanced@${VERSION}`,
  contactEmail: CONTACT_EMAIL,
  changelog: changelogContent
};

// Function to send webhook notification (for integrations)
function sendWebhookNotification() {
  if (!WEBHOOK_URL) {
    console.log('⏩ No webhook URL configured, skipping webhook notification');
    return;
  }
  
  console.log('🔔 Sending webhook notification...');
  
  const postData = JSON.stringify(notificationContent);
  
  const url = new URL(WEBHOOK_URL);
  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname + url.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    if (res.statusCode === 200) {
      console.log('✅ Webhook notification sent successfully');
    } else {
      console.log(`❌ Webhook notification failed with status ${res.statusCode}`);
    }
  });

  req.on('error', (e) => {
    console.error(`❌ Problem with webhook notification: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

// Record this version in notifications history
function recordNotification() {
  const notificationHistoryDir = path.join(__dirname, '../docs/project-management/notifications');
  
  if (!fs.existsSync(notificationHistoryDir)) {
    fs.mkdirSync(notificationHistoryDir, { recursive: true });
  }
  
  const notificationPath = path.join(notificationHistoryDir, `${VERSION}.json`);
  fs.writeFileSync(notificationPath, JSON.stringify(notificationContent, null, 2));
  console.log(`✅ Notification recorded in ${notificationPath}`);

  // Update the index file with all notifications
  const indexPath = path.join(notificationHistoryDir, 'index.json');
  let index = [];
  
  if (fs.existsSync(indexPath)) {
    try {
      index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    } catch (err) {
      console.error('Error reading notification index:', err);
    }
  }
  
  // Add this version if not already present
  if (!index.find(item => item.version === VERSION)) {
    index.push({
      version: VERSION,
      releaseDate,
      notificationFile: `${VERSION}.json`
    });
    
    // Sort by version (newest first)
    index.sort((a, b) => {
      const partsA = a.version.split('.').map(Number);
      const partsB = b.version.split('.').map(Number);
      
      for (let i = 0; i < 3; i++) {
        if (partsA[i] !== partsB[i]) {
          return partsB[i] - partsA[i];
        }
      }
      return 0;
    });
    
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
    console.log(`✅ Notification index updated`);
  }
}

// Create notification markdown file
function createNotificationMarkdown() {
  const notificationDir = path.join(__dirname, '../docs/project-management/notifications/releases');
  
  if (!fs.existsSync(notificationDir)) {
    fs.mkdirSync(notificationDir, { recursive: true });
  }
  
  const notificationPath = path.join(notificationDir, `v${VERSION}.md`);
  
  const content = `# FHIR.js Release v${VERSION}

Release Date: ${releaseDate}

## Installation

To install this version:

\`\`\`bash
npm install fhir-js-enhanced@${VERSION}
\`\`\`

## Changelog

${changelogContent}

## Links

- [Full Changelog](${notificationContent.changelogUrl})
- [Release Page](${notificationContent.releaseUrl})
- [Report Issues](${REPO_URL.replace('.git', '')}/issues)

## Contact

For questions or feedback about this release, please contact: ${CONTACT_EMAIL}
`;

  fs.writeFileSync(notificationPath, content);
  console.log(`✅ Notification markdown created: ${notificationPath}`);
}

// Main execution
function main() {
  console.log(`🚀 Processing notifications for FHIR.js v${VERSION}`);
  
  // Record the notification
  recordNotification();
  
  // Create notification markdown
  createNotificationMarkdown();
  
  // Send webhook notification
  sendWebhookNotification();
  
  console.log('✨ Notification process completed successfully');
}

main();
