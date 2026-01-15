import path from "path"
import fs from "fs/promises"
import { Token } from "./token"
import { Log } from "./log"
import { Instance } from "../project/instance"
import { Bus } from "../bus"
import z from "zod/v4"

/**
 * TokenDebug - Comprehensive token tracking for debugging
 *
 * This module captures ALL token information flowing through snow-code,
 * including system prompts, messages, tools, and API responses.
 *
 * Enable via:
 * - Environment: SNOWCODE_DEBUG_TOKENS=true
 * - Runtime: /debug slash command in TUI
 */
export namespace TokenDebug {
  const log = Log.create({ service: "token-debug" })

  // State for runtime toggle
  const state = {
    enabled: false,
    sessionFilter: undefined as string | undefined,
    logPath: undefined as string | undefined,
  }

  export const Event = {
    Toggled: Bus.event(
      "token-debug.toggled",
      z.object({
        enabled: z.boolean(),
        logPath: z.string().optional(),
      }),
    ),
  }

  export interface TokenBreakdown {
    estimated: number
    characters: number
  }

  export interface SystemPromptEntry {
    index: number
    content: string
    fullLength: number
    tokens: TokenBreakdown
  }

  export interface MessageEntry {
    id: string
    role: "user" | "assistant"
    partsCount: number
    tokens: TokenBreakdown
    parts: {
      type: string
      tokens: TokenBreakdown
      preview: string
      fullLength: number
    }[]
  }

  export interface ToolEntry {
    id: string
    description: string
    fullDescriptionLength: number
    fullSchemaLength: number
    schemaTokens: TokenBreakdown
  }

  export interface APIRequestLog {
    timestamp: string
    sessionID: string
    requestID: string
    model: {
      providerID: string
      modelID: string
      contextLimit: number
      outputLimit: number
    }
    systemPrompts: {
      count: number
      totalTokens: TokenBreakdown
      entries: SystemPromptEntry[]
    }
    messages: {
      count: number
      totalTokens: TokenBreakdown
      entries: MessageEntry[]
    }
    tools: {
      count: number
      totalTokens: TokenBreakdown
      entries: ToolEntry[]
    }
    totals: {
      estimatedInputTokens: number
      contextUsagePercent: number
      remainingForOutput: number
    }
  }

  export interface APIResponseLog {
    timestamp: string
    sessionID: string
    requestID: string
    tokens: {
      input: number
      output: number
      reasoning: number
      cacheRead: number
      cacheWrite: number
      total: number
    }
    cost: number
    finishReason: string
    duration: number
  }

  export interface DebugSession {
    sessionID: string
    startTime: string
    requests: (APIRequestLog | APIResponseLog)[]
  }

  /**
   * Check if debug mode is enabled
   */
  export function isEnabled(): boolean {
    // Check environment variable first
    const envEnabled = process.env["SNOWCODE_DEBUG_TOKENS"]?.toLowerCase()
    if (envEnabled === "true" || envEnabled === "1") {
      return true
    }
    // Then check runtime state
    return state.enabled
  }

  /**
   * Enable debug mode at runtime
   */
  export async function enable(options?: { sessionID?: string }): Promise<string> {
    state.enabled = true
    state.sessionFilter = options?.sessionID

    // Create debug log directory in project folder (current working directory)
    // This makes it easy to find and access the debug logs for each project
    const projectDir = process.cwd()
    const debugDir = path.join(projectDir, ".snow-code", "token-debug")
    await fs.mkdir(debugDir, { recursive: true })

    // Create timestamped log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    state.logPath = path.join(debugDir, `debug-${timestamp}.jsonl`)

    log.info("Token debug enabled", { logPath: state.logPath, projectDir })

    Bus.publish(Event.Toggled, {
      enabled: true,
      logPath: state.logPath,
    })

    return state.logPath
  }

  /**
   * Disable debug mode
   */
  export function disable(): void {
    state.enabled = false
    state.sessionFilter = undefined

    log.info("Token debug disabled", { logPath: state.logPath })

    Bus.publish(Event.Toggled, {
      enabled: false,
      logPath: state.logPath,
    })
  }

  /**
   * Toggle debug mode
   */
  export async function toggle(): Promise<{ enabled: boolean; logPath?: string }> {
    if (state.enabled) {
      disable()
      return { enabled: false }
    } else {
      const logPath = await enable()
      return { enabled: true, logPath }
    }
  }

  /**
   * Get current debug status
   */
  export function status(): { enabled: boolean; logPath?: string; sessionFilter?: string } {
    return {
      enabled: isEnabled(),
      logPath: state.logPath,
      sessionFilter: state.sessionFilter,
    }
  }

  /**
   * Log an API request with full token breakdown
   */
  export async function logRequest(input: {
    sessionID: string
    requestID: string
    providerID: string
    modelID: string
    contextLimit: number
    outputLimit: number
    systemPrompts: string[]
    messages: {
      info: { id: string; role: "user" | "assistant" }
      parts: { type: string; [key: string]: any }[]
    }[]
    tools: Record<string, { description?: string; inputSchema?: any }>
  }): Promise<void> {
    if (!isEnabled()) return
    if (state.sessionFilter && state.sessionFilter !== input.sessionID) return

    const entry: APIRequestLog = {
      timestamp: new Date().toISOString(),
      sessionID: input.sessionID,
      requestID: input.requestID,
      model: {
        providerID: input.providerID,
        modelID: input.modelID,
        contextLimit: input.contextLimit,
        outputLimit: input.outputLimit,
      },
      systemPrompts: calculateSystemPrompts(input.systemPrompts),
      messages: calculateMessages(input.messages),
      tools: calculateTools(input.tools),
      totals: {
        estimatedInputTokens: 0,
        contextUsagePercent: 0,
        remainingForOutput: 0,
      },
    }

    // Calculate totals
    entry.totals.estimatedInputTokens =
      entry.systemPrompts.totalTokens.estimated +
      entry.messages.totalTokens.estimated +
      entry.tools.totalTokens.estimated

    const usableContext = input.contextLimit - input.outputLimit
    entry.totals.contextUsagePercent = Math.round((entry.totals.estimatedInputTokens / usableContext) * 100)
    entry.totals.remainingForOutput = usableContext - entry.totals.estimatedInputTokens

    await writeEntry(entry)

    log.debug("Request logged", {
      requestID: input.requestID,
      estimatedTokens: entry.totals.estimatedInputTokens,
      contextUsage: entry.totals.contextUsagePercent + "%",
    })
  }

  /**
   * Log an API response with token usage
   */
  export async function logResponse(input: {
    sessionID: string
    requestID: string
    tokens: {
      input: number
      output: number
      reasoning: number
      cache: { read: number; write: number }
    }
    cost: number
    finishReason: string
    startTime: number
  }): Promise<void> {
    if (!isEnabled()) return
    if (state.sessionFilter && state.sessionFilter !== input.sessionID) return

    const entry: APIResponseLog = {
      timestamp: new Date().toISOString(),
      sessionID: input.sessionID,
      requestID: input.requestID,
      tokens: {
        input: input.tokens.input,
        output: input.tokens.output,
        reasoning: input.tokens.reasoning,
        cacheRead: input.tokens.cache.read,
        cacheWrite: input.tokens.cache.write,
        total:
          input.tokens.input +
          input.tokens.output +
          input.tokens.reasoning +
          input.tokens.cache.read +
          input.tokens.cache.write,
      },
      cost: input.cost,
      finishReason: input.finishReason,
      duration: Date.now() - input.startTime,
    }

    await writeEntry(entry)

    log.debug("Response logged", {
      requestID: input.requestID,
      inputTokens: input.tokens.input,
      outputTokens: input.tokens.output,
      duration: entry.duration + "ms",
    })
  }

  /**
   * Generate a summary report of the current debug session
   */
  export async function generateReport(): Promise<string> {
    if (!state.logPath) {
      return "No debug session active"
    }

    try {
      const content = await fs.readFile(state.logPath, "utf-8")
      const lines = content.trim().split("\n").filter(Boolean)
      const entries = lines.map((line) => JSON.parse(line))

      let totalRequests = 0
      let totalInputTokens = 0
      let totalOutputTokens = 0
      let totalCost = 0

      for (const entry of entries) {
        if ("systemPrompts" in entry) {
          totalRequests++
        }
        if ("tokens" in entry && "input" in entry.tokens) {
          totalInputTokens += entry.tokens.input
          totalOutputTokens += entry.tokens.output
          totalCost += entry.cost || 0
        }
      }

      return `
# Token Debug Report

**Log File:** ${state.logPath}
**Entries:** ${entries.length}
**API Requests:** ${totalRequests}

## Token Usage
- **Total Input:** ${totalInputTokens.toLocaleString()} tokens
- **Total Output:** ${totalOutputTokens.toLocaleString()} tokens
- **Total Cost:** $${totalCost.toFixed(4)}

## Log Location
View full details: ${state.logPath}
`.trim()
    } catch (error) {
      return `Error generating report: ${error}`
    }
  }

  // Helper functions

  function calculateSystemPrompts(prompts: string[]): APIRequestLog["systemPrompts"] {
    const entries: SystemPromptEntry[] = prompts.map((content, index) => ({
      index,
      content: content.length > 500 ? content.substring(0, 500) + "...[truncated]" : content,
      fullLength: content.length,
      tokens: {
        estimated: Token.estimate(content),
        characters: content.length,
      },
    }))

    const totalChars = prompts.reduce((sum, p) => sum + p.length, 0)
    const totalTokens = prompts.reduce((sum, p) => sum + Token.estimate(p), 0)

    return {
      count: prompts.length,
      totalTokens: {
        estimated: totalTokens,
        characters: totalChars,
      },
      entries,
    }
  }

  function calculateMessages(
    messages: {
      info: { id: string; role: "user" | "assistant" }
      parts: { type: string; [key: string]: any }[]
    }[],
  ): APIRequestLog["messages"] {
    const entries: MessageEntry[] = messages.map((msg) => {
      const parts = msg.parts.map((part) => {
        let content = ""
        let preview = ""

        if (part.type === "text" && "text" in part) {
          content = part.text
          preview = content.substring(0, 100) + (content.length > 100 ? "..." : "")
        } else if (part.type === "tool" && "state" in part) {
          const state = part.state as any
          if (state.output) {
            content = JSON.stringify(state.input) + JSON.stringify(state.output)
            preview = `Tool: ${part.tool || "unknown"} - ${state.status}`
          }
        } else if (part.type === "file") {
          preview = `File: ${part.filename || part.url}`
          content = part.url || ""
        } else {
          content = JSON.stringify(part)
          preview = `${part.type}: ${content.substring(0, 50)}...`
        }

        return {
          type: part.type,
          tokens: {
            estimated: Token.estimate(content),
            characters: content.length,
          },
          preview,
          fullLength: content.length,
        }
      })

      const totalChars = parts.reduce((sum, p) => sum + p.tokens.characters, 0)
      const totalTokens = parts.reduce((sum, p) => sum + p.tokens.estimated, 0)

      return {
        id: msg.info.id,
        role: msg.info.role,
        partsCount: msg.parts.length,
        tokens: {
          estimated: totalTokens,
          characters: totalChars,
        },
        parts,
      }
    })

    const totalChars = entries.reduce((sum, e) => sum + e.tokens.characters, 0)
    const totalTokens = entries.reduce((sum, e) => sum + e.tokens.estimated, 0)

    return {
      count: messages.length,
      totalTokens: {
        estimated: totalTokens,
        characters: totalChars,
      },
      entries,
    }
  }

  function calculateTools(
    tools: Record<string, { description?: string; inputSchema?: any }>,
  ): APIRequestLog["tools"] {
    const entries: ToolEntry[] = Object.entries(tools).map(([id, tool]) => {
      const schemaStr = JSON.stringify(tool.inputSchema || {})
      const descStr = tool.description || ""
      const totalContent = schemaStr + descStr

      return {
        id,
        description: descStr.substring(0, 100) + (descStr.length > 100 ? "..." : ""),
        fullDescriptionLength: descStr.length,
        fullSchemaLength: schemaStr.length,
        schemaTokens: {
          estimated: Token.estimate(totalContent),
          characters: totalContent.length,
        },
      }
    })

    const totalChars = entries.reduce((sum, e) => sum + e.schemaTokens.characters, 0)
    const totalTokens = entries.reduce((sum, e) => sum + e.schemaTokens.estimated, 0)

    return {
      count: Object.keys(tools).length,
      totalTokens: {
        estimated: totalTokens,
        characters: totalChars,
      },
      entries,
    }
  }

  async function writeEntry(entry: APIRequestLog | APIResponseLog): Promise<void> {
    if (!state.logPath) {
      // Create default log path in project directory if not set
      const projectDir = process.cwd()
      const debugDir = path.join(projectDir, ".snow-code", "token-debug")
      await fs.mkdir(debugDir, { recursive: true })
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
      state.logPath = path.join(debugDir, `debug-${timestamp}.jsonl`)
    }

    await fs.appendFile(state.logPath, JSON.stringify(entry) + "\n")
  }
}
