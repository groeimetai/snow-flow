/**
 * Automatic Snow-Code Update Utility
 * Ensures users always have the LATEST version of @groeimetai/snow-code and platform binaries
 *
 * OPTIMIZED FOR FAST STARTUP:
 * - Caches version checks (1 hour TTL)
 * - Fully async operations (no blocking)
 * - Skips checks if recently verified
 * - Background updates don't block swarm startup
 */

import { spawn, execSync } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { Logger } from './logger.js';

const logger = new Logger('auto-update');

// Cache settings
const CACHE_DIR = join(os.homedir(), '.snow-flow', 'cache');
const VERSION_CACHE_FILE = join(CACHE_DIR, 'version-cache.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface UpdateResult {
  success: boolean;
  mainPackageUpdated: boolean;
  mainPackageVersion: string | null;
  binaryPackagesUpdated: number;
  errors: string[];
  skipped?: boolean;
  fromCache?: boolean;
}

interface VersionCache {
  lastCheck: number;
  latestVersion: string | null;
  installedVersion: string | null;
  updateAvailable: boolean;
}

/**
 * Platform-specific binary packages that need to be updated
 */
const BINARY_PACKAGES = [
  '@groeimetai/snow-flow-darwin-arm64',
  '@groeimetai/snow-flow-darwin-x64',
  '@groeimetai/snow-flow-linux-arm64',
  '@groeimetai/snow-flow-linux-x64',
  '@groeimetai/snow-flow-windows-x64'
];

/**
 * Ensure cache directory exists
 */
function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Read version cache from disk
 */
function readVersionCache(): VersionCache | null {
  try {
    if (existsSync(VERSION_CACHE_FILE)) {
      const data = readFileSync(VERSION_CACHE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.debug('Could not read version cache:', error);
  }
  return null;
}

/**
 * Write version cache to disk
 */
function writeVersionCache(cache: VersionCache): void {
  try {
    ensureCacheDir();
    writeFileSync(VERSION_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.debug('Could not write version cache:', error);
  }
}

/**
 * Check if cache is still valid (within TTL)
 */
function isCacheValid(cache: VersionCache | null): boolean {
  if (!cache) return false;
  const age = Date.now() - cache.lastCheck;
  return age < CACHE_TTL_MS;
}

/**
 * Get the latest version of a package from npm registry (ASYNC - non-blocking)
 */
async function getLatestVersionAsync(packageName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const npmProcess = spawn('npm', ['view', packageName, 'version'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: true
    });

    let version = '';

    npmProcess.stdout?.on('data', (data) => {
      version += data.toString();
    });

    npmProcess.on('close', (code) => {
      if (code === 0 && version.trim()) {
        resolve(version.trim());
      } else {
        resolve(null);
      }
    });

    npmProcess.on('error', () => {
      resolve(null);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      npmProcess.kill();
      resolve(null);
    }, 5000);
  });
}

/**
 * Get currently installed version of a package (sync but fast - just reads local file)
 * @deprecated Use getUsedSnowCodeVersion() instead for checking the actual binary version
 */
function getInstalledVersion(packageName: string, targetDir?: string): string | null {
  try {
    const baseDir = targetDir || process.cwd();
    const packageJsonPath = join(baseDir, 'node_modules', packageName, 'package.json');

    if (!existsSync(packageJsonPath)) {
      return null;
    }

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    return packageJson.version;
  } catch (error) {
    return null;
  }
}

/**
 * Get the version of the snow-code binary that is actually used by spawn()
 * This checks the GLOBAL installation in PATH, not local node_modules
 *
 * CRITICAL: spawn('snow-code', ...) uses PATH lookup, so we need to check
 * the version of the binary that will actually be executed.
 */
function getUsedSnowCodeVersion(): string | null {
  try {
    const version = execSync('snow-code --version', {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr
    }).trim();
    return version || null;
  } catch (error) {
    logger.debug('Could not get snow-code version from PATH:', error);
    return null;
  }
}

/**
 * Check if snow-code is installed globally (in PATH)
 */
function isSnowCodeInPath(): boolean {
  try {
    execSync('which snow-code', {
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Run npm install in background (ASYNC - non-blocking)
 * For global installs, uses --force to handle ENOTEMPTY errors
 */
function runNpmInstallAsync(
  packageName: string,
  global: boolean,
  targetDir?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    // Use --force for global installs to handle ENOTEMPTY and other directory issues
    const args = global
      ? ['install', '-g', `${packageName}@latest`, '--force', '--silent', '--no-audit', '--no-fund']
      : ['install', `${packageName}@latest`, '--silent', '--no-audit', '--no-fund'];

    const npmProcess = spawn('npm', args, {
      stdio: 'ignore',
      shell: true,
      cwd: global ? undefined : (targetDir || process.cwd()),
      detached: true // Run independently of parent
    });

    // Don't wait for completion - let it run in background
    npmProcess.unref();

    // Resolve immediately - update happens in background
    resolve(true);
  });
}

/**
 * Quick check if update is needed using cache
 * Returns immediately if cache is valid
 *
 * IMPORTANT: This now checks the GLOBAL snow-code binary version (from PATH),
 * not the local node_modules version. This is because spawn('snow-code', ...)
 * uses PATH lookup and executes the global binary.
 */
export async function checkForUpdatesWithCache(): Promise<{
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  fromCache: boolean;
}> {
  const packageName = '@groeimetai/snow-code';

  // Check cache first
  const cache = readVersionCache();
  if (isCacheValid(cache)) {
    logger.debug('Using cached version info (age: ' + Math.round((Date.now() - cache!.lastCheck) / 1000) + 's)');
    return {
      updateAvailable: cache!.updateAvailable,
      currentVersion: cache!.installedVersion,
      latestVersion: cache!.latestVersion,
      fromCache: true
    };
  }

  // Cache miss or expired - check versions
  // CRITICAL FIX: Use getUsedSnowCodeVersion() to check the GLOBAL binary,
  // not getInstalledVersion() which only checks local node_modules
  const currentVersion = getUsedSnowCodeVersion();
  const latestVersion = await getLatestVersionAsync(packageName);

  const updateAvailable = currentVersion !== null &&
    latestVersion !== null &&
    currentVersion !== latestVersion;

  // Update cache
  writeVersionCache({
    lastCheck: Date.now(),
    latestVersion,
    installedVersion: currentVersion,
    updateAvailable
  });

  return {
    updateAvailable,
    currentVersion,
    latestVersion,
    fromCache: false
  };
}

/**
 * FAST auto-update function optimized for swarm startup
 * - Returns immediately if cache is valid and no update needed
 * - Triggers background update if needed (non-blocking)
 * - Never blocks the main thread
 *
 * CRITICAL FIX: Now updates the GLOBAL installation (npm install -g)
 * because spawn('snow-code', ...) uses the global binary from PATH.
 */
export async function autoUpdateSnowCode(
  targetDir?: string,
  verbose = false
): Promise<UpdateResult> {
  const result: UpdateResult = {
    success: true,
    mainPackageUpdated: false,
    mainPackageVersion: null,
    binaryPackagesUpdated: 0,
    errors: [],
    skipped: false,
    fromCache: false
  };

  try {
    // Quick cache check
    const versionInfo = await checkForUpdatesWithCache();
    result.mainPackageVersion = versionInfo.latestVersion;
    result.fromCache = versionInfo.fromCache;

    if (!versionInfo.updateAvailable) {
      // No update needed - return immediately
      if (verbose) {
        logger.debug(`✓ snow-code is up-to-date (v${versionInfo.currentVersion})${versionInfo.fromCache ? ' [cached]' : ''}`);
      }
      result.skipped = true;
      return result;
    }

    // Update available - notify user and trigger background install
    // Always show update notification to user (not just in verbose mode)
    console.log(`\n⚡ snow-code update available: v${versionInfo.currentVersion} → v${versionInfo.latestVersion}`);
    console.log('   Updating in background...\n');

    // CRITICAL FIX: Update the GLOBAL installation
    // spawn('snow-code', ...) uses PATH lookup, so we need to update globally
    runNpmInstallAsync('@groeimetai/snow-code', true); // global = true

    // Also update the global platform-specific binary
    const platform = process.platform;
    const arch = process.arch;
    const currentPlatformPackage = `@groeimetai/snow-flow-${platform}-${arch}`;

    if (BINARY_PACKAGES.includes(currentPlatformPackage)) {
      runNpmInstallAsync(currentPlatformPackage, true); // global = true
      result.binaryPackagesUpdated = 1;
    }

    result.mainPackageUpdated = true;

    if (verbose) {
      logger.info('✓ Global update started in background (non-blocking)');
    }

    return result;

  } catch (error) {
    const errorMsg = `Update check failed: ${error instanceof Error ? error.message : 'unknown error'}`;
    result.errors.push(errorMsg);
    logger.debug(errorMsg);
    return result;
  }
}

/**
 * Force clear the version cache (useful for debugging or manual refresh)
 */
export function clearVersionCache(): void {
  try {
    if (existsSync(VERSION_CACHE_FILE)) {
      const { unlinkSync } = require('fs');
      unlinkSync(VERSION_CACHE_FILE);
      logger.debug('Version cache cleared');
    }
  } catch (error) {
    logger.debug('Could not clear version cache:', error);
  }
}

/**
 * Legacy function for backwards compatibility
 * @deprecated Use checkForUpdatesWithCache() instead
 */
export async function checkForUpdates(): Promise<{
  updateAvailable: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
}> {
  const result = await checkForUpdatesWithCache();
  return {
    updateAvailable: result.updateAvailable,
    currentVersion: result.currentVersion,
    latestVersion: result.latestVersion
  };
}
