#!/usr/bin/env node

/**
 * Automatically sync peerDependencies to latest @groeimetai/snow-code version
 * Runs before publish to ensure users always get the latest snow-code
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function syncSnowCodeVersion() {
  try {
    console.log('🔍 Syncing @groeimetai/snow-code peerDependency to wildcard...');

    // Read current package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Ensure peerDependencies exists
    if (!packageJson.peerDependencies) {
      packageJson.peerDependencies = {};
    }

    // Get current peer dependency version
    const currentVersion = packageJson.peerDependencies['@groeimetai/snow-code'];

    if (currentVersion === '*') {
      console.log(`✓ Already up to date: *`);
      return { updated: false };
    }

    // Update peerDependency to wildcard (matches dependencies field)
    packageJson.peerDependencies['@groeimetai/snow-code'] = '*';

    // Write back to package.json
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf-8'
    );

    console.log(`✅ Updated peerDependency: ${currentVersion} → *`);

    // Stage the change for git
    try {
      execSync('git add package.json', { cwd: path.join(__dirname, '..') });
      console.log('✅ Staged package.json for commit');
    } catch (err) {
      // Git add might fail if not in a git repo, that's ok
    }

    return { updated: true };

  } catch (error) {
    console.error('❌ Failed to sync @groeimetai/snow-code peerDependency:', error.message);
    console.error('   Continuing with current version...');
    return { updated: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  syncSnowCodeVersion().then(result => {
    if (result.updated) {
      console.log('\n🎉 Ready to publish with wildcard @groeimetai/snow-code dependency!');
    } else if (result.error) {
      console.log('\n⚠️  Could not auto-sync, but continuing...');
    }
    process.exit(0);
  });
}

module.exports = { syncSnowCodeVersion };
