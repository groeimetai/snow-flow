/**
 * Sync MCP Configuration Files
 * Ensures .snow-code/config.json is in sync with .mcp.json
 *
 * This is critical for enterprise MCP server availability because:
 * - snow-code auth login updates .mcp.json
 * - snow-code reads .snow-code/config.json or .mcp.json
 * - Without sync, enterprise server won't be available in swarm command
 *
 * Note: .claude/ directory is no longer used - snow-code is the only supported client
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { Logger } from './logger.js';

const logger = new Logger('mcp-config-sync');

/**
 * Sync .mcp.json to .snow-code/config.json
 *
 * This ensures snow-code always sees the same MCP servers as configured in .mcp.json
 * Particularly important for enterprise server configuration during auth flow
 *
 * @param projectRoot - Project root directory (defaults to current working directory)
 */
export async function syncMcpConfigs(projectRoot: string = process.cwd()): Promise<void> {
  try {
    const mcpJsonPath = path.join(projectRoot, '.mcp.json');

    // Check if .mcp.json exists
    if (!existsSync(mcpJsonPath)) {
      logger.debug('.mcp.json does not exist, skipping sync');
      return;
    }

    // Read .mcp.json
    const mcpJsonContent = await fs.readFile(mcpJsonPath, 'utf-8');
    const mcpConfig = JSON.parse(mcpJsonContent);

    // Get servers from .mcp.json (support both formats)
    const servers = mcpConfig.mcp || mcpConfig.mcpServers || {};

    // Sync to .snow-code/config.json (snow-code reads this)
    const snowCodeDir = path.join(projectRoot, '.snow-code');
    const snowCodeConfigPath = path.join(snowCodeDir, 'config.json');

    // Ensure .snow-code directory exists
    if (!existsSync(snowCodeDir)) {
      await fs.mkdir(snowCodeDir, { recursive: true });
      logger.info(`Created .snow-code directory: ${snowCodeDir}`);
    }

    // Create snow-code format config (uses 'mcp' key)
    const snowCodeConfig: any = {
      "$schema": "https://opencode.ai/config.json",
      mcp: {}
    };

    // Copy servers in snow-code format
    for (const [serverName, serverConfig] of Object.entries(servers)) {
      snowCodeConfig.mcp[serverName] = serverConfig;
    }

    // Write to .snow-code/config.json
    await fs.writeFile(snowCodeConfigPath, JSON.stringify(snowCodeConfig, null, 2), 'utf-8');

    logger.info(`✅ Synced .mcp.json → .snow-code/config.json`);

    // Log which servers are enabled
    const enabledServers = Object.entries(servers)
      .filter(([_, config]: [string, any]) => (config as any).enabled !== false)
      .map(([name]) => name);

    if (enabledServers.length > 0) {
      logger.info(`Enabled servers: ${enabledServers.join(', ')}`);
    }

  } catch (error: any) {
    logger.error(`Failed to sync MCP configs: ${error.message}`);
    throw error;
  }
}

/**
 * Ensure .snow-code/config.json exists and is synced with .mcp.json
 * This is a convenience wrapper that creates the file if it doesn't exist
 *
 * @param projectRoot - Project root directory (defaults to current working directory)
 */
export async function ensureMcpConfigSync(projectRoot: string = process.cwd()): Promise<void> {
  try {
    await syncMcpConfigs(projectRoot);
  } catch (error: any) {
    // If sync fails, try to create a minimal config
    const snowCodeConfigPath = path.join(projectRoot, '.snow-code', 'config.json');

    if (!existsSync(snowCodeConfigPath)) {
      logger.warn('Creating minimal .snow-code/config.json');

      const snowCodeDir = path.dirname(snowCodeConfigPath);
      if (!existsSync(snowCodeDir)) {
        await fs.mkdir(snowCodeDir, { recursive: true });
      }

      await fs.writeFile(
        snowCodeConfigPath,
        JSON.stringify({ "$schema": "https://opencode.ai/config.json", mcp: {} }, null, 2),
        'utf-8'
      );
    }
  }
}
