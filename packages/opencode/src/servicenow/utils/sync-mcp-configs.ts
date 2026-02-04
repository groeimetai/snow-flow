/**
 * MCP Configuration Sync Utility
 *
 * Synchronizes MCP configurations between different locations:
 * - Project .mcp.json
 * - Global ~/.snow-code/.mcp.json
 * - Claude Desktop configuration
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  environment?: Record<string, string>;
}

interface McpConfig {
  mcp?: Record<string, McpServerConfig>;
  mcpServers?: Record<string, McpServerConfig>;
  servers?: Record<string, McpServerConfig>;
}

/**
 * Sync MCP configurations from project to other locations
 * @param projectDir - Project directory containing .mcp.json
 */
export async function syncMcpConfigs(projectDir: string): Promise<void> {
  const projectMcpPath = path.join(projectDir, '.mcp.json');

  // Read project MCP config
  let projectConfig: McpConfig;
  try {
    const content = await fs.readFile(projectMcpPath, 'utf-8');
    projectConfig = JSON.parse(content);
  } catch (err) {
    throw new Error(`Failed to read project .mcp.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Get servers from project config
  const servers = projectConfig.mcp || projectConfig.mcpServers || projectConfig.servers || {};

  // Sync to Claude Desktop config if it exists
  const claudeConfigDir = path.join(projectDir, '.claude');
  const claudeMcpConfigPath = path.join(claudeConfigDir, 'mcp-config.json');

  try {
    // Check if .claude directory exists or should be created
    await fs.mkdir(claudeConfigDir, { recursive: true });

    // Read existing Claude MCP config or create new one
    let claudeConfig: { mcpServers?: Record<string, McpServerConfig> } = {};
    try {
      const existingContent = await fs.readFile(claudeMcpConfigPath, 'utf-8');
      claudeConfig = JSON.parse(existingContent);
    } catch {
      // File doesn't exist, start fresh
    }

    // Merge servers into Claude config
    if (!claudeConfig.mcpServers) {
      claudeConfig.mcpServers = {};
    }

    // Copy enterprise server config
    if (servers['snow-flow-enterprise']) {
      claudeConfig.mcpServers['snow-flow-enterprise'] = servers['snow-flow-enterprise'];
    }

    // Write updated Claude config
    await fs.writeFile(claudeMcpConfigPath, JSON.stringify(claudeConfig, null, 2), 'utf-8');
  } catch (err) {
    // Silently continue if Claude config sync fails
    console.error(`Warning: Could not sync to Claude config: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Also sync to global config
  const globalConfigDir = path.join(os.homedir(), '.snow-code');
  const globalMcpPath = path.join(globalConfigDir, '.mcp.json');

  try {
    await fs.mkdir(globalConfigDir, { recursive: true });

    let globalConfig: McpConfig = {};
    try {
      const existingContent = await fs.readFile(globalMcpPath, 'utf-8');
      globalConfig = JSON.parse(existingContent);
    } catch {
      // File doesn't exist, start fresh
    }

    // Use same key format as project
    const serversKey = projectConfig.mcp ? 'mcp' : (projectConfig.mcpServers ? 'mcpServers' : 'servers');

    if (!globalConfig[serversKey]) {
      globalConfig[serversKey] = {};
    }

    // Copy enterprise server config
    if (servers['snow-flow-enterprise']) {
      globalConfig[serversKey]!['snow-flow-enterprise'] = servers['snow-flow-enterprise'];
    }

    await fs.writeFile(globalMcpPath, JSON.stringify(globalConfig, null, 2), 'utf-8');
  } catch (err) {
    // Silently continue if global config sync fails
    console.error(`Warning: Could not sync to global config: ${err instanceof Error ? err.message : String(err)}`);
  }
}
