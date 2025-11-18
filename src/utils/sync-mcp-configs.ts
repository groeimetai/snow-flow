/**
 * Sync MCP Configuration Files
 * Ensures .claude/mcp-config.json is always in sync with .mcp.json
 *
 * This is critical for enterprise MCP server availability because:
 * - snow-code auth login updates .mcp.json
 * - But Claude Code reads .claude/mcp-config.json
 * - Without sync, enterprise server won't be available in swarm command
 */

import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { Logger } from './logger.js';

const logger = new Logger('mcp-config-sync');

/**
 * Sync .mcp.json to .claude/mcp-config.json
 *
 * This ensures Claude Code always sees the same MCP servers as configured in .mcp.json
 * Particularly important for enterprise server configuration during auth flow
 *
 * @param projectRoot - Project root directory (defaults to current working directory)
 */
export async function syncMcpConfigs(projectRoot: string = process.cwd()): Promise<void> {
  try {
    const mcpJsonPath = path.join(projectRoot, '.mcp.json');
    const claudeMcpConfigPath = path.join(projectRoot, '.claude', 'mcp-config.json');

    // Check if .mcp.json exists
    if (!existsSync(mcpJsonPath)) {
      logger.debug('.mcp.json does not exist, skipping sync');
      return;
    }

    // Read .mcp.json
    const mcpJsonContent = await fs.readFile(mcpJsonPath, 'utf-8');
    const mcpConfig = JSON.parse(mcpJsonContent);

    // Ensure .claude directory exists
    const claudeDir = path.dirname(claudeMcpConfigPath);
    if (!existsSync(claudeDir)) {
      await fs.mkdir(claudeDir, { recursive: true });
      logger.info(`Created .claude directory: ${claudeDir}`);
    }

    // Convert .mcp.json format to .claude/mcp-config.json format
    // .mcp.json uses { mcpServers: { ... } }
    // .claude/mcp-config.json also uses { mcpServers: { ... } }
    // But we need to ensure the format matches what Claude Code expects

    const claudeConfig: any = {
      mcpServers: {}
    };

    // Copy all servers from .mcp.json to claude config
    if (mcpConfig.mcpServers) {
      for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
        const config: any = serverConfig;

        // Convert to Claude Code format
        // Claude Code expects: command, args, env (or environment)
        // New format uses: type, command (array), environment

        if (config.type === 'local') {
          // New format: command is an array like ["node", "/path/to/server.js"]
          const command = Array.isArray(config.command) ? config.command : [config.command];

          claudeConfig.mcpServers[serverName] = {
            command: command[0], // "node"
            args: command.slice(1), // ["/path/to/server.js"]
            description: config.description,
            env: config.environment || config.env || {},
            ...(config.enabled !== undefined && { enabled: config.enabled })
          };
        } else if (config.type === 'remote') {
          // Remote servers (SSE)
          claudeConfig.mcpServers[serverName] = {
            url: config.url,
            description: config.description,
            env: config.environment || config.env || {},
            ...(config.enabled !== undefined && { enabled: config.enabled })
          };
        } else {
          // Fallback - copy as-is but ensure env key exists
          claudeConfig.mcpServers[serverName] = {
            ...config,
            env: config.environment || config.env || {}
          };
        }
      }
    }

    // Write to .claude/mcp-config.json
    await fs.writeFile(claudeMcpConfigPath, JSON.stringify(claudeConfig, null, 2), 'utf-8');

    logger.info(`✅ Synced .mcp.json → .claude/mcp-config.json`);
    logger.debug(`Synced ${Object.keys(claudeConfig.mcpServers).length} MCP servers`);

    // Log which servers are enabled
    const enabledServers = Object.entries(claudeConfig.mcpServers)
      .filter(([_, config]: [string, any]) => config.enabled !== false)
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
 * Ensure .claude/mcp-config.json exists and is synced with .mcp.json
 * This is a convenience wrapper that creates the file if it doesn't exist
 *
 * @param projectRoot - Project root directory (defaults to current working directory)
 */
export async function ensureMcpConfigSync(projectRoot: string = process.cwd()): Promise<void> {
  try {
    await syncMcpConfigs(projectRoot);
  } catch (error: any) {
    // If sync fails, try to create a minimal config
    const claudeMcpConfigPath = path.join(projectRoot, '.claude', 'mcp-config.json');

    if (!existsSync(claudeMcpConfigPath)) {
      logger.warn('Creating minimal .claude/mcp-config.json');

      const claudeDir = path.dirname(claudeMcpConfigPath);
      if (!existsSync(claudeDir)) {
        await fs.mkdir(claudeDir, { recursive: true });
      }

      await fs.writeFile(
        claudeMcpConfigPath,
        JSON.stringify({ mcpServers: {} }, null, 2),
        'utf-8'
      );
    }
  }
}
