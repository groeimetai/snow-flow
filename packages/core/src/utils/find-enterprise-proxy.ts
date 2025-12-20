/**
 * Enterprise Proxy Path Resolution
 * Shared utility for finding the snow-flow-enterprise proxy across different installation scenarios
 */

import path from 'path';
import os from 'os';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import { Logger } from './logger.js';

const logger = new Logger('enterprise-proxy-finder');

/**
 * Find the enterprise proxy path dynamically
 * Works for: global install, development setup, monorepo, custom paths
 *
 * @returns Absolute path to enterprise-proxy.js or null if not found
 */
export function findEnterpriseProxyPath(): string | null {
  const possiblePaths: string[] = [];

  try {
    // 1. Try global npm installation (most common for end users)
    try {
      const globalNodeModules = execSync('npm root -g', { encoding: 'utf-8' }).trim();
      const globalEnterprise = path.join(
        globalNodeModules,
        'snow-flow-enterprise',
        'mcp-proxy',
        'dist',
        'enterprise-proxy.js'
      );
      possiblePaths.push(globalEnterprise);
    } catch (e) {
      // npm command failed, skip
    }

    // 2. Find snow-flow package location, then go to parent and look for enterprise
    try {
      // Try to resolve snow-flow package
      const snowFlowPackage = require.resolve('snow-flow/package.json');
      const snowFlowRoot = path.dirname(snowFlowPackage);
      const snowFlowParent = path.dirname(snowFlowRoot);
      const enterpriseFromSnowFlow = path.join(
        snowFlowParent,
        'snow-flow-enterprise',
        'mcp-proxy',
        'dist',
        'enterprise-proxy.js'
      );
      possiblePaths.push(enterpriseFromSnowFlow);
    } catch (e) {
      // Could not resolve snow-flow package, skip
    }

    // 3. Development setup - enterprise next to current working directory
    possiblePaths.push(
      path.join(process.cwd(), '..', 'snow-flow-enterprise', 'mcp-proxy', 'dist', 'enterprise-proxy.js')
    );

    // 4. Development setup - enterprise in parent of parent (monorepo style)
    possiblePaths.push(
      path.join(process.cwd(), '..', '..', 'snow-flow-enterprise', 'mcp-proxy', 'dist', 'enterprise-proxy.js')
    );

    // 5. Check common development directories
    const homedir = os.homedir();
    possiblePaths.push(
      path.join(homedir, 'snow-flow-enterprise', 'mcp-proxy', 'dist', 'enterprise-proxy.js'),
      path.join(homedir, 'Snow-Flow-dir', 'snow-flow-enterprise', 'mcp-proxy', 'dist', 'enterprise-proxy.js'),
      path.join(homedir, 'projects', 'snow-flow-enterprise', 'mcp-proxy', 'dist', 'enterprise-proxy.js'),
      path.join(homedir, 'dev', 'snow-flow-enterprise', 'mcp-proxy', 'dist', 'enterprise-proxy.js')
    );

    // 6. Environment variable (highest priority override)
    if (process.env.SNOW_ENTERPRISE_PROXY_PATH) {
      possiblePaths.unshift(process.env.SNOW_ENTERPRISE_PROXY_PATH);
    }

    // Search all possible paths
    for (const testPath of possiblePaths) {
      if (testPath && existsSync(testPath)) {
        logger.debug(`✅ Found enterprise proxy at: ${testPath}`);
        return testPath;
      }
    }

    logger.debug('Enterprise proxy not found in any standard location');
    logger.debug('Tried the following paths:');
    possiblePaths.forEach(p => logger.debug(`  - ${p}`));

    return null;
  } catch (error: any) {
    logger.error(`Error during proxy path resolution: ${error.message}`);
    return null;
  }
}

/**
 * Get the enterprise proxy directory (without /dist/enterprise-proxy.js)
 * This is useful for template replacements like {{ENTERPRISE_PROXY_PATH}}
 *
 * @returns Absolute path to mcp-proxy directory or fallback path
 */
export function getEnterpriseProxyDirectory(): string {
  const proxyPath = findEnterpriseProxyPath();

  if (proxyPath) {
    // Remove /dist/enterprise-proxy.js to get the mcp-proxy directory
    // /path/to/snow-flow-enterprise/mcp-proxy/dist/enterprise-proxy.js
    // → /path/to/snow-flow-enterprise/mcp-proxy
    return path.dirname(path.dirname(proxyPath));
  }

  // Fallback: assume it's next to snow-flow in development
  try {
    const snowFlowPackage = require.resolve('snow-flow/package.json');
    const snowFlowRoot = path.dirname(snowFlowPackage);
    const snowFlowParent = path.dirname(snowFlowRoot);
    return path.join(snowFlowParent, 'snow-flow-enterprise', 'mcp-proxy');
  } catch (e) {
    // Last resort fallback
    return path.join(os.homedir(), 'Snow-Flow-dir', 'snow-flow-enterprise', 'mcp-proxy');
  }
}

/**
 * Check if enterprise proxy is available
 * @returns true if enterprise proxy can be found, false otherwise
 */
export function isEnterpriseProxyAvailable(): boolean {
  return findEnterpriseProxyPath() !== null;
}

/**
 * Get helpful error message when enterprise proxy is not found
 */
export function getEnterpriseProxyNotFoundMessage(): string {
  const possiblePaths: string[] = [];

  try {
    const globalNodeModules = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    possiblePaths.push(path.join(globalNodeModules, 'snow-flow-enterprise'));
  } catch (e) {
    // Skip
  }

  possiblePaths.push(
    path.join(process.cwd(), '..', 'snow-flow-enterprise'),
    path.join(os.homedir(), 'Snow-Flow-dir', 'snow-flow-enterprise')
  );

  return (
    'Enterprise proxy not found!\n\n' +
    '📦 Installation options:\n' +
    '  1. Global install: npm install -g snow-flow-enterprise\n' +
    '  2. Clone repository: git clone https://github.com/groeimetai/snow-flow-enterprise\n' +
    '  3. Set environment variable: export SNOW_ENTERPRISE_PROXY_PATH=/path/to/enterprise-proxy.js\n\n' +
    'Expected locations (searched in order):\n' +
    possiblePaths.map(p => `  - ${p}`).join('\n')
  );
}
