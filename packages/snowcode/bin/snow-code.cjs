#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform() === 'win32' ? 'windows' : os.platform();
const arch = os.arch() === 'arm64' ? 'arm64' : 'x64';

const binaryName = platform === 'windows' ? 'snow-code.exe' : 'snow-code';
const platformDir = `snow-flow-${platform}-${arch}`;

// Look for binary in package's bin directory
const packageDir = path.dirname(__dirname);
const binaryPath = path.join(packageDir, 'bin', platformDir, binaryName);

if (!fs.existsSync(binaryPath)) {
  console.error(`Error: Could not find snow-flow binary for ${platform}-${arch}`);
  console.error(`Expected: ${binaryPath}`);
  console.error('');
  console.error('Your platform may not be supported, or the package was not installed correctly.');
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
