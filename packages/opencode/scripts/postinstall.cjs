#!/usr/bin/env node
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const pkg = require('../package.json');
const VERSION = pkg.version;
const REPO = 'groeimetai/snow-flow';

const platformMap = { darwin: 'darwin', linux: 'linux', win32: 'windows' };
const archMap = { x64: 'x64', arm64: 'arm64' };

const platform = platformMap[os.platform()] || os.platform();
const arch = archMap[os.arch()] || os.arch();
const tarballName = 'snow-flow-' + platform + '-' + arch + '.tar.gz';

const pkgDir = path.join(__dirname, '..');
const binaryName = platform === 'windows' ? 'snow-code.exe' : 'snow-code';
const binaryPath = path.join(pkgDir, 'bin', binaryName);

// Check if file exists AND is a real binary (not just a launcher script)
// Launcher scripts are small (~2KB), actual binaries are 20MB+
if (fs.existsSync(binaryPath)) {
  var stats = fs.statSync(binaryPath);
  if (stats.size > 100000) { // > 100KB means it's a real binary
    console.log('snow-code: Binary already exists');
    process.exit(0);
  }
}

const releaseUrl = 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/' + tarballName;
console.log('snow-code: Downloading binary for ' + platform + '-' + arch + '...');

function followRedirects(url, callback) {
  https.get(url, { headers: { 'User-Agent': 'snow-code' } }, function(res) {
    if (res.statusCode === 302 || res.statusCode === 301) {
      followRedirects(res.headers.location, callback);
    } else {
      callback(res);
    }
  });
}

var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'snow-flow-'));
var tarPath = path.join(tmpDir, tarballName);
var file = fs.createWriteStream(tarPath);

followRedirects(releaseUrl, function(res) {
  if (res.statusCode !== 200) {
    console.warn('snow-code: Could not download binary (HTTP ' + res.statusCode + ')');
    console.warn('snow-code: Download manually from: https://github.com/' + REPO + '/releases');
    process.exit(0);
  }

  res.pipe(file);
  file.on('finish', function() {
    file.close();
    try {
      execSync('tar -xzf "' + tarPath + '" -C "' + pkgDir + '"', { stdio: 'pipe' });
      if (platform !== 'windows' && fs.existsSync(binaryPath)) {
        fs.chmodSync(binaryPath, 493);
      }
      console.log('snow-code: Binary installed successfully!');
    } catch (e) {
      console.warn('snow-code: Could not extract binary');
    }
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  });
});
