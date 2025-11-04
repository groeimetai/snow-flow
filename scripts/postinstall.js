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
      const { updateSnowCode } = require('./update-snow-code.js');

      // Run the update check (async but we don't await in postinstall)
      updateSnowCode(true).then(result => {
        if (result.updated) {
          console.log(`✅ @groeimetai/snow-code ${result.message} (v${result.version})`);
        } else if (result.version) {
          console.log(`✅ @groeimetai/snow-code v${result.version} is up to date`);
        } else {
          console.log('⚠️  Could not update @groeimetai/snow-code');
          console.log('   Run: npm run update-deps');
        }
      }).catch(err => {
        // Silent fail - don't block installation
      });
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