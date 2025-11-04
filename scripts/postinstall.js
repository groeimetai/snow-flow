#!/usr/bin/env node

// Gracefully handle missing dependencies in restricted environments
try {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');
  const { execSync } = require('child_process');

  console.log('🚀 Setting up Snow-Flow...');

  // Check if we're in a global install
  const isGlobalInstall = process.env.npm_config_global === 'true' ||
                          process.env.npm_config_global === true;

  // Check and update @groeimetai/snow-code peer dependency
  if (!isGlobalInstall) {
    try {
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      const requiredSnowCodeVersion = packageJson.peerDependencies['@groeimetai/snow-code'];

      // Check installed version
      let installedVersion = null;
      try {
        const snowCodePackageJson = require('@groeimetai/snow-code/package.json');
        installedVersion = snowCodePackageJson.version;
      } catch (e) {
        // snow-code not installed yet
      }

      if (!installedVersion) {
        console.log('📦 Installing @groeimetai/snow-code peer dependency...');
        try {
          execSync(`npm install @groeimetai/snow-code@${requiredSnowCodeVersion} --save-peer`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..')
          });
          console.log('✅ @groeimetai/snow-code installed successfully');
        } catch (err) {
          console.log('⚠️  Please install @groeimetai/snow-code manually:');
          console.log(`   npm install @groeimetai/snow-code@${requiredSnowCodeVersion}`);
        }
      } else {
        // Check if update is needed
        const semver = installedVersion.split('.').map(Number);
        const requiredSemver = requiredSnowCodeVersion.replace('^', '').split('.').map(Number);

        const needsUpdate = semver[0] < requiredSemver[0] ||
                           (semver[0] === requiredSemver[0] && semver[1] < requiredSemver[1]) ||
                           (semver[0] === requiredSemver[0] && semver[1] === requiredSemver[1] && semver[2] < requiredSemver[2]);

        if (needsUpdate) {
          console.log(`📦 Updating @groeimetai/snow-code from v${installedVersion} to ${requiredSnowCodeVersion}...`);
          try {
            execSync(`npm install @groeimetai/snow-code@${requiredSnowCodeVersion} --save-peer`, {
              stdio: 'inherit',
              cwd: path.join(__dirname, '..')
            });
            console.log('✅ @groeimetai/snow-code updated successfully');
          } catch (err) {
            console.log('⚠️  Please update @groeimetai/snow-code manually:');
            console.log(`   npm install @groeimetai/snow-code@${requiredSnowCodeVersion}`);
          }
        } else {
          console.log(`✅ @groeimetai/snow-code v${installedVersion} is up to date`);
        }
      }
    } catch (error) {
      // Continue silently if version check fails
    }
  }

  if (isGlobalInstall) {
    console.log('✅ Snow-Flow installed globally');
    console.log('📁 Run "snow-flow init" in your project directory to initialize');

    // Create global config directory
    const globalConfigDir = path.join(os.homedir(), '.snow-flow');
    if (!fs.existsSync(globalConfigDir)) {
      fs.mkdirSync(globalConfigDir, { recursive: true });
      console.log(`✅ Created global config directory at ${globalConfigDir}`);
    }
  } else {
    // Local installation - don't create directories automatically
    console.log('✅ Snow-Flow installed locally');
    console.log('🔧 Run "snow-flow init" to initialize your project');
  }

  console.log('\n📚 Documentation: https://github.com/groeimetai/snow-flow#readme');
  console.log('🆘 Get help: snow-flow --help');
} catch (error) {
  // Silently fail in restricted environments (Docker, Cloud Build, etc.)
  // The || true in package.json postinstall ensures installation continues
  process.exit(0);
}