#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform() === 'win32' ? 'windows' : os.platform();
const arch = os.arch() === 'arm64' ? 'arm64' : 'x64';

const binaryName = platform === 'windows' ? 'snow-code.exe' : 'snow-code';
const packageDir = path.dirname(__dirname);
const binaryPath = path.join(packageDir, 'bin', binaryName);

if (!fs.existsSync(binaryPath)) {
  console.error('Error: snow-flow binary not found.');
  console.error('');
  console.error('The binary should have been downloaded during installation.');
  console.error('Try reinstalling: npm install -g snow-flow');
  console.error('');
  console.error(`Expected binary at: ${binaryPath}`);
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
