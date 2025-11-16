/**
 * SnowCode Configuration Management
 * Manages ~/.snow-code/config.json for MCP server configuration
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from '../utils/logger.js';

const logger = new Logger('snowcode-config');

/**
 * SnowCode MCP Server Configuration
 * Format matches OpenCode/SnowCode MCP server configuration
 */
export interface SnowCodeMcpServer {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface SnowCodeConfig {
  mcpServers?: Record<string, SnowCodeMcpServer>;
  // Support legacy format
  servers?: Record<string, SnowCodeMcpServer>;
}

/**
 * Enterprise MCP server configuration options
 */
export interface EnterpriseMcpConfig {
  licenseKey: string;
  serverUrl?: string;
  credentials?: {
    jira?: {
      host: string;
      email: string;
      apiToken: string;
    };
    azure?: {
      organization: string;
      pat: string;
    };
    confluence?: {
      host: string;
      email: string;
      apiToken: string;
    };
  };
}

/**
 * Get the SnowCode config file path
 */
export function getSnowCodeConfigPath(): string {
  return path.join(os.homedir(), '.snow-code', 'config.json');
}

/**
 * Check if SnowCode config file exists
 */
export function snowCodeConfigExists(): boolean {
  return existsSync(getSnowCodeConfigPath());
}

/**
 * Read SnowCode configuration file
 * @returns SnowCode configuration or empty object if file doesn't exist
 */
export async function readSnowCodeConfig(): Promise<SnowCodeConfig> {
  const configPath = getSnowCodeConfigPath();

  try {
    if (!existsSync(configPath)) {
      logger.debug('SnowCode config file does not exist yet');
      return {};
    }

    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);

    logger.debug('Successfully read SnowCode config');
    return config;
  } catch (error: any) {
    logger.error(`Failed to read SnowCode config: ${error.message}`);
    return {};
  }
}

/**
 * Write SnowCode configuration file
 * @param config - Configuration to write
 */
export async function writeSnowCodeConfig(config: SnowCodeConfig): Promise<void> {
  const configPath = getSnowCodeConfigPath();
  const configDir = path.dirname(configPath);

  try {
    // Ensure .snow-code directory exists
    if (!existsSync(configDir)) {
      await fs.mkdir(configDir, { recursive: true });
      logger.debug('Created .snow-code directory');
    }

    // Write configuration file
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    logger.info('Successfully wrote SnowCode config');
  } catch (error: any) {
    logger.error(`Failed to write SnowCode config: ${error.message}`);
    throw error;
  }
}

/**
 * Add or update enterprise MCP server in SnowCode config
 * @param config - Enterprise MCP server configuration
 */
export async function addEnterpriseMcpServer(config: EnterpriseMcpConfig): Promise<void> {
  try {
    // Write to .mcp.json in current working directory (where snow-code is run)
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

    // 🔥 FIX: Check if .mcp.json exists - if not, user must run `snow-flow init` first!
    if (!existsSync(mcpConfigPath)) {
      logger.warn('.mcp.json not found in current directory');
      logger.warn('Please run: snow-flow init');
      logger.warn('Then run: snow-flow auth login again');
      throw new Error(
        '.mcp.json not found!\n' +
        'Run "snow-flow init" first to initialize the project.\n' +
        'Then run "snow-flow auth login" again to configure enterprise features.'
      );
    }

    // Read existing .mcp.json
    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(content);
    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }

    // 🔥 FIX: Use REMOTE SSE connection instead of LOCAL proxy
    // Local proxy with environment variables doesn't work reliably in MCP clients
    // Remote SSE connection to enterprise server works correctly
    const serverUrl = config.serverUrl || 'https://enterprise.snow-flow.dev';

    // Add or update enterprise MCP server as REMOTE server (not local!)
    mcpConfig.mcpServers['snow-flow-enterprise'] = {
      type: 'remote',
      url: `${serverUrl}/mcp/sse`,
      description: 'Snow-Flow Enterprise - Jira (22 tools), Azure DevOps (26 tools), Confluence (24 tools) via remote SSE',
      headers: {
        Authorization: `Bearer ${config.licenseKey}`,
      },
      enabled: true,
    };

    // Write updated .mcp.json
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    logger.info(`Successfully added enterprise MCP server to ${mcpConfigPath}`);
  } catch (error: any) {
    logger.error(`Failed to add enterprise MCP server: ${error.message}`);
    throw error;
  }
}

/**
 * Remove enterprise MCP server from SnowCode config
 */
export async function removeEnterpriseMcpServer(): Promise<void> {
  try {
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

    if (!existsSync(mcpConfigPath)) {
      logger.debug('No .mcp.json file found');
      return;
    }

    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(content);

    if (mcpConfig.mcpServers?.['snow-flow-enterprise']) {
      delete mcpConfig.mcpServers['snow-flow-enterprise'];
      await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
      logger.info('Successfully removed enterprise MCP server from .mcp.json');
    } else {
      logger.debug('Enterprise MCP server not found in .mcp.json');
    }
  } catch (error: any) {
    logger.error(`Failed to remove enterprise MCP server: ${error.message}`);
    throw error;
  }
}

/**
 * Check if enterprise MCP server is configured in SnowCode config
 */
export async function isEnterpriseMcpConfigured(): Promise<boolean> {
  try {
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

    if (!existsSync(mcpConfigPath)) {
      return false;
    }

    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(content);

    return !!mcpConfig.mcpServers?.['snow-flow-enterprise'];
  } catch (error) {
    return false;
  }
}

/**
 * Get the path to the enterprise proxy entry point
 * Returns absolute path to the installed snow-flow package
 */
function getEnterpriseProxyPath(): string {
  const { execSync } = require('child_process');

  try {
    // Try to find the installed snow-flow package using npm
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalPath = path.join(npmRoot, 'snow-flow', 'dist', 'mcp', 'enterprise-proxy', 'index.js');

    if (existsSync(globalPath)) {
      logger.debug(`Using enterprise proxy from global npm: ${globalPath}`);
      return globalPath;
    }
  } catch (error) {
    // Global npm root failed, continue to other options
  }

  // Try local node_modules (project directory)
  const localPath = path.join(
    process.cwd(),
    'node_modules',
    'snow-flow',
    'dist',
    'mcp',
    'enterprise-proxy',
    'index.js'
  );

  if (existsSync(localPath)) {
    logger.debug(`Using enterprise proxy from local node_modules: ${localPath}`);
    return localPath;
  }

  // Try development path (when running from source)
  const devPath = path.join(
    __dirname,
    '..',
    '..',
    'dist',
    'mcp',
    'enterprise-proxy',
    'index.js'
  );

  if (existsSync(devPath)) {
    const absoluteDevPath = path.resolve(devPath);
    logger.debug(`Using enterprise proxy from development: ${absoluteDevPath}`);
    return absoluteDevPath;
  }

  // Last resort - try to use require.resolve
  try {
    const resolvedPath = require.resolve('snow-flow/dist/mcp/enterprise-proxy/index.js');
    logger.debug(`Using enterprise proxy from require.resolve: ${resolvedPath}`);
    return resolvedPath;
  } catch (error) {
    // Could not resolve
  }

  // Fallback - return relative path and hope it works
  logger.warn('Enterprise proxy not found in standard locations, using fallback path');
  return path.resolve(__dirname, '..', '..', 'dist', 'mcp', 'enterprise-proxy', 'index.js');
}

/**
 * Get enterprise MCP server configuration from .mcp.json
 */
export async function getEnterpriseMcpConfig(): Promise<any | null> {
  try {
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

    if (!existsSync(mcpConfigPath)) {
      logger.debug('No .mcp.json file found');
      return null;
    }

    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(content);

    const server = mcpConfig.mcpServers?.['snow-flow-enterprise'] || null;

    if (server) {
      logger.debug('Found enterprise MCP server configuration in .mcp.json');
    } else {
      logger.debug('Enterprise MCP server not configured in .mcp.json');
    }

    return server;
  } catch (error: any) {
    logger.error(`Failed to get enterprise MCP config: ${error.message}`);
    return null;
  }
}
