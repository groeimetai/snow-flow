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
const tarballName = 'snow-flow-test-' + platform + '-' + arch + '.tar.gz';

const pkgDir = path.join(__dirname, '..');
const binaryName = platform === 'windows' ? 'opencode.exe' : 'opencode';
const binaryPath = path.join(pkgDir, 'bin', binaryName);

if (fs.existsSync(binaryPath)) {
  console.log('snow-flow-test: Binary already exists');
  process.exit(0);
}

const releaseUrl = 'https://github.com/' + REPO + '/releases/download/v' + VERSION + '/' + tarballName;
console.log('snow-flow-test: Downloading binary for ' + platform + '-' + arch + '...');

function followRedirects(url, callback) {
  https.get(url, { headers: { 'User-Agent': 'snow-flow-test' } }, function(res) {
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
    console.warn('snow-flow-test: Could not download binary (HTTP ' + res.statusCode + ')');
    console.warn('snow-flow-test: Download manually from: https://github.com/' + REPO + '/releases');
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
      console.log('snow-flow-test: Binary installed successfully!');
    } catch (e) {
      console.warn('snow-flow-test: Could not extract binary');
    }
    try { fs.rmSync(tmpDir, { recursive: true }); } catch (e) {}
  });
});
