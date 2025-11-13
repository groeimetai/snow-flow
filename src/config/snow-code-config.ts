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
    const snowCodeConfig = await readSnowCodeConfig();

    // Determine which key to use (mcpServers is preferred, fallback to servers)
    const serversKey = snowCodeConfig.mcpServers !== undefined ? 'mcpServers' : 'servers';

    if (!snowCodeConfig[serversKey]) {
      snowCodeConfig[serversKey] = {};
    }

    // Get the path to the enterprise proxy entry point
    // This needs to be the compiled dist file
    const enterpriseProxyPath = getEnterpriseProxyPath();

    // Build environment variables
    const env: Record<string, string> = {
      SNOW_LICENSE_KEY: config.licenseKey,
    };

    // Add server URL if provided
    if (config.serverUrl) {
      env.SNOW_ENTERPRISE_URL = config.serverUrl;
    }

    // Add credentials if provided (local mode)
    if (config.credentials) {
      if (config.credentials.jira) {
        env.JIRA_HOST = config.credentials.jira.host;
        env.JIRA_EMAIL = config.credentials.jira.email;
        env.JIRA_API_TOKEN = config.credentials.jira.apiToken;
      }

      if (config.credentials.azure) {
        env.AZURE_DEVOPS_ORG = config.credentials.azure.organization;
        env.AZURE_DEVOPS_PAT = config.credentials.azure.pat;
      }

      if (config.credentials.confluence) {
        env.CONFLUENCE_HOST = config.credentials.confluence.host;
        env.CONFLUENCE_EMAIL = config.credentials.confluence.email;
        env.CONFLUENCE_API_TOKEN = config.credentials.confluence.apiToken;
      }
    }

    // Add or update enterprise MCP server
    snowCodeConfig[serversKey]!['snow-flow-enterprise'] = {
      command: 'node',
      args: [enterpriseProxyPath],
      env,
    };

    // Write updated configuration
    await writeSnowCodeConfig(snowCodeConfig);

    logger.info('Successfully added enterprise MCP server to SnowCode config');
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
    const snowCodeConfig = await readSnowCodeConfig();

    // Check both possible keys
    let removed = false;

    if (snowCodeConfig.mcpServers?.['snow-flow-enterprise']) {
      delete snowCodeConfig.mcpServers['snow-flow-enterprise'];
      removed = true;
    }

    if (snowCodeConfig.servers?.['snow-flow-enterprise']) {
      delete snowCodeConfig.servers['snow-flow-enterprise'];
      removed = true;
    }

    if (removed) {
      await writeSnowCodeConfig(snowCodeConfig);
      logger.info('Successfully removed enterprise MCP server from SnowCode config');
    } else {
      logger.debug('Enterprise MCP server not found in config');
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
    const snowCodeConfig = await readSnowCodeConfig();

    return !!(
      snowCodeConfig.mcpServers?.['snow-flow-enterprise'] ||
      snowCodeConfig.servers?.['snow-flow-enterprise']
    );
  } catch (error) {
    return false;
  }
}

/**
 * Get the path to the enterprise proxy entry point
 * Tries to find the compiled dist file, falls back to source if in development
 */
function getEnterpriseProxyPath(): string {
  // First try to find in node_modules (installed package)
  const nodeModulesPath = path.join(
    process.cwd(),
    'node_modules',
    'snow-flow',
    'dist',
    'mcp',
    'enterprise-proxy',
    'index.js'
  );

  if (existsSync(nodeModulesPath)) {
    logger.debug('Using enterprise proxy from node_modules');
    return nodeModulesPath;
  }

  // Try global installation
  const globalNodeModulesPath = path.join(
    os.homedir(),
    '.npm',
    'lib',
    'node_modules',
    'snow-flow',
    'dist',
    'mcp',
    'enterprise-proxy',
    'index.js'
  );

  if (existsSync(globalNodeModulesPath)) {
    logger.debug('Using enterprise proxy from global installation');
    return globalNodeModulesPath;
  }

  // Fallback to development path (when running from source)
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
    logger.debug('Using enterprise proxy from development build');
    return devPath;
  }

  // Last resort - relative to current file location
  logger.warn('Enterprise proxy not found in standard locations, using relative path');
  return path.join(__dirname, '..', '..', 'dist', 'mcp', 'enterprise-proxy', 'index.js');
}

/**
 * Get enterprise MCP server configuration from SnowCode config
 */
export async function getEnterpriseMcpConfig(): Promise<SnowCodeMcpServer | null> {
  try {
    const snowCodeConfig = await readSnowCodeConfig();

    const server =
      snowCodeConfig.mcpServers?.['snow-flow-enterprise'] ||
      snowCodeConfig.servers?.['snow-flow-enterprise'] ||
      null;

    if (server) {
      logger.debug('Found enterprise MCP server configuration');
    } else {
      logger.debug('Enterprise MCP server not configured');
    }

    return server;
  } catch (error: any) {
    logger.error(`Failed to get enterprise MCP config: ${error.message}`);
    return null;
  }
}
