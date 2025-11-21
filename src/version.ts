// Dynamically read version from package.json
// This ensures the version is always up-to-date without manual sync
import { readFileSync } from 'fs';
import { join } from 'path';

let cachedVersion: string | null = null;

function getVersion(): string {
  if (cachedVersion) return cachedVersion;

  try {
    // In CommonJS, __dirname is available
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    cachedVersion = packageJson.version;
    return cachedVersion;
  } catch (error) {
    console.error('Failed to read version from package.json:', error);
    return '0.0.0'; // Fallback
  }
}

// Export as const for backward compatibility
export const VERSION = getVersion();
