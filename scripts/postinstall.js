#!/usr/bin/env node

// Gracefully handle missing dependencies in restricted environments
try {
  const fs = require('fs');
  const path = require('path');
  const os = require('os');

  console.log('🚀 Setting up Snow-Flow...');

  // Fix binary permissions (critical for containers/codespaces)
  try {
    const platforms = [
      'snow-code-darwin-arm64',
      'snow-code-darwin-x64',
      'snow-code-linux-arm64',
      'snow-code-linux-x64',
      'snow-code-windows-x64'
    ];

    // Try both global and local node_modules locations
    const locations = [
      path.join(__dirname, '..', 'node_modules'),
      path.join(process.cwd(), 'node_modules'),
      path.join(os.homedir(), '.npm', '_npx', 'node_modules')
    ];

    platforms.forEach(platform => {
      locations.forEach(location => {
        const binaryPath = path.join(location, '@groeimetai', platform, 'bin', 'snow-code');
        if (fs.existsSync(binaryPath)) {
          try {
            fs.chmodSync(binaryPath, 0o755);
            console.log(`✅ Fixed permissions for ${platform}`);
          } catch (err) {
            // Silently continue if chmod fails
          }
        }
      });
    });
  } catch (error) {
    // Continue silently if permission fixing fails
  }

  // Check if we're in a global install
  const isGlobalInstall = process.env.npm_config_global === 'true' ||
                          process.env.npm_config_global === true;

  if (isGlobalInstall) {
    console.log('✅ Snow-Flow installed globally');
    console.log('📁 Run "snow-flow init" in your project directory to initialize');

    // Create global config directory
    try {
      const globalConfigDir = path.join(os.homedir(), '.snow-flow');
      if (!fs.existsSync(globalConfigDir)) {
        fs.mkdirSync(globalConfigDir, { recursive: true });
        console.log(`✅ Created global config directory at ${globalConfigDir}`);
      }
    } catch (err) {
      // Silently fail if can't create directory
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