#!/usr/bin/env node

/**
 * Check for and install updated snow-code binary packages
 * Runs at runtime to ensure users always have the latest binaries
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BINARY_PACKAGES = [
  '@groeimetai/snow-code-darwin-arm64',
  '@groeimetai/snow-code-darwin-x64',
  '@groeimetai/snow-code-linux-arm64',
  '@groeimetai/snow-code-linux-x64',
  '@groeimetai/snow-code-windows-x64'
];

async function getLatestVersionFromNPM(packageName) {
  try {
    const version = execSync(`npm view ${packageName} version 2>/dev/null`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    }).trim();
    return version || null;
  } catch (error) {
    return null;
  }
}

async function getInstalledVersion(packageName) {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'node_modules', packageName, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
  } catch (error) {
    return null;
  }
}

async function checkBinaryUpdates(options = {}) {
  const { silent = false, autoUpdate = false } = options;

  if (!silent) {
    console.log('🔍 Checking for snow-code binary updates...\n');
  }

  const updates = [];
  const errors = [];

  for (const packageName of BINARY_PACKAGES) {
    try {
      const [latest, installed] = await Promise.all([
        getLatestVersionFromNPM(packageName),
        getInstalledVersion(packageName)
      ]);

      if (!latest) {
        if (!silent) {
          console.log(`⚠️  ${packageName}: Not available on npm`);
        }
        continue;
      }

      if (!installed) {
        if (!silent) {
          console.log(`📦 ${packageName}: Not installed (latest: ${latest})`);
        }
        updates.push({ package: packageName, from: null, to: latest });
        continue;
      }

      if (installed !== latest) {
        if (!silent) {
          console.log(`🔄 ${packageName}: ${installed} → ${latest}`);
        }
        updates.push({ package: packageName, from: installed, to: latest });
      } else {
        if (!silent) {
          console.log(`✅ ${packageName}: ${installed} (up to date)`);
        }
      }
    } catch (error) {
      errors.push({ package: packageName, error: error.message });
      if (!silent) {
        console.log(`❌ ${packageName}: Error checking version`);
      }
    }
  }

  console.log('');

  if (updates.length === 0) {
    if (!silent) {
      console.log('✨ All binaries are up to date!\n');
    }
    return { updates: [], errors, updated: false };
  }

  if (!silent) {
    console.log(`📥 Found ${updates.length} update(s) available\n`);
  }

  if (autoUpdate) {
    if (!silent) {
      console.log('⚡ Auto-updating binaries...\n');
    }

    for (const { package: packageName, to } of updates) {
      try {
        if (!silent) {
          console.log(`   Installing ${packageName}@${to}...`);
        }
        execSync(`npm install --no-save --prefer-offline ${packageName}@${to}`, {
          encoding: 'utf8',
          stdio: silent ? 'ignore' : 'inherit'
        });
      } catch (error) {
        errors.push({ package: packageName, error: error.message });
        if (!silent) {
          console.log(`   ❌ Failed to install ${packageName}`);
        }
      }
    }

    if (!silent) {
      console.log('\n✅ Binary updates completed!\n');
    }
    return { updates, errors, updated: true };
  }

  // If not auto-updating, show instructions
  if (!silent) {
    console.log('To update binaries, run:\n');
    console.log('   npm run update-binaries\n');
    console.log('Or manually:');
    for (const { package: packageName, to } of updates) {
      console.log(`   npm install ${packageName}@${to}`);
    }
    console.log('');
  }

  return { updates, errors, updated: false };
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const silent = args.includes('--silent') || args.includes('-s');
  const autoUpdate = args.includes('--auto-update') || args.includes('-u');

  checkBinaryUpdates({ silent, autoUpdate })
    .then(result => {
      if (result.errors.length > 0 && !silent) {
        console.log(`⚠️  ${result.errors.length} error(s) occurred during check`);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Failed to check binary updates:', error.message);
      process.exit(1);
    });
}

module.exports = { checkBinaryUpdates };
