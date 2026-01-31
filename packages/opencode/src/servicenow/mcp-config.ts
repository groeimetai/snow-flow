/**
 * ServiceNow MCP Configuration Helper
 *
 * Provides utilities to automatically configure the ServiceNow MCP server
 * when ServiceNow credentials are available in the auth store.
 */

import type { Config } from "../config/config"

/**
 * Get the default ServiceNow MCP server configuration
 *
 * This returns a local MCP server config that can be merged into the
 * snow-code.json mcp configuration.
 */
export function getServiceNowMcpConfig(options?: {
  instance?: string
  clientId?: string
  clientSecret?: string
  accessToken?: string
  refreshToken?: string
  lazyTools?: boolean
}): Config.Mcp {
  const environment: Record<string, string> = {
    // Enable lazy loading by default - reduces token usage from ~71k to ~2k
    SNOW_LAZY_TOOLS: options?.lazyTools === false ? "false" : "true",
  }

  if (options?.instance) {
    environment.SERVICENOW_INSTANCE_URL = options.instance
  }
  if (options?.clientId) {
    environment.SERVICENOW_CLIENT_ID = options.clientId
  }
  if (options?.clientSecret) {
    environment.SERVICENOW_CLIENT_SECRET = options.clientSecret
  }
  if (options?.accessToken) {
    environment.SERVICENOW_ACCESS_TOKEN = options.accessToken
  }
  if (options?.refreshToken) {
    environment.SERVICENOW_REFRESH_TOKEN = options.refreshToken
  }

  return {
    type: "local",
    command: [
      "node",
      "node_modules/@groeimetai/snow-flow-ts/dist/servicenow/servicenow-mcp-unified/index.js",
    ],
    environment,
    enabled: true,
  }
}

/**
 * Check if ServiceNow MCP can be configured
 *
 * Returns true if we have the necessary credentials to configure the MCP server.
 */
export async function canConfigureServiceNowMcp(): Promise<boolean> {
  // Check environment variables first
  if (
    process.env.SERVICENOW_INSTANCE_URL &&
    process.env.SERVICENOW_CLIENT_ID &&
    process.env.SERVICENOW_CLIENT_SECRET
  ) {
    return true
  }

  // Check auth store
  try {
    const { Auth } = await import("../auth")
    const snAuth = await Auth.get("servicenow")
    if (snAuth?.type === "servicenow-oauth" || snAuth?.type === "servicenow-basic") {
      return true
    }
  } catch {
    // Auth module not available
  }

  return false
}

/**
 * Get ServiceNow MCP config from auth store
 *
 * If ServiceNow credentials are available in the auth store, returns
 * the MCP config to load the servicenow-unified server.
 */
export async function getServiceNowMcpConfigFromAuth(): Promise<Config.Mcp | null> {
  // First check environment variables
  const envInstance = process.env.SERVICENOW_INSTANCE_URL
  const envClientId = process.env.SERVICENOW_CLIENT_ID
  const envClientSecret = process.env.SERVICENOW_CLIENT_SECRET

  if (envInstance && envClientId && envClientSecret) {
    return getServiceNowMcpConfig({
      instance: envInstance,
      clientId: envClientId,
      clientSecret: envClientSecret,
      accessToken: process.env.SERVICENOW_ACCESS_TOKEN,
      refreshToken: process.env.SERVICENOW_REFRESH_TOKEN,
    })
  }

  // Check auth store
  try {
    const { Auth } = await import("../auth")
    const snAuth = await Auth.get("servicenow")

    if (snAuth?.type === "servicenow-oauth") {
      return getServiceNowMcpConfig({
        instance: snAuth.instance,
        clientId: snAuth.clientId,
        clientSecret: snAuth.clientSecret,
        accessToken: snAuth.accessToken,
        refreshToken: snAuth.refreshToken,
      })
    }

    if (snAuth?.type === "servicenow-basic") {
      // For basic auth, we use different env vars
      return {
        type: "local",
        command: [
          "node",
          "node_modules/@groeimetai/snow-flow-ts/dist/servicenow/servicenow-mcp-unified/index.js",
        ],
        environment: {
          SERVICENOW_INSTANCE_URL: snAuth.instance,
          SERVICENOW_USERNAME: snAuth.username,
          SERVICENOW_PASSWORD: snAuth.password,
          // Enable lazy loading by default - reduces token usage from ~71k to ~2k
          SNOW_LAZY_TOOLS: "true",
        },
        enabled: true,
      }
    }
  } catch {
    // Auth module not available
  }

  return null
}

/**
 * ServiceNow MCP server name constant
 */
export const SERVICENOW_MCP_SERVER_NAME = "servicenow-unified"

/**
 * Instructions for configuring ServiceNow MCP in snow-code.json
 */
export const SERVICENOW_MCP_CONFIG_EXAMPLE = `
// Add to your snow-code.json or snow-code.jsonc:
{
  "mcp": {
    "servicenow-unified": {
      "type": "local",
      "command": ["node", "node_modules/@groeimetai/snow-flow-ts/dist/servicenow/servicenow-mcp-unified/index.js"],
      "environment": {
        "SERVICENOW_INSTANCE_URL": "https://your-instance.service-now.com",
        "SERVICENOW_CLIENT_ID": "your-oauth-client-id",
        "SERVICENOW_CLIENT_SECRET": "your-oauth-client-secret",
        "SNOW_LAZY_TOOLS": "true"  // Reduces token usage from ~71k to ~2k
      }
    }
  }
}

// Or use /auth to configure credentials interactively
`.trim()
