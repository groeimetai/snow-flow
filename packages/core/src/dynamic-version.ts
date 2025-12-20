/**
 * Dynamic Version Loading
 * Loads version from package.json at runtime
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Function to find package.json by traversing up the directory tree
function findPackageJson(): string | null {
  const possiblePaths = [
    join(__dirname, '..', 'package.json'),
    join(__dirname, '..', '..', 'package.json'),
    join(process.cwd(), 'package.json'),
    './package.json'
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(path)) {
      return path;
    }
  }
  
  return null;
}

// Get version dynamically
export function getDynamicVersion(): string {
  try {
    const packageJsonPath = findPackageJson();
    if (packageJsonPath) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version;
    }
  } catch (error) {
    console.warn('Warning: Could not read version from package.json:', error);
  }
  
  // Fallback to hardcoded version
  return '4.1.1';
}

// Export a constant that uses the dynamic version
export const VERSION = getDynamicVersion();