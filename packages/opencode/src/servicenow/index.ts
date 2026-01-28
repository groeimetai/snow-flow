/**
 * ServiceNow Integration for Snow-Flow
 *
 * This module provides the entry point for ServiceNow integration including:
 * - OAuth authentication
 * - MCP server management
 * - Enterprise proxy
 * - ServiceNow client utilities
 */

// Auth
export { ServiceNowOAuth } from "../auth/servicenow-oauth"
export type { ServiceNowAuthResult, ServiceNowOAuthOptions } from "../auth/servicenow-oauth"

// Utils
export { ServiceNowClient } from "./utils/servicenow-client"
export { Logger } from "./utils/logger"
export { BoundedMap, BoundedArray, BoundedSet } from "./utils/memory-safe-collections"
export { TimerRegistry, timerRegistry } from "./utils/timer-registry"

// Server exports (for standalone MCP server usage)
export { ServiceNowUnifiedServer } from "./servicenow-mcp-unified/server"

// MCP Configuration
export {
  getServiceNowMcpConfig,
  getServiceNowMcpConfigFromAuth,
  canConfigureServiceNowMcp,
  SERVICENOW_MCP_SERVER_NAME,
  SERVICENOW_MCP_CONFIG_EXAMPLE,
} from "./mcp-config"

/**
 * Default ServiceNow MCP configuration for use in opencode.json
 *
 * Example usage in opencode.json:
 * {
 *   "mcp": {
 *     "servicenow-unified": {
 *       "type": "local",
 *       "command": ["node", "node_modules/@groeimetai/snow-flow-ts/dist/servicenow/servicenow-mcp-unified/index.js"],
 *       "environment": {
 *         "SERVICENOW_INSTANCE_URL": "https://your-instance.service-now.com",
 *         "SERVICENOW_CLIENT_ID": "your-client-id",
 *         "SERVICENOW_CLIENT_SECRET": "your-client-secret"
 *       }
 *     }
 *   }
 * }
 */
export function getDefaultServiceNowMcpConfig() {
  return {
    type: "local" as const,
    command: [
      "node",
      "node_modules/@groeimetai/snow-flow-ts/dist/servicenow/servicenow-mcp-unified/index.js",
    ],
    environment: {
      SERVICENOW_INSTANCE_URL: process.env.SERVICENOW_INSTANCE_URL ?? "",
      SERVICENOW_CLIENT_ID: process.env.SERVICENOW_CLIENT_ID ?? "",
      SERVICENOW_CLIENT_SECRET: process.env.SERVICENOW_CLIENT_SECRET ?? "",
    },
    enabled: true,
  }
}

/**
 * Check if ServiceNow is configured
 * Returns true if all required environment variables or auth are present
 */
export async function isServiceNowConfigured(): Promise<boolean> {
  // Check environment variables
  const hasEnvConfig =
    process.env.SERVICENOW_INSTANCE_URL &&
    process.env.SERVICENOW_CLIENT_ID &&
    process.env.SERVICENOW_CLIENT_SECRET

  if (hasEnvConfig) return true

  // Check auth store (lazy import to avoid circular dependency)
  try {
    const { Auth } = await import("../auth")
    const auth = await Auth.get("servicenow")
    if (auth?.type === "servicenow-oauth" && auth.accessToken) {
      return true
    }
    if (auth?.type === "servicenow-basic" && auth.username && auth.password) {
      return true
    }
  } catch {
    // Auth module not available
  }

  return false
}

/**
 * Get ServiceNow credentials from auth store or environment
 */
export async function getServiceNowCredentials(): Promise<{
  instance: string
  clientId: string
  clientSecret: string
  accessToken?: string
  refreshToken?: string
} | null> {
  // First check auth store
  try {
    const { Auth } = await import("../auth")
    const auth = await Auth.get("servicenow")
    if (auth?.type === "servicenow-oauth") {
      return {
        instance: auth.instance,
        clientId: auth.clientId,
        clientSecret: auth.clientSecret,
        accessToken: auth.accessToken,
        refreshToken: auth.refreshToken,
      }
    }
  } catch {
    // Auth module not available
  }

  // Fall back to environment variables
  const instance = process.env.SERVICENOW_INSTANCE_URL
  const clientId = process.env.SERVICENOW_CLIENT_ID
  const clientSecret = process.env.SERVICENOW_CLIENT_SECRET

  if (instance && clientId && clientSecret) {
    return { instance, clientId, clientSecret }
  }

  return null
}
