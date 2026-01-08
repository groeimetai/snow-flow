/**
 * SnowCode Configuration Management
 * Manages ~/.snow-code/config.json for MCP server configuration
 */

import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { Logger } from '../utils/logger.js';
import { execSync } from 'child_process';

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
 * Enterprise MCP server configuration options (for license key auth)
 */
export interface EnterpriseMcpConfig {
  licenseKey: string;
  role: 'developer' | 'stakeholder' | 'admin';
  serverUrl?: string;
  // Credentials are now stored server-side only (not in local config)
}

/**
 * Enterprise MCP server configuration with existing JWT token
 * Used when snow-code auth login has already generated a token
 */
export interface EnterpriseMcpConfigWithToken {
  token: string;
  serverUrl?: string;
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
    logger.debug('Successfully wrote SnowCode config');
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

    // 🔥 FIX: Check if .mcp.json exists - if not, user must start snow-flow first!
    if (!existsSync(mcpConfigPath)) {
      logger.warn('.mcp.json not found in current directory');
      logger.warn('Please run: snow-flow (auto-initializes on first run)');
      logger.warn('Then use /auth in the TUI to configure enterprise features');
      throw new Error(
        '.mcp.json not found!\n' +
        'Run "snow-flow" first to start the TUI (auto-initializes on first run).\n' +
        'Then use /auth in the TUI to configure enterprise features.'
      );
    }

    // Read existing .mcp.json
    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(content);
    if (!mcpConfig.mcp) {
      mcpConfig.mcp = {};
    }

    // 🔥 IMPORTANT: Auth and MCP servers are SEPARATE!
    // - Auth/Portal: portal.snow-flow.dev (handles user auth, license validation, JWT generation)
    // - MCP Server: enterprise.snow-flow.dev (handles MCP SSE connections with JWT)
    const portalUrl = config.serverUrl || 'https://portal.snow-flow.dev';
    const mcpServerUrl = 'https://enterprise.snow-flow.dev';

    // 🔥 NEW: Generate JWT token via portal server
    logger.debug('Generating enterprise JWT token...');

    // Generate machine ID (sha256 of hostname for seat tracking)
    const machineId = require('crypto')
      .createHash('sha256')
      .update(os.hostname())
      .digest('hex');

    // Call portal server to get JWT (NOT the MCP server!)
    const authResponse = await fetch(`${portalUrl}/api/auth/mcp/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        licenseKey: config.licenseKey,
        machineId: machineId,
        role: config.role,
      }),
    });

    if (!authResponse.ok) {
      const errorData: any = await authResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        `Enterprise authentication failed: ${errorData.error || authResponse.statusText}\n` +
        `Status: ${authResponse.status}`
      );
    }

    const authData: any = await authResponse.json();

    if (!authData.success || !authData.token) {
      throw new Error(
        `Enterprise authentication failed: ${authData.error || 'No token received'}`
      );
    }

    const jwtToken = authData.token;

    logger.debug('JWT token generated successfully');
    logger.debug(`Role: ${config.role}`);
    logger.debug(`Developer seats: ${authData.customer?.developerSeats || 'N/A'}`);
    logger.debug(`Stakeholder seats: ${authData.customer?.stakeholderSeats || 'N/A'}`);

    // 🔥 FIX: Use REMOTE SSE - credentials stay server-side
    // The enterprise MCP server fetches credentials from portal API using JWT token
    // This is more secure as credentials never touch the local machine

    // NOTE: Credentials (Jira/Azure/Confluence) are fetched by the enterprise MCP server
    // directly from the Portal API using the JWT token. No local storage needed.

    // Add or update enterprise MCP server with REMOTE SSE configuration
    mcpConfig.mcp['snow-flow-enterprise'] = {
      type: 'remote',
      url: `${mcpServerUrl}/mcp/sse`,
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
      },
    };

    // Write updated .mcp.json
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    logger.debug(`Configured enterprise MCP server in ${mcpConfigPath}`);

    // 🔥 ALSO update .snow-code/config.json for snow-code CLI compatibility
    const snowCodeConfigPath = path.join(process.cwd(), '.snow-code', 'config.json');
    if (existsSync(snowCodeConfigPath)) {
      try {
        const snowCodeContent = await fs.readFile(snowCodeConfigPath, 'utf-8');
        const snowCodeConfig = JSON.parse(snowCodeContent);

        if (!snowCodeConfig.mcp) {
          snowCodeConfig.mcp = {};
        }

        // Update enterprise server with REMOTE SSE config (same as .mcp.json)
        snowCodeConfig.mcp['snow-flow-enterprise'] = {
          type: 'remote',
          url: `${mcpServerUrl}/mcp/sse`,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          },
        };

        await fs.writeFile(snowCodeConfigPath, JSON.stringify(snowCodeConfig, null, 2), 'utf-8');
        logger.debug(`Configured enterprise MCP server in ${snowCodeConfigPath}`);
      } catch (err: any) {
        logger.warn(`Could not update .snow-code/config.json: ${err.message}`);
      }
    }

    // 🔥 ALSO update .claude/mcp-config.json for Claude Code compatibility
    const claudeMcpConfigPath = path.join(process.cwd(), '.claude', 'mcp-config.json');
    if (existsSync(claudeMcpConfigPath)) {
      try {
        const claudeContent = await fs.readFile(claudeMcpConfigPath, 'utf-8');
        const claudeMcpConfig = JSON.parse(claudeContent);

        if (!claudeMcpConfig.mcpServers) {
          claudeMcpConfig.mcpServers = {};
        }

        // Update enterprise server with REMOTE SSE config (same as .mcp.json)
        claudeMcpConfig.mcpServers['snow-flow-enterprise'] = {
          type: 'remote',
          url: `${mcpServerUrl}/mcp/sse`,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          },
        };

        await fs.writeFile(claudeMcpConfigPath, JSON.stringify(claudeMcpConfig, null, 2), 'utf-8');
        logger.debug(`Successfully configured enterprise MCP server in ${claudeMcpConfigPath}`);
      } catch (err: any) {
        logger.warn(`Could not update .claude/mcp-config.json: ${err.message}`);
      }
    }
  } catch (error: any) {
    logger.error(`Failed to add enterprise MCP server: ${error.message}`);
    throw error;
  }
}

/**
 * Add or update enterprise MCP server using an existing JWT token
 * Used when snow-code auth login has already authenticated and generated a token
 * @param config - Enterprise MCP configuration with JWT token
 */
export async function addEnterpriseMcpServerWithToken(config: EnterpriseMcpConfigWithToken): Promise<void> {
  try {
    // Write to .mcp.json in current working directory (where snow-code is run)
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');

    // Check if .mcp.json exists - if not, user must start snow-flow first!
    if (!existsSync(mcpConfigPath)) {
      logger.warn('.mcp.json not found in current directory');
      logger.warn('Please run: snow-flow (auto-initializes on first run)');
      logger.warn('Then use /auth in the TUI to configure enterprise features');
      throw new Error(
        '.mcp.json not found!\n' +
        'Run "snow-flow" first to start the TUI (auto-initializes on first run).\n' +
        'Then use /auth in the TUI to configure enterprise features.'
      );
    }

    // Read existing .mcp.json
    const content = await fs.readFile(mcpConfigPath, 'utf-8');
    const mcpConfig = JSON.parse(content);
    if (!mcpConfig.mcp) {
      mcpConfig.mcp = {};
    }

    // Portal and MCP server URLs
    const portalUrl = config.serverUrl || 'https://portal.snow-flow.dev';
    const mcpServerUrl = 'https://enterprise.snow-flow.dev';

    // Use the existing JWT token (no re-authentication needed!)
    logger.debug('Using existing JWT token from snow-code auth login');
    const jwtToken = config.token;

    // Configure enterprise MCP server with REMOTE SSE
    // Credentials are fetched server-side by the enterprise MCP server using JWT
    mcpConfig.mcp['snow-flow-enterprise'] = {
      type: 'remote',
      url: `${mcpServerUrl}/mcp/sse`,
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
      },
    };

    // Write updated .mcp.json
    await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
    logger.debug(`Configured enterprise MCP server in ${mcpConfigPath}`);

    // Also update .snow-code/config.json for snow-code CLI compatibility
    const snowCodeConfigPath = path.join(process.cwd(), '.snow-code', 'config.json');
    if (existsSync(snowCodeConfigPath)) {
      try {
        const snowCodeContent = await fs.readFile(snowCodeConfigPath, 'utf-8');
        const snowCodeConfig = JSON.parse(snowCodeContent);

        if (!snowCodeConfig.mcp) {
          snowCodeConfig.mcp = {};
        }

        snowCodeConfig.mcp['snow-flow-enterprise'] = {
          type: 'remote',
          url: `${mcpServerUrl}/mcp/sse`,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          },
        };

        await fs.writeFile(snowCodeConfigPath, JSON.stringify(snowCodeConfig, null, 2), 'utf-8');
        logger.debug(`Configured enterprise MCP server in ${snowCodeConfigPath}`);
      } catch (err: any) {
        logger.warn(`Could not update .snow-code/config.json: ${err.message}`);
      }
    }

    // Also update .claude/mcp-config.json for Claude Code compatibility
    const claudeMcpConfigPath = path.join(process.cwd(), '.claude', 'mcp-config.json');
    if (existsSync(claudeMcpConfigPath)) {
      try {
        const claudeContent = await fs.readFile(claudeMcpConfigPath, 'utf-8');
        const claudeMcpConfig = JSON.parse(claudeContent);

        if (!claudeMcpConfig.mcpServers) {
          claudeMcpConfig.mcpServers = {};
        }

        claudeMcpConfig.mcpServers['snow-flow-enterprise'] = {
          type: 'remote',
          url: `${mcpServerUrl}/mcp/sse`,
          headers: {
            'Authorization': `Bearer ${jwtToken}`,
          },
        };

        await fs.writeFile(claudeMcpConfigPath, JSON.stringify(claudeMcpConfig, null, 2), 'utf-8');
        logger.debug(`Successfully configured enterprise MCP server in ${claudeMcpConfigPath}`);
      } catch (err: any) {
        logger.warn(`Could not update .claude/mcp-config.json: ${err.message}`);
      }
    }
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

    if (mcpConfig.mcp?.['snow-flow-enterprise']) {
      delete mcpConfig.mcp['snow-flow-enterprise'];
      await fs.writeFile(mcpConfigPath, JSON.stringify(mcpConfig, null, 2), 'utf-8');
      logger.debug('Successfully removed enterprise MCP server from .mcp.json');
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

    return !!mcpConfig.mcp?.['snow-flow-enterprise'];
  } catch (error) {
    return false;
  }
}

/**
 * Get the path to the enterprise proxy entry point
 * Returns absolute path using the same pattern as other MCP servers
 */
function getEnterpriseProxyPath(): string {
  // Get snow-flow root path (where the package is installed)
  let snowFlowRoot: string;

  try {
    // Try global npm installation first
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim();
    const globalPath = path.join(npmRoot, 'snow-flow');
    if (existsSync(globalPath)) {
      snowFlowRoot = globalPath;
      logger.debug(`Using snow-flow from global npm: ${snowFlowRoot}`);
    }
  } catch (error) {
    // Global npm failed, try other options
  }

  // If not found globally, try local node_modules
  if (!snowFlowRoot) {
    const localPath = path.join(process.cwd(), 'node_modules', 'snow-flow');
    if (existsSync(localPath)) {
      snowFlowRoot = localPath;
      logger.debug(`Using snow-flow from local node_modules: ${snowFlowRoot}`);
    }
  }

  // If not found, try development path
  if (!snowFlowRoot) {
    const devPath = path.join(__dirname, '..', '..');
    if (existsSync(devPath)) {
      snowFlowRoot = path.resolve(devPath);
      logger.debug(`Using snow-flow from development: ${snowFlowRoot}`);
    }
  }

  // Construct enterprise proxy path using consistent pattern
  const enterpriseProxyPath = path.join(snowFlowRoot, 'dist', 'mcp', 'enterprise-proxy', 'server.js');

  if (!existsSync(enterpriseProxyPath)) {
    throw new Error(
      'Enterprise proxy not found!\\n' +
      `Expected location: ${enterpriseProxyPath}\\n` +
      'Please ensure snow-flow is properly installed.'
    );
  }

  return enterpriseProxyPath;
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

    const server = mcpConfig.mcp?.['snow-flow-enterprise'] || null;

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
