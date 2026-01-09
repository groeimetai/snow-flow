import { createMCPClient } from "@ai-sdk/mcp"
import type { Tool } from "ai"
// StdioClientTransport still needed for local MCP servers
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { Config } from "../config/config"
import { Log } from "../util/log"
import { NamedError } from "../util/error"
import { Retry } from "../util/retry"
import z from "zod/v4"
import { Bus } from "../bus"
import { Instance } from "../project/instance"
import { withTimeout } from "@/util/timeout"
import path from "path"
import os from "os"

export namespace MCP {
  const log = Log.create({ service: "mcp" })

  /**
   * Read MCP config directly from disk files, bypassing Config.get() cache.
   * This is necessary because auth-routes writes new config to disk,
   * but Config.get() returns cached values.
   */
  async function readFreshMCPConfigFromDisk(): Promise<Record<string, Config.Mcp>> {
    const mcpConfig: Record<string, Config.Mcp> = {}

    // Config file locations (same as Config module uses)
    const configPaths = [
      path.join(process.cwd(), ".mcp.json"),
      path.join(process.cwd(), ".snow-code", "opencode.json"),
      path.join(os.homedir(), ".config", "snow-code", "opencode.json"),
    ]

    for (const configPath of configPaths) {
      try {
        const file = Bun.file(configPath)
        if (await file.exists()) {
          const content = await file.text()
          const parsed = JSON.parse(content)

          // Handle both .mcp.json format and opencode.json format
          const mcpSection = parsed.mcp ?? parsed.mcpServers ?? {}

          // Merge into result (later files override earlier ones)
          for (const [name, config] of Object.entries(mcpSection)) {
            mcpConfig[name] = config as Config.Mcp
          }

          log.debug("read mcp config from disk", { path: configPath, servers: Object.keys(mcpSection) })
        }
      } catch (error) {
        log.debug("failed to read config file", {
          path: configPath,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return mcpConfig
  }

  export const Failed = NamedError.create(
    "MCPFailed",
    z.object({
      name: z.string(),
    }),
  )

  export const ConnectionError = NamedError.create(
    "MCPConnectionError",
    z.object({
      name: z.string(),
      message: z.string(),
      retryable: z.boolean(),
    }),
  )

  // MCP-specific events for UI feedback
  export const Event = {
    Connected: Bus.event(
      "mcp.connected",
      z.object({
        name: z.string(),
        message: z.string(),
      }),
    ),
    Disconnected: Bus.event(
      "mcp.disconnected",
      z.object({
        name: z.string(),
        message: z.string(),
        autoReconnect: z.boolean(),
      }),
    ),
    Reconnecting: Bus.event(
      "mcp.reconnecting",
      z.object({
        name: z.string(),
        attempt: z.number(),
        maxAttempts: z.number(),
        delay: z.number(),
      }),
    ),
    ReconnectFailed: Bus.event(
      "mcp.reconnect_failed",
      z.object({
        name: z.string(),
        attempts: z.number(),
        error: z.string(),
      }),
    ),
    ToolCallRetrying: Bus.event(
      "mcp.tool_call_retrying",
      z.object({
        clientName: z.string(),
        toolName: z.string(),
        attempt: z.number(),
        error: z.string(),
      }),
    ),
  }

  type MCPClient = Awaited<ReturnType<typeof createMCPClient>>

  interface ManagedClient {
    client: MCPClient
    manager: ReturnType<typeof Retry.createReconnectionManager<MCPClient>>
    config: Config.Mcp
  }

  const state = Instance.state(
    async () => {
      const cfg = await Config.get()
      const config = cfg.mcp ?? {}
      const clients: {
        [name: string]: ManagedClient
      } = {}

      await Promise.all(
        Object.entries(config).map(async ([key, mcp]) => {
          const result = await createWithRetry(key, mcp).catch(() => undefined)
          if (!result) return
          clients[key] = result
        }),
      )

      return {
        clients,
        config,
      }
    },
    async (state) => {
      for (const managed of Object.values(state.clients)) {
        managed.manager.disconnect()
        managed.client.close()
      }
    },
  )

  export async function add(name: string, mcp: Config.Mcp) {
    const s = await state()
    const result = await createWithRetry(name, mcp)
    if (!result) return
    s.clients[name] = result
  }

  /**
   * Reload MCP configuration from disk and add any new servers
   * This is useful after auth updates the MCP config
   */
  export async function reload(): Promise<{ added: string[]; failed: string[] }> {
    const s = await state()
    // Read directly from disk to bypass Config.get() cache
    const newConfig = await readFreshMCPConfigFromDisk()
    log.info("reloading mcp config from disk", { servers: Object.keys(newConfig) })

    const added: string[] = []
    const failed: string[] = []

    // Find servers in config that aren't in current state
    await Promise.all(
      Object.entries(newConfig).map(async ([name, mcp]) => {
        // Skip if already loaded
        if (s.clients[name]) {
          log.debug("mcp server already loaded, skipping", { name })
          return
        }

        // Skip disabled servers
        if (mcp.enabled === false) {
          log.debug("mcp server disabled, skipping", { name })
          return
        }

        log.info("loading new mcp server from config", { name })
        const result = await createWithRetry(name, mcp).catch((error) => {
          log.error("failed to load new mcp server", { name, error: error instanceof Error ? error.message : String(error) })
          return undefined
        })

        if (result) {
          s.clients[name] = result
          s.config[name] = mcp
          added.push(name)
        } else {
          failed.push(name)
        }
      }),
    )

    if (added.length > 0) {
      log.info("mcp reload complete", { added, failed })
    }

    return { added, failed }
  }

  /**
   * Get retry options from config with defaults
   */
  function getRetryOptions(mcp: Config.Mcp, serverName?: string): Retry.Options {
    const retryConfig = mcp.retry ?? {}
    const maxRetries = retryConfig.maxRetries ?? 3
    return {
      maxRetries,
      initialDelay: retryConfig.initialDelay ?? 1000,
      maxDelay: retryConfig.maxDelay ?? 30000,
      backoffFactor: retryConfig.backoffFactor ?? 2,
      jitter: true,
      onRetry: (attempt, delay, error) => {
        const errorMsg = error instanceof Error ? error.message : String(error)
        log.info("retrying connection", {
          name: serverName,
          attempt,
          delay,
          error: errorMsg,
        })
        if (serverName) {
          Bus.publish(Event.Reconnecting, {
            name: serverName,
            attempt,
            maxAttempts: maxRetries,
            delay,
          })
        }
      },
    }
  }

  /**
   * Create MCP client with retry logic
   */
  async function createWithRetry(name: string, mcp: Config.Mcp): Promise<ManagedClient | undefined> {
    if (mcp.enabled === false) {
      log.info("mcp server disabled", { name })
      return
    }
    log.info("found", { name, type: mcp.type })

    const retryOptions = getRetryOptions(mcp, name)
    const autoReconnect = mcp.retry?.autoReconnect !== false
    const healthCheckInterval = mcp.retry?.healthCheckInterval ?? 30000
    const maxRetries = retryOptions.maxRetries ?? 3

    // Create a reconnection manager
    const manager = Retry.createReconnectionManager<MCPClient>({
      name,
      connect: async () => {
        const client = await createClient(name, mcp)
        if (!client) {
          throw new Error(`Failed to create MCP client for ${name}`)
        }
        return client
      },
      onConnected: () => {
        log.info("mcp client connected", { name })
        Bus.publish(Event.Connected, {
          name,
          message: `MCP server '${name}' connected`,
        })
      },
      onDisconnected: (error) => {
        log.warn("mcp client disconnected", { name, error: error?.message })
        Bus.publish(Event.Disconnected, {
          name,
          message: error?.message ?? "Connection lost",
          autoReconnect,
        })
      },
      onReconnecting: (attempt) => {
        log.info("mcp client reconnecting", { name, attempt })
        Bus.publish(Event.Reconnecting, {
          name,
          attempt,
          maxAttempts: maxRetries,
          delay: Retry.calculateDelay(attempt, retryOptions),
        })
      },
      maxReconnectAttempts: maxRetries,
      reconnectDelay: retryOptions.initialDelay ?? 1000,
      maxReconnectDelay: retryOptions.maxDelay ?? 30000,
      healthCheckInterval: healthCheckInterval > 0 ? healthCheckInterval : undefined,
      healthCheck: healthCheckInterval > 0 ? async (client) => {
        try {
          // Try to fetch tools as a health check
          await withTimeout(client.tools(), 5000)
          return true
        } catch {
          return false
        }
      } : undefined,
    })

    // Initial connection with retry
    const result = await Retry.withRetry(
      async () => {
        const client = await createClient(name, mcp)
        if (!client) {
          throw new Error(`Failed to create MCP client for ${name}`)
        }
        return client
      },
      retryOptions,
    )

    if (!result.success || !result.data) {
      const errorMsg = result.error?.message ?? "Unknown error"
      log.error("mcp client creation failed after retries", {
        name,
        attempts: result.attempts,
        error: errorMsg,
      })
      Bus.publish(Event.ReconnectFailed, {
        name,
        attempts: result.attempts,
        error: errorMsg,
      })
      return
    }

    // Publish connected event for successful initial connection
    Bus.publish(Event.Connected, {
      name,
      message: `MCP server '${name}' connected`,
    })

    return {
      client: result.data,
      manager,
      config: mcp,
    }
  }

  /**
   * Create the raw MCP client (without retry logic)
   */
  async function createClient(name: string, mcp: Config.Mcp): Promise<MCPClient | undefined> {
    let mcpClient: MCPClient | undefined

    if (mcp.type === "remote") {
      // AI SDK 6: Use the new simplified transport config format
      // Detect SSE-only endpoints (URLs ending in /sse) and skip HTTP transport
      const isSSEEndpoint = mcp.url.endsWith('/sse') || mcp.url.includes('/sse?')

      const transportConfigs: Array<{ name: string; config: { type: 'http' | 'sse'; url: string; headers?: Record<string, string> } }> = isSSEEndpoint
        ? [
            // SSE-only endpoint - skip HTTP transport entirely
            {
              name: "SSE",
              config: {
                type: 'sse',
                url: mcp.url,
                headers: mcp.headers,
              },
            },
          ]
        : [
            // Try HTTP first (StreamableHTTP), then fall back to SSE
            {
              name: "HTTP",
              config: {
                type: 'http',
                url: mcp.url,
                headers: mcp.headers,
              },
            },
            {
              name: "SSE",
              config: {
                type: 'sse',
                url: mcp.url,
                headers: mcp.headers,
              },
            },
          ]
      let lastError: Error | undefined
      for (const { name: transportName, config } of transportConfigs) {
        const client = await createMCPClient({
          name: "opencode",
          transport: config,
        }).catch((error) => {
          lastError = error instanceof Error ? error : new Error(String(error))
          log.debug("transport connection failed", {
            name,
            transport: transportName,
            url: mcp.url,
            error: lastError.message,
          })
          return null
        })
        if (client) {
          log.debug("transport connection succeeded", { name, transport: transportName })
          mcpClient = client
          break
        }
      }
      if (!mcpClient) {
        const errorMessage = lastError
          ? `MCP server ${name} failed to connect: ${lastError.message}`
          : `MCP server ${name} failed to connect to ${mcp.url}`
        log.error("remote mcp connection failed", { name, url: mcp.url, error: lastError?.message })
        throw new Error(errorMessage)
      }
    }

    if (mcp.type === "local") {
      const [cmd, ...args] = mcp.command
      const client = await createMCPClient({
        name: "opencode",
        transport: new StdioClientTransport({
          stderr: "ignore",
          command: cmd,
          args,
          env: {
            ...process.env,
            ...(cmd === "opencode" ? { BUN_BE_BUN: "1" } : {}),
            ...mcp.environment,
          },
        }),
      }).catch((error) => {
        const errorMessage =
          error instanceof Error
            ? `MCP server ${name} failed to start: ${error.message}`
            : `MCP server ${name} failed to start`
        log.error("local mcp startup failed", {
          name,
          command: mcp.command,
          error: error instanceof Error ? error.message : String(error),
        })
        throw new Error(errorMessage)
      })
      if (client) {
        mcpClient = client
      }
    }

    if (!mcpClient) {
      log.warn("mcp client not initialized", { name })
      return
    }

    const result = await withTimeout(mcpClient.tools(), mcp.timeout ?? 5000).catch(() => { })
    if (!result) {
      log.warn("mcp client verification failed, dropping client", { name })
      mcpClient.close()
      throw new Error(`MCP server ${name} failed tool verification`)
    }

    return mcpClient
  }

  /**
   * Reconnect a specific MCP server
   */
  export async function reconnect(name: string): Promise<boolean> {
    const s = await state()
    const managed = s.clients[name]

    if (!managed) {
      log.warn("mcp client not found for reconnect", { name })
      return false
    }

    log.info("triggering reconnect", { name })
    managed.manager.triggerReconnect()

    // Wait a bit for reconnection to complete
    await Retry.sleep(1000)

    const newState = managed.manager.getState()
    return newState.status === "connected"
  }

  /**
   * Reconnect all disconnected MCP servers
   */
  export async function reconnectAll(): Promise<Record<string, boolean>> {
    const s = await state()
    const results: Record<string, boolean> = {}

    await Promise.all(
      Object.entries(s.clients).map(async ([name, managed]) => {
        const state = managed.manager.getState()
        if (state.status === "disconnected" || state.status === "failed") {
          results[name] = await reconnect(name)
        } else {
          results[name] = true
        }
      }),
    )

    return results
  }

  /**
   * Restart a specific MCP server with fresh config from disk
   * This is needed when environment variables are updated (e.g., ServiceNow credentials)
   * Also works to start a server that failed initial startup (e.g., due to placeholder credentials)
   */
  export async function restart(name: string): Promise<boolean> {
    const s = await state()
    const managed = s.clients[name]

    // If client exists, close it first
    if (managed) {
      log.info("restarting mcp server with fresh config", { name })
      try {
        managed.manager.disconnect()
        managed.client.close()
      } catch (error) {
        log.debug("error closing existing client", { name, error })
      }
      delete s.clients[name]
    } else {
      log.info("starting mcp server (was not running)", { name })
    }

    // Read fresh config directly from disk (bypasses Config.get() cache)
    const freshMcpConfig = await readFreshMCPConfigFromDisk()
    const newConfig = freshMcpConfig[name]

    if (!newConfig) {
      log.warn("mcp server config not found", { name })
      return false
    }

    if (newConfig.enabled === false) {
      log.info("mcp server is disabled in config", { name })
      return false
    }

    // Create new client with fresh config
    const result = await createWithRetry(name, newConfig).catch((error) => {
      log.error("failed to start mcp server", { name, error: error instanceof Error ? error.message : String(error) })
      return undefined
    })

    if (result) {
      s.clients[name] = result
      s.config[name] = newConfig
      log.info("mcp server started successfully", { name })
      return true
    }

    return false
  }

  export async function status() {
    return state().then((state) => {
      const result: Record<string, "connected" | "connecting" | "disconnected" | "failed" | "disabled"> = {}
      for (const [key, client] of Object.entries(state.config)) {
        if (client.enabled === false) {
          result[key] = "disabled"
          continue
        }
        const managed = state.clients[key]
        if (managed) {
          const connectionState = managed.manager.getState()
          result[key] = connectionState.status
          continue
        }
        result[key] = "failed"
      }
      return result
    })
  }

  /**
   * Get detailed connection state for all MCP servers
   */
  export async function connectionStates(): Promise<Record<string, Retry.ConnectionState>> {
    const s = await state()
    const result: Record<string, Retry.ConnectionState> = {}

    for (const [name, managed] of Object.entries(s.clients)) {
      result[name] = managed.manager.getState()
    }

    return result
  }

  export async function clients() {
    return state().then((state) => {
      const result: Record<string, MCPClient> = {}
      for (const [name, managed] of Object.entries(state.clients)) {
        result[name] = managed.client
      }
      return result
    })
  }

  /**
   * Check connection and attempt reconnect if needed before tool execution
   * This should be called before critical operations
   */
  export async function ensureConnected(clientName: string): Promise<boolean> {
    const s = await state()
    const managed = s.clients[clientName]

    if (!managed) {
      log.warn("mcp client not found", { clientName })
      return false
    }

    const connectionState = managed.manager.getState()

    // If connected, we're good
    if (connectionState.status === "connected") {
      return true
    }

    // If disconnected, try to reconnect
    if (connectionState.status === "disconnected" || connectionState.status === "failed") {
      log.info("client not connected, attempting reconnect", { clientName, status: connectionState.status })
      return await reconnect(clientName)
    }

    // If connecting, wait a bit
    if (connectionState.status === "connecting") {
      await Retry.sleep(2000)
      const newState = managed.manager.getState()
      return newState.status === "connected"
    }

    return false
  }

  /**
   * Ensure all MCP servers are connected, reconnecting as needed
   */
  export async function ensureAllConnected(): Promise<Record<string, boolean>> {
    const s = await state()
    const results: Record<string, boolean> = {}

    await Promise.all(
      Object.keys(s.clients).map(async (name) => {
        results[name] = await ensureConnected(name)
      }),
    )

    return results
  }

  export async function tools() {
    const result: Record<string, Tool> = {}
    const s = await state()

    for (const [clientName, managed] of Object.entries(s.clients)) {
      const connectionState = managed.manager.getState()

      // Skip disconnected clients but try to reconnect them first
      if (connectionState.status !== "connected") {
        log.debug("client not connected, attempting reconnect before fetching tools", { clientName, status: connectionState.status })
        const reconnected = await ensureConnected(clientName)
        if (!reconnected) {
          log.debug("skipping tools from disconnected client", { clientName, status: connectionState.status })
          continue
        }
      }

      try {
        const clientTools = await withTimeout(managed.client.tools(), 5000)
        for (const [toolName, tool] of Object.entries(clientTools)) {
          const sanitizedClientName = clientName.replace(/\s+/g, "_")
          const sanitizedToolName = toolName.replace(/[-\s]+/g, "_")
          result[sanitizedClientName + "_" + sanitizedToolName] = tool
        }
      } catch (error) {
        log.warn("failed to get tools from client", {
          clientName,
          error: error instanceof Error ? error.message : String(error),
        })
        // Try to trigger reconnect for next time
        managed.manager.triggerReconnect()
      }
    }
    return result
  }
}
