#!/usr/bin/env node

/**
 * Shared utility to automatically update @groeimetai/snow-code
 * Used by both postinstall and init command
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Update @groeimetai/snow-code to match peer dependency requirements
 * @param {boolean} verbose - Show detailed progress messages
 * @returns {Promise<{ updated: boolean, version: string, message: string }>}
 */
async function updateSnowCode(verbose = true) {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
    const requiredSnowCodeVersion = packageJson.peerDependencies['@groeimetai/snow-code'];

    if (!requiredSnowCodeVersion) {
      return {
        updated: false,
        version: null,
        message: 'No peer dependency found for @groeimetai/snow-code'
      };
    }

    // Check installed version
    let installedVersion = null;
    try {
      const snowCodePackageJson = require('@groeimetai/snow-code/package.json');
      installedVersion = snowCodePackageJson.version;
    } catch (e) {
      // snow-code not installed yet
    }

    if (!installedVersion) {
      if (verbose) console.log('📦 Installing @groeimetai/snow-code...');

      try {
        execSync(`npm install @groeimetai/snow-code@${requiredSnowCodeVersion}`, {
          stdio: verbose ? 'inherit' : 'ignore',
          cwd: path.join(__dirname, '..')
        });

        return {
          updated: true,
          version: requiredSnowCodeVersion.replace('^', ''),
          message: 'Installed successfully'
        };
      } catch (err) {
        return {
          updated: false,
          version: null,
          message: `Installation failed: ${err.message}`
        };
      }
    }

    // Check if update is needed
    const semver = installedVersion.split('.').map(Number);
    const requiredSemver = requiredSnowCodeVersion.replace('^', '').split('.').map(Number);

    const needsUpdate = semver[0] < requiredSemver[0] ||
                       (semver[0] === requiredSemver[0] && semver[1] < requiredSemver[1]) ||
                       (semver[0] === requiredSemver[0] && semver[1] === requiredSemver[1] && semver[2] < requiredSemver[2]);

    if (needsUpdate) {
      if (verbose) console.log(`📦 Updating @groeimetai/snow-code from v${installedVersion} to ${requiredSnowCodeVersion}...`);

      try {
        execSync(`npm install @groeimetai/snow-code@${requiredSnowCodeVersion}`, {
          stdio: verbose ? 'inherit' : 'ignore',
          cwd: path.join(__dirname, '..')
        });

        return {
          updated: true,
          version: requiredSnowCodeVersion.replace('^', ''),
          message: 'Updated successfully'
        };
      } catch (err) {
        return {
          updated: false,
          version: installedVersion,
          message: `Update failed: ${err.message}`
        };
      }
    }

    return {
      updated: false,
      version: installedVersion,
      message: 'Already up to date'
    };

  } catch (error) {
    return {
      updated: false,
      version: null,
      message: `Error: ${error.message}`
    };
  }
}

/**
 * Force update to latest version (used by update-deps script)
 * @returns {Promise<{ updated: boolean, version: string, message: string }>}
 */
async function forceUpdateToLatest() {
  try {
    console.log('📦 Fetching latest @groeimetai/snow-code version...');

    const latestVersion = execSync('npm view @groeimetai/snow-code version', {
      encoding: 'utf8'
    }).trim();

    console.log(`📦 Installing @groeimetai/snow-code@${latestVersion}...`);

    execSync(`npm install @groeimetai/snow-code@${latestVersion}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });

    return {
      updated: true,
      version: latestVersion,
      message: 'Updated to latest'
    };
  } catch (error) {
    return {
      updated: false,
      version: null,
      message: `Failed to update: ${error.message}`
    };
  }
}

// CLI interface when run directly
if (require.main === module) {
  const force = process.argv.includes('--force');

  (async () => {
    if (force) {
      const result = await forceUpdateToLatest();
      console.log(result.updated ? '✅' : '❌', result.message);
      process.exit(result.updated ? 0 : 1);
    } else {
      const result = await updateSnowCode(true);
      console.log(result.updated ? '✅' : '✓', result.message);
      process.exit(0);
    }
  })();
}

module.exports = { updateSnowCode, forceUpdateToLatest };
