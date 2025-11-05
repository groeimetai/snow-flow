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
    console.log('🔍 Fetching latest @groeimetai/snow-code version from npm...');

    // Fetch latest version from npm registry
    const latestVersion = execSync('npm view @groeimetai/snow-code version', {
      encoding: 'utf8'
    }).trim();

    console.log(`✅ Latest version: ${latestVersion}`);

    // Read current package.json
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Get current peer dependency version
    const currentVersion = packageJson.peerDependencies['@groeimetai/snow-code'];

    if (currentVersion === `^${latestVersion}`) {
      console.log(`✓ Already up to date: ^${latestVersion}`);
      return { updated: false, version: latestVersion };
    }

    // Update peerDependency to latest
    packageJson.peerDependencies['@groeimetai/snow-code'] = `^${latestVersion}`;

    // Write back to package.json
    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf-8'
    );

    console.log(`✅ Updated peerDependency: ${currentVersion} → ^${latestVersion}`);

    // Stage the change for git
    try {
      execSync('git add package.json', { cwd: path.join(__dirname, '..') });
      console.log('✅ Staged package.json for commit');
    } catch (err) {
      // Git add might fail if not in a git repo, that's ok
    }

    return { updated: true, version: latestVersion };

  } catch (error) {
    console.error('❌ Failed to sync @groeimetai/snow-code version:', error.message);
    console.error('   Continuing with current version...');
    return { updated: false, error: error.message };
  }
}

// Run if called directly
if (require.main === module) {
  syncSnowCodeVersion().then(result => {
    if (result.updated) {
      console.log('\n🎉 Ready to publish with latest @groeimetai/snow-code dependency!');
    } else if (result.error) {
      console.log('\n⚠️  Could not auto-sync, but continuing...');
    }
    process.exit(0);
  });
}

module.exports = { syncSnowCodeVersion };
