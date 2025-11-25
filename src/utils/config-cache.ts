/**
 * Config Cache Utility
 * Caches frequently accessed config files in memory to speed up swarm startup
 *
 * Benefits:
 * - Avoids repeated disk reads for config files
 * - In-memory cache with TTL
 * - Automatic invalidation on file changes (via mtime check)
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import os from 'os';

interface CacheEntry<T> {
  data: T;
  mtime: number;
  loadedAt: number;
}

// In-memory cache
const configCache = new Map<string, CacheEntry<any>>();

// Cache TTL - configs are cached for 5 minutes (but invalidated if file changes)
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get file modification time (fast stat call)
 */
function getFileMtime(filePath: string): number | null {
  try {
    const stats = statSync(filePath);
    return stats.mtimeMs;
  } catch {
    return null;
  }
}

/**
 * Check if cache entry is valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined, filePath: string): boolean {
  if (!entry) return false;

  // Check TTL
  const age = Date.now() - entry.loadedAt;
  if (age > CACHE_TTL_MS) return false;

  // Check if file was modified
  const currentMtime = getFileMtime(filePath);
  if (currentMtime === null) return false;
  if (currentMtime !== entry.mtime) return false;

  return true;
}

/**
 * Load and cache a JSON config file
 */
export function loadJsonConfig<T>(filePath: string): T | null {
  // Check cache first
  const cached = configCache.get(filePath);
  if (isCacheValid(cached, filePath)) {
    return cached!.data as T;
  }

  // Load from disk
  try {
    if (!existsSync(filePath)) {
      return null;
    }

    const content = readFileSync(filePath, 'utf8');
    const data = JSON.parse(content) as T;
    const mtime = getFileMtime(filePath);

    // Store in cache
    if (mtime !== null) {
      configCache.set(filePath, {
        data,
        mtime,
        loadedAt: Date.now()
      });
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * Pre-defined config paths for snow-flow/snow-code
 */
export const CONFIG_PATHS = {
  // Global snow-code config (config.json is primary, snow-code.json is legacy fallback)
  globalSnowCodeConfig: join(os.homedir(), '.snow-code', 'config.json'),
  globalSnowCodeConfigAlt: join(os.homedir(), '.snow-code', 'snow-code.json'),

  // Global snow-flow config
  globalSnowFlowConfig: join(os.homedir(), '.config', 'snow-code', 'config.json'),

  // Local configs (relative to cwd) - config.json is primary, snow-code.json is legacy fallback
  localSnowCodeConfig: (cwd: string = process.cwd()) => join(cwd, '.snow-code', 'config.json'),
  localSnowCodeConfigAlt: (cwd: string = process.cwd()) => join(cwd, '.snow-code', 'snow-code.json'),
  localMcpConfig: (cwd: string = process.cwd()) => join(cwd, '.mcp.json'),

  // Enterprise config
  enterpriseCacheDir: join(os.homedir(), '.snow-flow', 'cache'),
};

/**
 * Load snow-code config with fallback paths
 * Tries multiple locations and returns the first valid config
 */
export function loadSnowCodeConfig(cwd: string = process.cwd()): any | null {
  const paths = [
    CONFIG_PATHS.localSnowCodeConfig(cwd),
    CONFIG_PATHS.localSnowCodeConfigAlt(cwd),
    CONFIG_PATHS.globalSnowCodeConfig,
    CONFIG_PATHS.globalSnowCodeConfigAlt,
    CONFIG_PATHS.globalSnowFlowConfig,
  ];

  for (const path of paths) {
    const config = loadJsonConfig(path);
    if (config) {
      return config;
    }
  }

  return null;
}

/**
 * Load MCP config (.mcp.json)
 */
export function loadMcpConfig(cwd: string = process.cwd()): any | null {
  return loadJsonConfig(CONFIG_PATHS.localMcpConfig(cwd));
}

/**
 * Clear all cached configs (useful for testing or forced refresh)
 */
export function clearConfigCache(): void {
  configCache.clear();
}

/**
 * Clear a specific cached config
 */
export function invalidateConfig(filePath: string): void {
  configCache.delete(filePath);
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): {
  entries: number;
  paths: string[];
} {
  return {
    entries: configCache.size,
    paths: Array.from(configCache.keys())
  };
}
