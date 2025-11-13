#!/usr/bin/env node

/**
 * Test the ensureCorrectAuthLocation function
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');

async function ensureCorrectAuthLocation() {
  try {
    const correctPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');
    const incorrectPath = path.join(os.homedir(), '.local', 'share', 'snowcode', 'auth.json');

    console.log('🔍 Checking auth.json location...');
    console.log('   Correct path:', correctPath);
    console.log('   Incorrect path:', incorrectPath);
    console.log('');

    // Check if file exists at incorrect location
    try {
      await fs.access(incorrectPath);

      // File exists at wrong location - move it
      console.log('❌ Found auth.json at incorrect location (snowcode/ without dash)');
      console.log('📦 Moving to correct location (snow-code/ with dash)...');

      // Ensure correct directory exists
      const correctDir = path.dirname(correctPath);
      await fs.mkdir(correctDir, { recursive: true });

      // Copy file to correct location
      await fs.copyFile(incorrectPath, correctPath);
      console.log('✅ Copied auth.json to:', correctPath);

      // Create symlink at old location for backwards compatibility
      try {
        const incorrectDir = path.dirname(incorrectPath);
        await fs.mkdir(incorrectDir, { recursive: true });

        // Remove old file after successful copy
        await fs.unlink(incorrectPath);
        console.log('🗑️  Removed old file from incorrect location');

        // Create symlink
        await fs.symlink(correctPath, incorrectPath);
        console.log('🔗 Created symlink for backwards compatibility');
      } catch (symlinkError) {
        console.warn('⚠️  Could not create symlink:', symlinkError.message);
      }

      console.log('');
      console.log('✅ Auth credentials stored at correct location!');
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        // File doesn't exist at incorrect location - check if it's already at correct location
        try {
          await fs.access(correctPath);
          console.log('✅ Auth.json already at correct location');
          return true;
        } catch {
          console.log('ℹ️  Auth.json not found at either location');
          console.log('   (It will be created on next auth)');
          return false;
        }
      }
      throw err;
    }
  } catch (error) {
    console.error('❌ Failed:', error.message);
    return false;
  }
}

// Run the test
ensureCorrectAuthLocation().then(success => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('Test result:', success ? '✅ PASSED' : '❌ FAILED');
  console.log('═══════════════════════════════════════════════════════════');
  process.exit(success ? 0 : 1);
});
