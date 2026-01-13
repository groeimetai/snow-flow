import z from "zod/v4"
import { zodToJsonSchema } from "zod-to-json-schema"
import { Tool } from "./tool"
import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { MCP } from "../mcp"
import { Storage } from "../storage/storage"

const log = Log.create({ service: "tool-search" })

/**
 * Tool Search Tool - Meta-tool for discovering deferred tools
 *
 * Per Anthropic's advanced tool use patterns, this tool enables:
 * - 85% token reduction by deferring tool loading
 * - Dynamic tool discovery based on user intent
 * - Only loading full tool definitions when actually needed
 *
 * @see https://www.anthropic.com/engineering/advanced-tool-use
 */

// Tool index entry - lightweight representation for search
export interface ToolIndexEntry {
  id: string
  description: string
  category: string
  keywords: string[]
  deferred: boolean
}

// State for tracking tool index and enabled tools per session
const state = Instance.state(
  () => ({
    // Global tool index (name + description only, NOT full schema)
    index: [] as ToolIndexEntry[],
    // Per-session enabled deferred tools
    enabledTools: new Map<string, Set<string>>(),
  }),
  async (current) => {
    current.index = []
    current.enabledTools.clear()
  },
)

// Persist enabled tools to storage
async function persistEnabledTools(sessionID: string, tools: Set<string>): Promise<void> {
  try {
    await Storage.write(["enabled-tools", sessionID], [...tools])
    log.debug("persisted enabled tools", { sessionID, count: tools.size })
  } catch (e) {
    log.warn("failed to persist enabled tools", { sessionID, error: e })
  }
}

// Restore enabled tools from storage
async function restoreEnabledTools(sessionID: string): Promise<Set<string>> {
  try {
    const data = await Storage.read<string[]>(["enabled-tools", sessionID])
    if (data) {
      const tools = new Set<string>(data)
      log.debug("restored enabled tools from storage", { sessionID, count: tools.size })
      return tools
    }
  } catch (e) {
    // NotFoundError is expected when no tools have been enabled yet
    if (!Storage.NotFoundError.isInstance(e)) {
      log.debug("failed to restore enabled tools", { sessionID, error: e })
    }
  }
  return new Set()
}

export namespace ToolSearch {
  /**
   * Register a tool in the search index
   */
  export async function registerTool(entry: ToolIndexEntry): Promise<void> {
    const s = await state()
    const existing = s.index.findIndex((t) => t.id === entry.id)
    if (existing >= 0) {
      s.index[existing] = entry
    } else {
      s.index.push(entry)
    }
  }

  /**
   * Register multiple tools at once
   */
  export async function registerTools(entries: ToolIndexEntry[]): Promise<void> {
    for (const entry of entries) {
      await registerTool(entry)
    }
  }

  /**
   * Get the tool index
   */
  export async function getIndex(): Promise<ToolIndexEntry[]> {
    return (await state()).index
  }

  /**
   * Clear the tool index
   */
  export async function clearIndex(): Promise<void> {
    const s = await state()
    s.index = []
  }

  /**
   * Search tools by query using multiple strategies
   */
  export async function search(query: string, limit: number = 20): Promise<ToolIndexEntry[]> {
    const s = await state()
    const queryLower = query.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2)

    // Score each tool
    const scored = s.index.map((tool) => {
      let score = 0
      const idLower = tool.id.toLowerCase()
      const descLower = tool.description.toLowerCase()
      const keywordsLower = tool.keywords.map((k) => k.toLowerCase())

      // Exact ID match (highest priority)
      if (idLower === queryLower) score += 100

      // ID contains query
      if (idLower.includes(queryLower)) score += 50

      // ID starts with query
      if (idLower.startsWith(queryLower)) score += 30

      // Description contains query
      if (descLower.includes(queryLower)) score += 20

      // Keyword matches
      for (const kw of keywordsLower) {
        if (kw === queryLower) score += 40
        if (kw.includes(queryLower)) score += 15
      }

      // Word-level matching
      for (const word of queryWords) {
        if (idLower.includes(word)) score += 10
        if (descLower.includes(word)) score += 5
        for (const kw of keywordsLower) {
          if (kw.includes(word)) score += 8
        }
      }

      // Category match
      if (tool.category.toLowerCase().includes(queryLower)) score += 25

      return { tool, score }
    })

    // Filter and sort by score
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.tool)
  }

  /**
   * Enable a deferred tool for a session
   */
  export async function enableTool(sessionID: string, toolID: string): Promise<void> {
    const s = await state()
    if (!s.enabledTools.has(sessionID)) {
      // Restore from disk if available
      const restored = await restoreEnabledTools(sessionID)
      s.enabledTools.set(sessionID, restored)
    }
    s.enabledTools.get(sessionID)!.add(toolID)
    // Persist to disk
    await persistEnabledTools(sessionID, s.enabledTools.get(sessionID)!)
    log.info("Enabled deferred tool", { sessionID, toolID })
  }

  /**
   * Enable multiple deferred tools for a session
   */
  export async function enableTools(sessionID: string, toolIDs: string[]): Promise<void> {
    for (const toolID of toolIDs) {
      await enableTool(sessionID, toolID)
    }
  }

  /**
   * Check if a deferred tool is enabled for a session
   */
  export async function isToolEnabled(sessionID: string, toolID: string): Promise<boolean> {
    const s = await state()
    return s.enabledTools.get(sessionID)?.has(toolID) ?? false
  }

  /**
   * Get all enabled tools for a session
   */
  export async function getEnabledTools(sessionID: string): Promise<Set<string>> {
    const s = await state()
    if (!s.enabledTools.has(sessionID)) {
      // Restore from disk if available
      const restored = await restoreEnabledTools(sessionID)
      s.enabledTools.set(sessionID, restored)
    }
    return s.enabledTools.get(sessionID) ?? new Set()
  }

  /**
   * Clear enabled tools for a session
   */
  export async function clearSession(sessionID: string): Promise<void> {
    const s = await state()
    s.enabledTools.delete(sessionID)
  }

  /**
   * Get statistics about the tool index
   */
  export async function getStats(): Promise<{
    total: number
    deferred: number
    immediate: number
    categories: Record<string, number>
  }> {
    const s = await state()
    const categories: Record<string, number> = {}

    let deferred = 0
    let immediate = 0

    for (const tool of s.index) {
      if (tool.deferred) {
        deferred++
      } else {
        immediate++
      }
      categories[tool.category] = (categories[tool.category] || 0) + 1
    }

    return {
      total: s.index.length,
      deferred,
      immediate,
      categories,
    }
  }
}

/**
 * Format parameters from a tool's schema for display
 */
function formatToolParameters(tool: any): string {
  if (!tool) return ""

  try {
    // Get the parameters schema - check multiple possible locations
    let schema: any = null

    // MCP tools from remote servers use 'inputSchema' (JSON Schema)
    if (tool.inputSchema && typeof tool.inputSchema === "object") {
      schema = tool.inputSchema
    }
    // AI SDK tools have a 'parameters' property (could be Zod or JSON Schema)
    else if (tool.parameters) {
      // Check if it's a Zod schema (has _def property)
      if (typeof tool.parameters === "object" && tool.parameters._def) {
        // Convert Zod to JSON Schema
        schema = zodToJsonSchema(tool.parameters)
      } else if (typeof tool.parameters === "object") {
        // Already a JSON Schema-like object
        schema = tool.parameters
      }
    }
    // Some tools wrap schema in 'schema' property
    else if (tool.schema && typeof tool.schema === "object") {
      schema = tool.schema
    }

    if (!schema) {
      log.debug("No schema found for tool", { toolKeys: Object.keys(tool || {}) })
      return ""
    }

    // Extract properties and required fields
    const properties = schema.properties || {}
    const required = schema.required || []

    if (Object.keys(properties).length === 0) {
      return "\n   Parameters: none"
    }

    const paramLines: string[] = ["\n   Parameters:"]

    for (const [name, prop] of Object.entries<any>(properties)) {
      const isRequired = required.includes(name)
      const type = prop.type || "any"
      const desc = prop.description ? ` - ${prop.description}` : ""
      const marker = isRequired ? "*" : ""
      paramLines.push(`     ${marker}${name} (${type})${desc}`)
    }

    if (required.length > 0) {
      paramLines.push(`   (* = required)`)
    }

    return paramLines.join("\n")
  } catch (e) {
    log.debug("Failed to format tool parameters", { error: String(e) })
    return ""
  }
}

/**
 * The Tool Search Tool definition
 */
export const ToolSearchTool = Tool.define("tool_search", {
  description: `Search for available tools when you need specialized functionality.

This tool searches through ALL available tools including:
- ServiceNow operations (queries, updates, deployments)
- CMDB and asset management
- Change management and approvals
- Knowledge base and catalog
- Flow Designer and automation
- Security and compliance tools
- Machine learning and analytics
- Jira, Azure DevOps, Confluence (enterprise)
- And many more specialized tools

Use this when you need to:
- Find tools for a specific task
- Discover what operations are available
- Look up tool names by functionality

IMPORTANT: After this tool returns, the found tools become IMMEDIATELY AVAILABLE.
You can call them directly by their exact tool name in your next action.

Example workflow:
1. tool_search({query: "jira"}) → finds "snow-flow-enterprise_jira_search_issues"
2. snow-flow-enterprise_jira_search_issues({jql: "project = SNOW"}) → call it directly!`,
  parameters: z.object({
    query: z
      .string()
      .describe(
        "Search query to find relevant tools. Examples: 'incident', 'cmdb', 'update set', 'deploy widget', 'knowledge article'"
      ),
    enable: z
      .boolean()
      .default(true)
      .describe("Whether to enable found tools for immediate use (default: true)"),
  }),
  async execute(args, ctx) {
    log.info("Searching tools", { query: args.query, sessionID: ctx.sessionID })

    const results = await ToolSearch.search(args.query)

    if (results.length === 0) {
      return {
        title: `No tools found for "${args.query}"`,
        output: `No tools matched the search query "${args.query}". Try different keywords or broader terms.`,
        metadata: { query: args.query, count: 0, tools: [] as string[], enabled: args.enable },
      }
    }

    // Enable found tools for this session if requested
    if (args.enable) {
      const toolIDs = results.map((t) => t.id)
      await ToolSearch.enableTools(ctx.sessionID, toolIDs)
    }

    // Get MCP tools to extract parameter schemas
    const mcpTools = await MCP.tools().catch(() => ({} as Record<string, any>))

    // Format results with parameters
    const formatted = results
      .map((tool, i) => {
        const status = tool.deferred ? (args.enable ? "[ENABLED]" : "[DEFERRED]") : "[AVAILABLE]"
        const mcpTool = mcpTools[tool.id]
        const paramsInfo = formatToolParameters(mcpTool)
        return `${i + 1}. ${tool.id} ${status}\n   ${tool.description}\n   Category: ${tool.category}${paramsInfo}`
      })
      .join("\n\n")

    const enabledMsg = args.enable
      ? `\n\n✓ ${results.length} tool(s) are now AVAILABLE for direct use.

Call them directly by name. Example:
${results[0]?.id || "tool_name"}({...arguments})`
      : ""

    return {
      title: `Found ${results.length} tools`,
      output: `Found ${results.length} tool(s) matching "${args.query}":\n\n${formatted}${enabledMsg}`,
      metadata: {
        query: args.query,
        count: results.length,
        tools: results.map((t) => t.id),
        enabled: args.enable,
      },
    }
  },
})
