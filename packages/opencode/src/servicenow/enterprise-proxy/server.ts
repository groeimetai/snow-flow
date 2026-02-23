#!/usr/bin/env node
/**
 * Snow-Flow Enterprise MCP Proxy
 *
 * Forwards MCP tool requests from Claude Code to the Enterprise License Server.
 * This allows the open source Snow-Flow to use enterprise-hosted tools.
 *
 * Architecture:
 * Claude Code → stdio → This Proxy → HTTPS → License Server → External APIs
 *
 * IMPORTANT: Credentials (Jira, Azure DevOps, Confluence, GitHub, GitLab) are
 * fetched by the enterprise MCP server from the Portal API using the JWT token.
 * No local credentials are needed - just SNOW_ENTERPRISE_URL and SNOW_LICENSE_KEY.
 *
 * TOKEN RESOLUTION:
 * The proxy reads tokens from (in order):
 * 1. ~/.snow-code/enterprise.json (most recent device auth token)
 * 2. SNOW_LICENSE_KEY environment variable (from .mcp.json)
 *
 * Usage:
 * node server.js
 *
 * Environment Variables:
 * - SNOW_ENTERPRISE_URL: License server URL (required)
 * - SNOW_LICENSE_KEY: JWT token for authentication (optional if enterprise.json exists)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import type { Tool } from "@modelcontextprotocol/sdk/types.js"
import fs from "fs"
import path from "path"
import os from "os"
import { listEnterpriseTools, proxyToolCall } from "./proxy.js"
import { mcpDebug } from "../shared/mcp-debug.js"
import { fetchAndCacheTools, buildEnterpriseToolIndex, ToolSearch, getCurrentSessionId } from "./tool-cache.js"
import { ENTERPRISE_META_TOOLS, executeToolSearch, executeToolExecute } from "./meta-tools.js"

// Configuration from environment variables
const LICENSE_SERVER_URL = process.env.SNOW_ENTERPRISE_URL || "https://enterprise.snow-flow.dev"
const LAZY_TOOLS_ENABLED = process.env.SNOW_ENTERPRISE_LAZY_TOOLS !== "false"

/**
 * Check if a valid token source exists
 * Either enterprise.json or SNOW_LICENSE_KEY env var
 */
function hasValidTokenSource(): boolean {
  // Check enterprise.json
  const enterpriseJsonPath = path.join(os.homedir(), ".snow-code", "enterprise.json")
  try {
    if (fs.existsSync(enterpriseJsonPath)) {
      const content = fs.readFileSync(enterpriseJsonPath, "utf-8")
      const config = JSON.parse(content)
      if (config.token) {
        return true
      }
    }
  } catch {
    // Ignore errors, check env var next
  }

  // Check env var
  const envKey = process.env.SNOW_LICENSE_KEY || process.env.SNOW_ENTERPRISE_LICENSE_KEY
  return !!envKey?.trim()
}

// NOTE: Credentials (Jira, Azure DevOps, Confluence, GitHub, GitLab) are fetched
// by the enterprise MCP server from the Portal API using the JWT token.
// No local credential configuration is needed.

class EnterpriseProxyServer {
  private server: Server
  private availableTools: Tool[] = []

  constructor() {
    // Validate required configuration
    if (!LICENSE_SERVER_URL) {
      throw new Error("SNOW_ENTERPRISE_URL environment variable is required")
    }
    if (!hasValidTokenSource()) {
      throw new Error(
        "No valid token found. Either:\n" +
          "  1. Run: snow-code auth login (to create ~/.snow-code/enterprise.json)\n" +
          "  2. Or set SNOW_LICENSE_KEY environment variable",
      )
    }

    // Create MCP server
    this.server = new Server(
      {
        name: "snow-flow-enterprise-proxy",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    )

    this.setupHandlers()
    this.logConfiguration()
  }

  private logConfiguration() {
    // Determine token source for logging
    let tokenSource = "environment variable"
    let tokenPreview = "(none)"

    const enterpriseJsonPath = path.join(os.homedir(), ".snow-code", "enterprise.json")
    try {
      if (fs.existsSync(enterpriseJsonPath)) {
        const content = fs.readFileSync(enterpriseJsonPath, "utf-8")
        const config = JSON.parse(content)
        if (config.token) {
          tokenSource = "~/.snow-code/enterprise.json"
          tokenPreview = config.token.substring(0, 20) + "..."
        }
      }
    } catch {
      // Fall back to env var
    }

    if (tokenSource === "environment variable") {
      const envKey = process.env.SNOW_LICENSE_KEY || process.env.SNOW_ENTERPRISE_LICENSE_KEY
      if (envKey?.trim()) {
        tokenPreview = envKey.trim().substring(0, 20) + "..."
      }
    }

    mcpDebug("═══════════════════════════════════════════════════")
    mcpDebug("Snow-Flow Enterprise MCP Proxy")
    mcpDebug("═══════════════════════════════════════════════════")
    mcpDebug(`License Server: ${LICENSE_SERVER_URL}`)
    mcpDebug(`Token Source: ${tokenSource}`)
    mcpDebug(`JWT Token: ${tokenPreview}`)
    mcpDebug("")
    mcpDebug("Credentials are fetched from Portal API by enterprise server")
    mcpDebug("═══════════════════════════════════════════════════")
    mcpDebug("")
  }

  private setupHandlers() {
    // List tools handler - uses proxy.ts with JWT auto-refresh
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        mcpDebug("[Proxy] Fetching available tools from license server...")

        var tools = await listEnterpriseTools()
        this.availableTools = tools as Tool[]

        mcpDebug(`[Proxy] ✓ ${this.availableTools.length} tools available`)

        if (LAZY_TOOLS_ENABLED) {
          // Build search index from fetched tools
          buildEnterpriseToolIndex(tools)

          // Collect session-enabled tools to include alongside meta-tools
          const sessionId = getCurrentSessionId()
          const enabledTools: Tool[] = []
          if (sessionId) {
            const enabledSet = await ToolSearch.getEnabledTools(sessionId)
            for (const toolId of enabledSet) {
              const found = this.availableTools.find((t) => t.name === toolId)
              if (found) enabledTools.push(found)
            }
          }

          mcpDebug(
            `[Proxy] Lazy mode: returning ${ENTERPRISE_META_TOOLS.length} meta-tools + ${enabledTools.length} enabled tools`,
          )
          return {
            tools: [...ENTERPRISE_META_TOOLS, ...enabledTools],
          }
        }

        return {
          tools: this.availableTools,
        }
      } catch (error: any) {
        mcpDebug("[Proxy] ✗ Failed to fetch tools:", error.message)

        if (LAZY_TOOLS_ENABLED) {
          // In lazy mode, always return meta-tools so search remains available
          mcpDebug("[Proxy] Returning meta-tools only due to backend error")
          return {
            tools: [...ENTERPRISE_META_TOOLS],
          }
        }

        // Return empty tools list instead of crashing - allows graceful degradation
        mcpDebug("[Proxy] Returning empty tools list due to backend error")
        return {
          tools: [],
        }
      }
    })

    // Call tool handler - uses proxy.ts with JWT auto-refresh
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      var toolName = request.params.name
      var toolArgs = request.params.arguments || {}

      // Route meta-tool calls in lazy mode
      if (LAZY_TOOLS_ENABLED) {
        if (toolName === "enterprise_tool_search") {
          return executeToolSearch(toolArgs as Record<string, unknown>)
        }
        if (toolName === "enterprise_tool_execute") {
          return executeToolExecute(toolArgs as Record<string, unknown>)
        }

        // For direct tool calls in lazy mode, check if tool is enabled
        const sessionId = getCurrentSessionId()
        if (sessionId) {
          const canExecute = await ToolSearch.canExecuteTool(sessionId, toolName)
          if (!canExecute) {
            mcpDebug(`[Proxy] Tool ${toolName} not enabled for session ${sessionId}`)
            return {
              content: [
                {
                  type: "text",
                  text: `Tool "${toolName}" is not enabled. Use enterprise_tool_search to find and enable it first.`,
                },
              ],
              isError: true,
            }
          }
        }
      }

      try {
        mcpDebug(`[Proxy] Executing tool: ${toolName}`)

        var startTime = Date.now()
        var result = await proxyToolCall(toolName, toolArgs)
        var duration = Date.now() - startTime

        mcpDebug(`[Proxy] ✓ Tool executed successfully (${duration}ms)`)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        }
      } catch (error: any) {
        mcpDebug(`[Proxy] ✗ Tool execution failed: ${error.message}`)

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  error: error.message,
                  tool: toolName,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        }
      }
    })

    // ========== MCP PROMPTS SUPPORT ==========
    // These prompts provide guidance to the AI on how to use enterprise tools

    const ENTERPRISE_PROMPTS: { name: string; description: string; arguments: never[] }[] = []

    const PROMPT_CONTENT: Record<string, string> = {}

    // List prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      mcpDebug(`[Proxy] Listing ${ENTERPRISE_PROMPTS.length} prompts`)
      return {
        prompts: ENTERPRISE_PROMPTS,
      }
    })

    // Get prompt handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      var promptName = request.params.name
      mcpDebug(`[Proxy] Getting prompt: ${promptName}`)

      var content = PROMPT_CONTENT[promptName]
      if (!content) {
        throw new Error(`Prompt not found: ${promptName}`)
      }

      return {
        description: ENTERPRISE_PROMPTS.find((p) => p.name === promptName)?.description || "",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: content,
            },
          },
        ],
      }
    })
  }

  async run() {
    var transport = new StdioServerTransport()
    await this.server.connect(transport)
    mcpDebug("[Proxy] ✓ Enterprise MCP Proxy running on stdio")
    mcpDebug("[Proxy] Ready to receive requests from Claude Code")
  }
}

// Start server
try {
  var proxy = new EnterpriseProxyServer()
  proxy.run().catch(function (error) {
    mcpDebug("[Proxy] Fatal error:", error)
    process.exit(1)
  })
} catch (error: any) {
  mcpDebug("[Proxy] Failed to start:", error.message)
  process.exit(1)
}
