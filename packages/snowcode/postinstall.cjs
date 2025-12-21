#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');
const zlib = require('zlib');

const platform = os.platform() === 'win32' ? 'windows' : os.platform();
const arch = os.arch() === 'arm64' ? 'arm64' : 'x64';

const binaryName = platform === 'windows' ? 'snow-code.exe' : 'snow-code';
const packageDir = __dirname;
const binDir = path.join(packageDir, 'bin');
const binaryPath = path.join(binDir, binaryName);

// Get version from package.json
function getVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

// Follow redirects and download file
function download(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { 'User-Agent': 'snow-flow-installer' } }, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        download(response.headers.location).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function downloadBinary() {
  const version = getVersion();
  if (!version) {
    console.log('Could not determine version, skipping binary download');
    return false;
  }

  const assetName = `snow-flow-${platform}-${arch}`;
  const tarballName = `${assetName}.tar.gz`;
  const releaseUrl = `https://github.com/groeimetai/snow-flow/releases/download/v${version}/${tarballName}`;

  console.log(`Downloading snow-flow binary for ${platform}-${arch}...`);
  console.log(`URL: ${releaseUrl}`);

  try {
    // Download the tarball
    const tarballData = await download(releaseUrl);

    // Create temp file
    const tmpDir = os.tmpdir();
    const tarballPath = path.join(tmpDir, tarballName);
    fs.writeFileSync(tarballPath, tarballData);

    // Ensure bin directory exists
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true });
    }

    // Extract using tar command
    console.log('Extracting binary...');
    execSync(`tar -xzf "${tarballPath}" -C "${binDir}" --strip-components=1`, { stdio: 'pipe' });

    // Clean up
    fs.unlinkSync(tarballPath);

    // Make executable on non-Windows
    if (platform !== 'windows' && fs.existsSync(binaryPath)) {
      fs.chmodSync(binaryPath, 0o755);
    }

    console.log('✅ Binary installed successfully!');
    return true;
  } catch (error) {
    console.log(`Note: Could not download pre-built binary (${error.message})`);
    console.log('You may need to build from source or check your network connection.');
    return false;
  }
}

// Only run if binary doesn't exist
if (!fs.existsSync(binaryPath)) {
  downloadBinary().catch(err => {
    console.log(`Download failed: ${err.message}`);
  });
} else {
  // Make sure it's executable
  if (platform !== 'windows') {
    try {
      fs.chmodSync(binaryPath, 0o755);
    } catch {}
  }
}
