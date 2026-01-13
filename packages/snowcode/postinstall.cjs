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
const distDir = path.join(packageDir, 'dist');
const mcpDir = path.join(distDir, 'mcp');
const mcpIndexPath = path.join(mcpDir, 'enterprise-proxy', 'index.js');

// Path to bundled binary (for test packages that include binaries directly)
const bundledBinaryDir = path.join(distDir, `snow-flow-${platform}-${arch}`, 'bin');
const bundledBinaryPath = path.join(bundledBinaryDir, binaryName);

// Get version from package.json
function getVersion() {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8'));
    return pkg.version;
  } catch {
    return null;
  }
}

// Get version from installed binary
function getBinaryVersion() {
  try {
    if (!fs.existsSync(binaryPath)) return null;
    const result = execSync(`"${binaryPath}" --version`, { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    return result.trim();
  } catch {
    return null;
  }
}

// Verify binary is executable on this platform (catches architecture mismatches)
function verifyBinaryWorks() {
  try {
    if (!fs.existsSync(binaryPath)) return false;
    execSync(`"${binaryPath}" --version`, { encoding: 'utf8', stdio: 'pipe', timeout: 5000 });
    return true;
  } catch {
    // Binary exists but can't execute (wrong architecture, corrupted, etc.)
    return false;
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

// Try to copy bundled binary from dist folder (for test packages)
function copyBundledBinary() {
  if (fs.existsSync(bundledBinaryPath)) {
    console.log(`Found bundled binary for ${platform}-${arch}, installing...`);
    try {
      // Ensure bin directory exists
      if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
      }
      // Copy binary
      fs.copyFileSync(bundledBinaryPath, binaryPath);
      // Make executable
      if (platform !== 'windows') {
        fs.chmodSync(binaryPath, 0o755);
      }
      console.log('✅ Binary installed from bundled package!');
      return true;
    } catch (err) {
      console.log(`Could not copy bundled binary: ${err.message}`);
      return false;
    }
  }
  return false;
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

async function downloadMcpServers() {
  const version = getVersion();
  if (!version) {
    console.log('Could not determine version, skipping MCP download');
    return false;
  }

  const tarballName = 'snow-flow-mcp.tar.gz';
  const releaseUrl = `https://github.com/groeimetai/snow-flow/releases/download/v${version}/${tarballName}`;

  console.log('Downloading MCP servers...');

  try {
    // Download the tarball
    const tarballData = await download(releaseUrl);

    // Create temp file
    const tmpDir = os.tmpdir();
    const tarballPath = path.join(tmpDir, tarballName);
    fs.writeFileSync(tarballPath, tarballData);

    // Ensure dist directory exists
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }

    // Extract MCP servers
    console.log('Extracting MCP servers...');
    execSync(`tar -xzf "${tarballPath}" -C "${distDir}"`, { stdio: 'pipe' });

    // Clean up
    fs.unlinkSync(tarballPath);

    console.log('✅ MCP servers installed successfully!');
    return true;
  } catch (error) {
    console.log(`Note: Could not download MCP servers (${error.message})`);
    console.log('Enterprise features may not be available.');
    return false;
  }
}

async function main() {
  const packageVersion = getVersion();
  const binaryVersion = getBinaryVersion();
  const binaryWorks = verifyBinaryWorks();

  // Download binary if missing, incompatible, or version mismatch
  if (!fs.existsSync(binaryPath)) {
    console.log('Binary not found, checking for bundled binary...');
    // Try bundled binary first (for test packages), then download
    if (!copyBundledBinary()) {
      console.log('No bundled binary found, downloading from GitHub releases...');
      await downloadBinary();
    }
  } else if (!binaryWorks) {
    // Binary exists but can't execute (wrong architecture, corrupted, etc.)
    console.log('Binary incompatible with this platform, getting correct version...');
    try {
      fs.unlinkSync(binaryPath);
    } catch {}
    // Try bundled binary first, then download
    if (!copyBundledBinary()) {
      await downloadBinary();
    }
  } else if (packageVersion && binaryVersion && packageVersion !== binaryVersion) {
    console.log(`Version mismatch: binary is ${binaryVersion}, package is ${packageVersion}`);
    console.log('Getting correct version...');
    // Remove old binary first
    try {
      fs.unlinkSync(binaryPath);
    } catch {}
    // Try bundled binary first, then download
    if (!copyBundledBinary()) {
      await downloadBinary();
    }
  } else {
    // Make sure it's executable
    if (platform !== 'windows') {
      try {
        fs.chmodSync(binaryPath, 0o755);
      } catch {}
    }
  }

  // Download MCP servers if needed
  if (!fs.existsSync(mcpIndexPath)) {
    await downloadMcpServers();
  }
}

main().catch(err => {
  console.log(`Postinstall failed: ${err.message}`);
});
