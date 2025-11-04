#!/usr/bin/env node

/**
 * Update Snow-Flow and all dependencies to latest versions
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔄 Updating Snow-Flow dependencies...\n');

try {
  // Read package.json to get required versions
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  // Update @groeimetai/snow-code
  const snowCodeVersion = packageJson.peerDependencies['@groeimetai/snow-code'];
  console.log(`📦 Updating @groeimetai/snow-code to ${snowCodeVersion}...`);

  try {
    execSync(`npm install @groeimetai/snow-code@${snowCodeVersion}`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ @groeimetai/snow-code updated\n');
  } catch (err) {
    console.error('❌ Failed to update @groeimetai/snow-code');
    console.error(err.message);
  }

  // Clean npm cache to ensure fresh install
  console.log('🧹 Cleaning npm cache...');
  try {
    execSync('npm cache clean --force', { stdio: 'inherit' });
    console.log('✅ Cache cleaned\n');
  } catch (err) {
    console.log('⚠️  Cache clean skipped\n');
  }

  // Reinstall all dependencies
  console.log('📦 Reinstalling all dependencies...');
  try {
    execSync('npm install', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Dependencies reinstalled\n');
  } catch (err) {
    console.error('❌ Failed to reinstall dependencies');
    console.error(err.message);
  }

  // Rebuild native modules if any
  console.log('🔨 Rebuilding native modules...');
  try {
    execSync('npm rebuild', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Native modules rebuilt\n');
  } catch (err) {
    console.log('⚠️  Rebuild skipped (no native modules)\n');
  }

  // Apply patches
  console.log('🩹 Applying patches...');
  try {
    execSync('npx patch-package', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('✅ Patches applied\n');
  } catch (err) {
    console.log('⚠️  No patches to apply\n');
  }

  console.log('🎉 Update complete!\n');
  console.log('💡 If you still experience issues, try:');
  console.log('   1. rm -rf node_modules package-lock.json');
  console.log('   2. npm install');
  console.log('   3. npm run update-deps\n');

} catch (error) {
  console.error('❌ Update failed:', error.message);
  console.log('\n💡 Try manually:');
  console.log('   npm install @groeimetai/snow-code@latest');
  process.exit(1);
}
