/**
 * Shared types for MCP request handlers.
 */

import { MCPPromptManager } from "../../shared/mcp-prompt-manager.js"
import { RequestContext } from "../shared/types.js"

/**
 * Resolves a per-request `RequestContext` from a transport-specific request.
 *
 * - Stdio transport returns a closure that produces a context with static
 *   ServiceNow credentials (loaded once at startup) plus per-request session
 *   ID derived from env vars / ToolSearch session file / JWT header.
 * - HTTP transport parses the JWT from `Authorization`, looks up the tenant
 *   instance in the portal DB, decrypts credentials via KMS, and returns a
 *   fully-populated context with `origin: "http"`.
 */
export type ContextResolver = (request: any) => Promise<RequestContext>

/**
 * Dependencies passed to every MCP request handler.
 */
export interface HandlerDeps {
  resolveContext: ContextResolver
  promptManager: MCPPromptManager
}
