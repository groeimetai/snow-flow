#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');

// Make platform binary executable after install
try {
  const platform = os.platform();
  const arch = os.arch();
  
  // Skip Windows
  if (platform === 'win32') {
    process.exit(0);
  }
  
  // Map Node.js arch to our naming
  const archMap = {
    'arm64': 'arm64',
    'x64': 'x64'
  };
  
  const mappedArch = archMap[arch];
  if (!mappedArch) {
    console.log(`Unknown architecture: ${arch}`);
    process.exit(0);
  }
  
  // Find binary in node_modules
  const binaryPackage = `@groeimetai/snow-flow-${platform}-${mappedArch}`;
  const binaryPath = path.join(__dirname, 'node_modules', binaryPackage, 'bin', 'snow-code');
  
  if (fs.existsSync(binaryPath)) {
    fs.chmodSync(binaryPath, 0o755);
    console.log(`✅ Made ${binaryPackage} executable`);
  }
} catch (error) {
  // Silently fail - not critical
  console.log('Note: Could not set binary permissions (non-critical)');
}
