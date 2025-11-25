/**
 * Automatic Snow-Code Update Utility
 * Ensures users always have the LATEST version of @groeimetai/snow-code and platform binaries
 * Used by init and swarm commands to keep dependencies up-to-date
 *
 * v2.0: Now includes synchronous version checking that runs BEFORE snow-code starts
 *       to ensure the latest version is always used
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { Logger } from './logger.js';

const logger = new Logger('auto-update');

export interface UpdateResult {
  success: boolean;
  mainPackageUpdated: boolean;
  mainPackageVersion: string | null;
  binaryPackagesUpdated: number;
  errors: string[];
}

/**
 * Platform-specific binary packages that need to be updated
 */
const BINARY_PACKAGES = [
  '@groeimetai/snow-code-darwin-arm64',
  '@groeimetai/snow-code-darwin-x64',
  '@groeimetai/snow-code-linux-arm64',
  '@groeimetai/snow-code-linux-x64',
  '@groeimetai/snow-code-windows-x64'
];

/**
 * Get the latest version of a package from npm registry
 */
async function getLatestVersion(packageName: string): Promise<string | null> {
  try {
    const version = execSync(`npm view ${packageName} version 2>/dev/null`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return version || null;
  } catch (error) {
    logger.debug(`Could not fetch latest version for ${packageName}`);
    return null;
  }
}

/**
 * Get the latest version synchronously (for blocking checks)
 */
function getLatestVersionSync(packageName: string): string | null {
  try {
    const version = execSync(`npm view ${packageName} version 2>/dev/null`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return version || null;
  } catch (error) {
    logger.debug(`Could not fetch latest version for ${packageName}`);
    return null;
  }
}

/**
 * Get currently installed version of a package
 */
function getInstalledVersion(packageName: string, targetDir?: string): string | null {
  try {
    const baseDir = targetDir || process.cwd();
    const packageJsonPath = join(baseDir, 'node_modules', packageName, 'package.json');

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    const packageJson = require(packageJsonPath);
    return packageJson.version;
  } catch (error) {
    return null;
  }
}

/**
 * Get the ACTUAL installed version from the snow-code CLI binary
 * This is more reliable than checking package.json because the binary
 * contains the compiled version number
 */
function getInstalledBinaryVersion(): string | null {
  try {
    const version = execSync('snow-code --version 2>/dev/null', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 5000
    }).trim();
    return version || null;
  } catch (error) {
    logger.debug('Could not get installed binary version');
    return null;
  }
}

/**
 * Update main @groeimetai/snow-code package to latest version
 * Installs both globally (for CLI usage) and locally (as dependency)
 */
async function updateMainPackage(
  targetDir?: string,
  verbose = false
): Promise<{ success: boolean; version: string | null; globalUpdated: boolean; localUpdated: boolean }> {
  const packageName = '@groeimetai/snow-code';
  const result = {
    success: false,
    version: null as string | null,
    globalUpdated: false,
    localUpdated: false
  };

  try {
    // Get latest version
    if (verbose) logger.info('Checking for latest snow-code version...');
    const latestVersion = await getLatestVersion(packageName);

    if (!latestVersion) {
      logger.warn('Could not determine latest version from npm');
      return result;
    }

    result.version = latestVersion;

    // Update GLOBAL installation (used by snow-flow CLI commands)
    if (verbose) logger.info(`Updating global ${packageName} to v${latestVersion}...`);
    try {
      execSync(`npm install -g ${packageName}@latest`, {
        stdio: verbose ? 'inherit' : 'ignore',
        encoding: 'utf8'
      });
      result.globalUpdated = true;
      if (verbose) logger.info('✓ Global installation updated');
    } catch (globalErr) {
      logger.debug('Global update failed (non-critical):', globalErr);
      // Continue even if global update fails
    }

    // Update LOCAL installation (as project dependency)
    if (verbose) logger.info(`Updating local ${packageName} to v${latestVersion}...`);
    try {
      const cwd = targetDir || process.cwd();
      execSync(`npm install ${packageName}@latest`, {
        stdio: verbose ? 'inherit' : 'ignore',
        cwd,
        encoding: 'utf8'
      });
      result.localUpdated = true;
      if (verbose) logger.info('✓ Local installation updated');
    } catch (localErr) {
      logger.debug('Local update failed (non-critical):', localErr);
      // Continue even if local update fails
    }

    result.success = result.globalUpdated || result.localUpdated;
    return result;

  } catch (error) {
    logger.error('Failed to update main package:', error);
    return result;
  }
}

/**
 * Update platform-specific binary packages to latest versions
 * Uses platform detection to prioritize the current platform's binary
 */
async function updateBinaryPackages(
  targetDir?: string,
  verbose = false
): Promise<{ updated: number; errors: string[] }> {
  const result = {
    updated: 0,
    errors: [] as string[]
  };

  if (verbose) logger.info('Updating platform-specific binaries...');

  // Detect current platform to prioritize it
  const platform = process.platform;
  const arch = process.arch;
  const currentPlatformPackage = `@groeimetai/snow-code-${platform}-${arch}`;

  // Prioritize current platform, then update others
  const packagesToUpdate = [
    currentPlatformPackage,
    ...BINARY_PACKAGES.filter(pkg => pkg !== currentPlatformPackage)
  ];

  for (const packageName of packagesToUpdate) {
    try {
      const latestVersion = await getLatestVersion(packageName);

      if (!latestVersion) {
        if (verbose) logger.debug(`Skipping ${packageName} (not available)`);
        continue;
      }

      const installedVersion = getInstalledVersion(packageName, targetDir);

      // Only update if not installed or version differs
      if (!installedVersion || installedVersion !== latestVersion) {
        if (verbose) {
          logger.info(`Updating ${packageName} to v${latestVersion}...`);
        }

        const cwd = targetDir || process.cwd();
        execSync(`npm install --no-save --prefer-offline ${packageName}@${latestVersion}`, {
          stdio: verbose ? 'inherit' : 'ignore',
          cwd,
          encoding: 'utf8'
        });

        result.updated++;
        if (verbose) logger.info(`✓ ${packageName} updated`);
      } else {
        if (verbose) logger.debug(`✓ ${packageName} already up-to-date (v${installedVersion})`);
      }
    } catch (error) {
      const errorMsg = `Failed to update ${packageName}: ${error instanceof Error ? error.message : 'unknown error'}`;
      result.errors.push(errorMsg);
      logger.debug(errorMsg);
    }
  }

  return result;
}

/**
 * Comprehensive snow-code update function
 * Updates both main package and platform binaries to latest versions
 *
 * @param targetDir - Target directory for local installations (defaults to cwd)
 * @param verbose - Show detailed progress messages
 * @returns UpdateResult with detailed status
 */
export async function autoUpdateSnowCode(
  targetDir?: string,
  verbose = false
): Promise<UpdateResult> {
  const startTime = Date.now();

  if (verbose) {
    logger.info('🔄 Checking for snow-code updates...');
  }

  const result: UpdateResult = {
    success: false,
    mainPackageUpdated: false,
    mainPackageVersion: null,
    binaryPackagesUpdated: 0,
    errors: []
  };

  try {
    // Update main package (global + local)
    const mainUpdate = await updateMainPackage(targetDir, verbose);
    result.mainPackageUpdated = mainUpdate.success;
    result.mainPackageVersion = mainUpdate.version;

    if (!mainUpdate.success) {
      result.errors.push('Failed to update main snow-code package');
    }

    // Update binary packages
    const binaryUpdate = await updateBinaryPackages(targetDir, verbose);
    result.binaryPackagesUpdated = binaryUpdate.updated;
    result.errors.push(...binaryUpdate.errors);

    // Overall success if at least main package updated
    result.success = mainUpdate.success;

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (verbose) {
      if (result.success) {
        logger.info(`✅ Snow-code updated successfully in ${duration}s`);
        if (result.mainPackageVersion) {
          logger.info(`   Main package: v${result.mainPackageVersion}`);
        }
        if (result.binaryPackagesUpdated > 0) {
          logger.info(`   Binary packages: ${result.binaryPackagesUpdated} updated`);
        }
      } else {
        logger.warn(`⚠️  Snow-code update completed with errors (${duration}s)`);
      }

      if (result.errors.length > 0) {
        logger.debug('Update errors:', result.errors);
      }
    }

    return result;

  } catch (error) {
    const errorMsg = `Unexpected error during update: ${error instanceof Error ? error.message : 'unknown error'}`;
    result.errors.push(errorMsg);
    logger.error(errorMsg);
    return result;
  }
}

/**
 * Quick check if snow-code update is available (without installing)
 * Useful for showing update notifications
 */
export async function checkForUpdates(): Promise<{
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
}> {
  const packageName = '@groeimetai/snow-code';
  const currentVersion = getInstalledVersion(packageName);
  const latestVersion = await getLatestVersion(packageName);

  return {
    updateAvailable: currentVersion !== null && latestVersion !== null && currentVersion !== latestVersion,
    currentVersion,
    latestVersion
  };
}

/**
 * Cache file path for tracking last update check time
 */
const UPDATE_CACHE_FILE = join(process.env.HOME || '', '.snow-flow', '.update-cache.json');

interface UpdateCache {
  lastCheck: number;
  version: string | null;
}

/**
 * Read update cache from disk
 */
function readUpdateCache(): UpdateCache | null {
  try {
    if (existsSync(UPDATE_CACHE_FILE)) {
      const content = require('fs').readFileSync(UPDATE_CACHE_FILE, 'utf8');
      return JSON.parse(content);
    }
  } catch {
    // Ignore cache read errors
  }
  return null;
}

/**
 * Write update cache to disk
 */
function writeUpdateCache(cache: UpdateCache): void {
  try {
    const dir = join(process.env.HOME || '', '.snow-flow');
    if (!existsSync(dir)) {
      require('fs').mkdirSync(dir, { recursive: true });
    }
    require('fs').writeFileSync(UPDATE_CACHE_FILE, JSON.stringify(cache));
  } catch {
    // Ignore cache write errors
  }
}

/**
 * Run update check in background (non-blocking)
 * Returns immediately, update happens asynchronously
 * Uses caching to avoid checking more than once per hour
 *
 * @param targetDir - Target directory for local installations
 * @param verbose - Show detailed progress messages
 * @param cacheTimeMs - Minimum time between checks (default: 1 hour)
 */
export function autoUpdateSnowCodeBackground(
  targetDir?: string,
  verbose = false,
  cacheTimeMs: number = 3600000 // 1 hour default
): void {
  // Check cache first
  const cache = readUpdateCache();
  const now = Date.now();

  if (cache && (now - cache.lastCheck) < cacheTimeMs) {
    // Recent check exists, skip update
    if (verbose) {
      logger.debug(`Skipping update check (last check ${Math.round((now - cache.lastCheck) / 60000)}min ago)`);
    }
    return;
  }

  // Run update in background without blocking
  setImmediate(() => {
    autoUpdateSnowCode(targetDir, verbose)
      .then((result) => {
        // Update cache with current time
        writeUpdateCache({
          lastCheck: Date.now(),
          version: result.mainPackageVersion
        });

        if (verbose && result.mainPackageUpdated) {
          logger.info(`Background update completed: v${result.mainPackageVersion}`);
        }
      })
      .catch((err) => {
        if (verbose) {
          logger.debug('Background update failed:', err);
        }
      });
  });
}

export interface EnsureLatestResult {
  updated: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  error: string | null;
}

/**
 * Force reinstall of snow-code by removing old installation first
 * Handles npm cache issues like ENOTEMPTY errors
 */
function forceReinstallSnowCode(verbose = false): boolean {
  const packageName = '@groeimetai/snow-code';

  try {
    // Find global node_modules path
    const globalPath = execSync('npm root -g', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();

    const packagePath = join(globalPath, '@groeimetai', 'snow-code');

    // Remove old installation if it exists
    if (existsSync(packagePath)) {
      if (verbose) logger.info('Removing old snow-code installation...');
      try {
        rmSync(packagePath, { recursive: true, force: true });
      } catch (rmErr) {
        logger.debug('Could not remove old installation, trying npm uninstall');
        execSync(`npm uninstall -g ${packageName}`, {
          stdio: 'ignore',
          timeout: 30000
        });
      }
    }

    // Fresh install
    if (verbose) logger.info('Installing latest snow-code...');
    execSync(`npm install -g ${packageName}@latest`, {
      stdio: verbose ? 'inherit' : 'ignore',
      timeout: 120000
    });

    return true;
  } catch (error) {
    logger.debug('Force reinstall failed:', error);
    return false;
  }
}

/**
 * SYNCHRONOUS version check and update - runs BEFORE snow-code starts
 * This ensures the latest version is always used, blocking execution until updated
 *
 * @param verbose - Show detailed progress messages
 * @returns Result with current/latest versions and update status
 */
export function ensureLatestSnowCode(verbose = false): EnsureLatestResult {
  const packageName = '@groeimetai/snow-code';
  const result: EnsureLatestResult = {
    updated: false,
    currentVersion: null,
    latestVersion: null,
    error: null
  };

  try {
    // Get currently installed binary version (the actual running version)
    result.currentVersion = getInstalledBinaryVersion();

    // Get latest version from npm
    result.latestVersion = getLatestVersionSync(packageName);

    if (!result.latestVersion) {
      // Can't check npm - might be offline, continue with current version
      if (verbose) logger.debug('Could not fetch latest version (offline?)');
      return result;
    }

    // Compare versions
    if (result.currentVersion === result.latestVersion) {
      // Already up to date
      if (verbose) logger.debug(`snow-code is up to date (v${result.currentVersion})`);
      return result;
    }

    // Version mismatch - need to update
    if (verbose) {
      logger.info(`🔄 Updating snow-code: v${result.currentVersion || 'not installed'} → v${result.latestVersion}`);
    }

    // Try normal update first
    try {
      execSync(`npm install -g ${packageName}@latest`, {
        stdio: verbose ? 'inherit' : 'ignore',
        timeout: 120000
      });
      result.updated = true;
    } catch (installErr: any) {
      // Check for ENOTEMPTY or similar cache errors
      if (installErr.message?.includes('ENOTEMPTY') ||
          installErr.message?.includes('EEXIST') ||
          installErr.status === 190) {
        if (verbose) logger.info('npm cache issue detected, forcing reinstall...');
        result.updated = forceReinstallSnowCode(verbose);
      } else {
        throw installErr;
      }
    }

    // Verify the update worked by checking binary version again
    if (result.updated) {
      const newVersion = getInstalledBinaryVersion();
      if (newVersion === result.latestVersion) {
        if (verbose) logger.info(`✅ snow-code updated to v${result.latestVersion}`);
        result.currentVersion = newVersion;
      } else {
        // Update didn't fully apply (binary might still be old)
        result.updated = false;
        result.error = `Update applied but binary version mismatch: got ${newVersion}, expected ${result.latestVersion}`;
        if (verbose) logger.warn(result.error);
      }
    }

    // Update cache
    writeUpdateCache({
      lastCheck: Date.now(),
      version: result.latestVersion
    });

    return result;

  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error';
    if (verbose) logger.error('Failed to ensure latest snow-code:', result.error);
    return result;
  }
}

/**
 * Quick check if an update is needed (without installing)
 * Returns true if installed version differs from latest
 */
export function needsUpdate(): boolean {
  const currentVersion = getInstalledBinaryVersion();
  const latestVersion = getLatestVersionSync('@groeimetai/snow-code');

  if (!currentVersion || !latestVersion) {
    return false; // Can't determine, assume no update needed
  }

  return currentVersion !== latestVersion;
}
