/**
 * Snow-Code MCP Configuration Management
 *
 * Handles configuration for enterprise MCP server including:
 * - Adding enterprise MCP server to .mcp.json
 * - Checking if enterprise MCP is already configured
 * - Managing license keys and JWT tokens
 */

import fs from "fs/promises"
import path from "path"
import os from "os"

export interface EnterpriseMcpConfig {
  licenseKey: string
  role: "developer" | "stakeholder" | "admin"
  serverUrl?: string
}

export interface EnterpriseMcpConfigWithToken {
  token: string
  serverUrl: string
}

interface McpServerConfig {
  type?: string
  command?: string | string[]
  args?: string[]
  env?: Record<string, string>
  environment?: Record<string, string>
  enabled?: boolean
}

interface McpConfig {
  mcp?: Record<string, McpServerConfig>
  mcpServers?: Record<string, McpServerConfig>
  servers?: Record<string, McpServerConfig>
}

/**
 * Get the path to the project .mcp.json file
 */
function getProjectMcpPath(): string {
  return path.join(process.cwd(), ".mcp.json")
}

/**
 * Get the path to the global .mcp.json file
 */
function getGlobalMcpPath(): string {
  return path.join(os.homedir(), ".snow-code", ".mcp.json")
}

/**
 * Read MCP config from a path
 */
async function readMcpConfig(configPath: string): Promise<McpConfig | null> {
  try {
    const content = await fs.readFile(configPath, "utf-8")
    return JSON.parse(content) as McpConfig
  } catch {
    return null
  }
}

/**
 * Write MCP config to a path
 */
async function writeMcpConfig(configPath: string, config: McpConfig): Promise<void> {
  const dir = path.dirname(configPath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8")
}

/**
 * Check if enterprise MCP server is already configured
 */
export async function isEnterpriseMcpConfigured(): Promise<boolean> {
  const projectConfig = await readMcpConfig(getProjectMcpPath())
  if (!projectConfig) return false

  const servers = projectConfig.mcp || projectConfig.mcpServers || projectConfig.servers || {}
  return "snow-flow-enterprise" in servers || "snow-flow-enterprise-proxy" in servers
}

/**
 * Add enterprise MCP server configuration
 */
export async function addEnterpriseMcpServer(config: EnterpriseMcpConfig): Promise<void> {
  const projectMcpPath = getProjectMcpPath()
  let mcpConfig = await readMcpConfig(projectMcpPath)

  if (!mcpConfig) {
    throw new Error(".mcp.json not found. Please run snow-flow to initialize the project first.")
  }

  // Determine which key format is used
  const serversKey = mcpConfig.mcp ? "mcp" : mcpConfig.mcpServers ? "mcpServers" : "servers"

  if (!mcpConfig[serversKey]) {
    mcpConfig[serversKey] = {}
  }

  // Get path to the enterprise proxy server
  const proxyServerPath = path.join(__dirname, "..", "enterprise-proxy", "server.ts")

  // Add enterprise MCP server
  mcpConfig[serversKey]!["snow-flow-enterprise"] = {
    type: "local",
    command: ["bun", "run", proxyServerPath],
    environment: {
      SNOW_PORTAL_URL: config.serverUrl || "https://portal.snow-flow.dev",
      SNOW_LICENSE_KEY: config.licenseKey,
    },
    enabled: true,
  }

  await writeMcpConfig(projectMcpPath, mcpConfig)
}

/**
 * Add enterprise MCP server configuration with existing JWT token
 */
export async function addEnterpriseMcpServerWithToken(config: EnterpriseMcpConfigWithToken): Promise<void> {
  const projectMcpPath = getProjectMcpPath()
  let mcpConfig = await readMcpConfig(projectMcpPath)

  if (!mcpConfig) {
    throw new Error(".mcp.json not found. Please run snow-flow to initialize the project first.")
  }

  // Determine which key format is used
  const serversKey = mcpConfig.mcp ? "mcp" : mcpConfig.mcpServers ? "mcpServers" : "servers"

  if (!mcpConfig[serversKey]) {
    mcpConfig[serversKey] = {}
  }

  // Get path to the enterprise proxy server
  const proxyServerPath = path.join(__dirname, "..", "enterprise-proxy", "server.ts")

  // Add enterprise MCP server with JWT token
  mcpConfig[serversKey]!["snow-flow-enterprise"] = {
    type: "local",
    command: ["bun", "run", proxyServerPath],
    environment: {
      SNOW_PORTAL_URL: config.serverUrl,
      SNOW_LICENSE_KEY: config.token, // JWT token stored as license key
    },
    enabled: true,
  }

  await writeMcpConfig(projectMcpPath, mcpConfig)
}
