#!/usr/bin/env bun
/**
 * MCP HTTP Server — Bun entry point
 * ----------------------------------------------------------------------
 * Starts the Hono-based MCP server on a fixed port and wires up an HTTP
 * callback-based `ContextResolver` (see http-resolver.ts) so that tenant
 * credential resolution lives in the deployment that owns the tenant DB
 * (e.g. snow-flow-enterprise's portal backend), not in this image.
 *
 * Env vars (all required at runtime):
 *   MCP_RESOLVER_URL      — full URL of the downstream resolver endpoint
 *   MCP_INTERNAL_TOKEN    — shared secret sent on `X-Internal-Auth`
 *   MCP_HTTP_PORT         — listen port (default 8082)
 *
 * Intended runtime: Bun. The image is built from `Dockerfile.mcp-http`
 * and published as `ghcr.io/groeimetai/snow-flow-mcp-http`. Callers that
 * need to self-host can also run it via `bun run http-entry.ts`.
 */

import { toolRegistry } from "../shared/tool-registry.js"
import { createHttpApp } from "./http.js"
import { createHttpResolver } from "./http-resolver.js"
import { mcpDebug, mcpWarn } from "../../shared/mcp-debug.js"

async function main(): Promise<void> {
  const resolverUrl = process.env.MCP_RESOLVER_URL
  const internalToken = process.env.MCP_INTERNAL_TOKEN
  const port = Number(process.env.MCP_HTTP_PORT ?? 8082)

  if (!resolverUrl || !internalToken) {
    throw new Error(
      "mcp-http entry requires MCP_RESOLVER_URL and MCP_INTERNAL_TOKEN env vars. " +
        "See transports/http-resolver.ts for the contract the endpoint must implement.",
    )
  }

  mcpDebug("[mcp-http] discovering tools…")
  const discovery = await toolRegistry.initialize()
  mcpDebug(
    `[mcp-http] tool discovery done: ${discovery.toolsRegistered} registered, ` +
      `${discovery.toolsFailed} failed across ${discovery.domains.length} domains`,
  )
  if (discovery.toolsFailed > 0) {
    for (const err of discovery.errors) {
      mcpWarn(`[mcp-http] tool load failed: ${err.filePath} — ${err.error}`)
    }
  }

  const app = createHttpApp({
    resolveContext: createHttpResolver({ url: resolverUrl, internalToken }),
  })

  // Bun's native server. Runs on Node too via `@hono/node-server`, but the
  // published image is Bun-based so we use the built-in server here.
  const server = (globalThis as any).Bun?.serve?.({ fetch: app.fetch, port })
  if (!server) {
    throw new Error(
      "Bun.serve is not available. This entry point is intended for the Bun runtime " +
        "shipped with Dockerfile.mcp-http.",
    )
  }

  mcpDebug(`[mcp-http] listening on :${port}`)
  mcpDebug(`[mcp-http] resolver endpoint: ${resolverUrl}`)

  const shutdown = async (signal: string) => {
    mcpDebug(`[mcp-http] received ${signal}, stopping…`)
    try {
      await server.stop?.(true)
    } catch {
      // ignore
    }
    process.exit(0)
  }

  process.on("SIGINT", () => {
    shutdown("SIGINT").catch(() => process.exit(1))
  })
  process.on("SIGTERM", () => {
    shutdown("SIGTERM").catch(() => process.exit(1))
  })
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err)
  // eslint-disable-next-line no-console
  console.error(`[mcp-http] fatal: ${msg}`)
  process.exit(1)
})
