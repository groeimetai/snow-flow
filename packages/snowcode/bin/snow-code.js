#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform() === 'win32' ? 'windows' : os.platform();
const arch = os.arch();

// Map architecture names
const archMap = {
  'arm64': 'arm64',
  'x64': 'x64',
  'x86_64': 'x64'
};

const mappedArch = archMap[arch] || 'x64';
const packageName = `snow-flow-${platform}-${mappedArch}`;

// Search for binary in node_modules
function findBinary() {
  let dir = __dirname;

  // Walk up looking for node_modules
  while (dir !== path.dirname(dir)) {
    // Check in sibling node_modules (for global install)
    const globalPath = path.join(path.dirname(dir), 'node_modules', packageName, 'bin', platform === 'windows' ? 'snow-code.exe' : 'snow-code');
    if (fs.existsSync(globalPath)) {
      return globalPath;
    }

    // Check in parent's node_modules
    const localPath = path.join(dir, 'node_modules', packageName, 'bin', platform === 'windows' ? 'snow-code.exe' : 'snow-code');
    if (fs.existsSync(localPath)) {
      return localPath;
    }

    dir = path.dirname(dir);
  }

  return null;
}

const binaryPath = findBinary();

if (!binaryPath) {
  console.error(`Error: Could not find snow-flow binary for ${platform}-${mappedArch}`);
  console.error(`Expected package: ${packageName}`);
  console.error('');
  console.error('Try reinstalling: npm install -g snow-flow');
  process.exit(1);
}

// Execute the binary
const child = spawn(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

child.on('error', (err) => {
  console.error(`Failed to start snow-flow: ${err.message}`);
  process.exit(1);
});
