/**
 * Snow-Code Portal Authentication (Email-based)
 *
 * Device authorization flow for Individual/Teams plan users.
 * Supports email/password login and magic link authentication.
 */

import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import os from "os"
import path from "path"
import fs from "fs"
import open from "open"
import crypto from "crypto"
import { Auth } from "../../auth"
import { UI } from "../ui"

// Portal URLs - Default to production (hosted portal)
// Can be overridden with environment variables or CLI options for local development
const DEFAULT_API_URL = "https://portal.snow-flow.dev"
const DEFAULT_PORTAL_URL = "https://portal.snow-flow.dev"

// Local development URLs (used when SNOW_FLOW_LOCAL=true)
const LOCAL_API_URL = "http://localhost:8001"
const LOCAL_PORTAL_URL = "http://localhost:5173"

// Check if running in local development mode
const IS_LOCAL = process.env.SNOW_FLOW_LOCAL === "true"

const PORTAL_URL = process.env.SNOW_FLOW_PORTAL_URL || DEFAULT_PORTAL_URL
const API_URL = process.env.SNOW_FLOW_API_URL || DEFAULT_API_URL

// Config directory
const CONFIG_DIR = path.join(os.homedir(), ".snow-code")
const PORTAL_CONFIG_FILE = path.join(CONFIG_DIR, "portal.json")

interface PortalCredentials {
  jira?: {
    baseUrl: string
    email: string
    apiToken: string
    enabled: boolean
  }
  "azure-devops"?: {
    baseUrl: string
    username?: string
    apiToken: string
    enabled: boolean
  }
  confluence?: {
    baseUrl: string
    email: string
    apiToken: string
    enabled: boolean
  }
}

interface PortalConfig {
  token: string
  refreshToken?: string
  expiresAt?: number
  userId: number
  email: string
  name?: string
  plan: "individual" | "teams"
  organizationId?: number
  organizationName?: string
  role?: "owner" | "admin" | "developer" | "stakeholder"
  machineId: string
  credentials?: PortalCredentials
  mcpServerUrl?: string
  lastSynced: number
}

/**
 * Generate a unique machine ID for device binding
 */
function generateMachineId(): string {
  const machineInfo = `${os.hostname()}-${os.platform()}-${os.homedir()}`
  return crypto.createHash("sha256").update(machineInfo).digest("hex")
}

/**
 * Get machine info for device authorization
 */
function getMachineInfo(): string {
  const hostname = os.hostname()
  const platform = os.platform()
  const username = os.userInfo().username
  return `${username}@${hostname} (${platform})`
}

/**
 * Read portal config from disk
 */
function readPortalConfig(): PortalConfig | null {
  try {
    if (!fs.existsSync(PORTAL_CONFIG_FILE)) {
      return null
    }
    const data = fs.readFileSync(PORTAL_CONFIG_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Failed to read portal config:", error)
    return null
  }
}

/**
 * Save portal config to disk
 */
function savePortalConfig(config: PortalConfig): void {
  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(PORTAL_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")
    // Set restrictive permissions
    fs.chmodSync(PORTAL_CONFIG_FILE, 0o600)
  } catch (error) {
    console.error("Failed to save portal config:", error)
    throw error
  }
}

/**
 * Delete portal config from disk
 */
function deletePortalConfig(): void {
  try {
    if (fs.existsSync(PORTAL_CONFIG_FILE)) {
      fs.unlinkSync(PORTAL_CONFIG_FILE)
    }
  } catch (error) {
    // Ignore errors
  }
}

/**
 * Get API URL - defaults to production, uses localhost if SNOW_FLOW_LOCAL=true
 */
function getApiUrl(): string {
  if (process.env.SNOW_FLOW_API_URL) return process.env.SNOW_FLOW_API_URL
  return IS_LOCAL ? LOCAL_API_URL : DEFAULT_API_URL
}

function getPortalUrl(): string {
  if (process.env.SNOW_FLOW_PORTAL_URL) return process.env.SNOW_FLOW_PORTAL_URL
  return IS_LOCAL ? LOCAL_PORTAL_URL : DEFAULT_PORTAL_URL
}

/**
 * Portal Login Command - Email/Password or Magic Link
 * Uses device authorization flow with browser-based approval
 */
export const AuthPortalLoginCommand = cmd({
  command: "portal-login",
  describe: "Authenticate with Snow-Flow Portal (Individual/Teams)",
  builder: (yargs) =>
    yargs
      .option("method", {
        describe: "Authentication method",
        type: "string",
        choices: ["browser", "email", "magic-link"],
        default: "browser",
      })
      .option("local", {
        describe: "Use local development URLs (localhost:8001 for API, localhost:5173 for portal)",
        type: "boolean",
        default: false,
      })
      .option("api-url", {
        describe: "Custom API URL (overrides --local)",
        type: "string",
      })
      .option("portal-url", {
        describe: "Custom portal frontend URL (overrides --local)",
        type: "string",
      }),
  async handler(args) {
    // Determine if using local mode (CLI flag or env var)
    const useLocal = (args as any).local || IS_LOCAL

    // Use command-line args if provided, otherwise check local mode, otherwise defaults
    const apiUrl = (args as any)["api-url"] || (useLocal ? LOCAL_API_URL : getApiUrl())
    const portalUrl = (args as any)["portal-url"] || (useLocal ? LOCAL_PORTAL_URL : getPortalUrl())

    prompts.log.info("")
    prompts.log.info("🚀 Snow-Flow Portal Authentication")
    prompts.log.info(`   API: ${apiUrl}`)
    prompts.log.info("")

    const method = (args as any).method || "browser"

    try {
      if (method === "browser") {
        await browserAuthFlow(apiUrl, portalUrl)
      } else if (method === "email") {
        await emailAuthFlow(apiUrl, portalUrl)
      } else if (method === "magic-link") {
        await magicLinkAuthFlow(apiUrl, portalUrl)
      }
    } catch (error: any) {
      if (error.message === "cancelled") {
        prompts.log.info("")
        prompts.log.warn("⚠️  Authentication cancelled")
        process.exit(0)
      }
      prompts.log.error("")
      prompts.log.error(`❌ Authentication failed: ${error.message}`)
      prompts.log.error("")
      process.exit(1)
    }
  },
})

/**
 * Browser-based device authorization flow
 */
async function browserAuthFlow(apiUrl: string, portalUrl: string) {
  // Step 1: Request device authorization session
  prompts.log.step("Requesting device authorization...")

  const machineInfo = getMachineInfo()

  let requestResponse: Response
  try {
    requestResponse = await fetch(`${apiUrl}/api/auth/device/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineInfo }),
    })
  } catch (networkError: any) {
    // Network error - can't connect to the API
    prompts.log.error("")
    prompts.log.error(`❌ Could not connect to API: ${apiUrl}`)
    prompts.log.error("")

    const isLocalUrl = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")
    if (isLocalUrl) {
      prompts.log.info("💡 Make sure the portal backend is running:")
      prompts.log.info("")
      prompts.log.info("   cd snow-flow-enterprise/portal/backend")
      prompts.log.info("   npm run dev")
      prompts.log.info("")
      prompts.log.info("   Or connect to production:")
      prompts.log.info("   snow-code auth portal-login (without --local)")
    } else {
      prompts.log.info("💡 Check your internet connection and try again.")
      prompts.log.info("")
      prompts.log.info("   For local development, use:")
      prompts.log.info("   snow-code auth portal-login --local")
    }
    prompts.log.info("")

    throw new Error(`Unable to connect to ${apiUrl}`)
  }

  if (!requestResponse.ok) {
    const error = await requestResponse.json()
    throw new Error(error.error || "Failed to request device authorization")
  }

  const { sessionId, verificationUrl, expiresIn } = await requestResponse.json()

  // Step 2: Open browser for user approval
  prompts.log.info("")
  prompts.log.success("✓ Device authorization session created")
  prompts.log.info("")
  prompts.log.info("🌐 Opening browser for authorization...")
  prompts.log.info("")
  prompts.log.info(`   If browser doesn't open automatically, visit:`)
  prompts.log.info(`   ${verificationUrl}`)
  prompts.log.info("")

  // Open browser
  try {
    await open(verificationUrl)
  } catch (openError) {
    prompts.log.warn("   ⚠️  Could not open browser automatically")
  }

  // Step 3: Wait for user to approve and paste code
  prompts.log.info("📋 After approving in the browser, you'll receive a code.")
  prompts.log.info("   Please paste it below:")
  prompts.log.info("")

  const authCodeResponse = await prompts.text({
    message: "Enter authorization code:",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Authorization code is required"
      }
      return undefined
    },
  })

  if (prompts.isCancel(authCodeResponse)) {
    throw new Error("cancelled")
  }

  const authCode = (authCodeResponse as string).trim()

  // Step 4: Verify code and get token
  prompts.log.step("Verifying authorization code...")

  const verifyResponse = await fetch(`${apiUrl}/api/auth/device/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, authCode }),
  })

  if (!verifyResponse.ok) {
    const error = await verifyResponse.json()
    throw new Error(error.error || "Failed to verify authorization code")
  }

  const verifyData = await verifyResponse.json()

  // Handle different response types (portal vs enterprise)
  if (verifyData.authType === "portal" || verifyData.portalUser) {
    await handlePortalAuthSuccess(verifyData, apiUrl, portalUrl)
  } else if (verifyData.customer) {
    // Enterprise user - redirect to enterprise login
    prompts.log.info("")
    prompts.log.warn("This account is an Enterprise customer.")
    prompts.log.info("Use 'snow-code auth enterprise-login' instead.")
    prompts.log.info("")
    process.exit(0)
  } else {
    throw new Error("Unknown authentication response")
  }
}

/**
 * Email/password authentication flow
 */
async function emailAuthFlow(apiUrl: string, portalUrl: string) {
  prompts.log.info("📧 Email/Password Authentication")
  prompts.log.info("")

  const emailResponse = await prompts.text({
    message: "Email:",
    validate: (value) => {
      if (!value || !value.includes("@")) {
        return "Please enter a valid email address"
      }
      return undefined
    },
  })

  if (prompts.isCancel(emailResponse)) {
    throw new Error("cancelled")
  }

  const passwordResponse = await prompts.password({
    message: "Password:",
    validate: (value) => {
      if (!value || value.length < 1) {
        return "Password is required"
      }
      return undefined
    },
  })

  if (prompts.isCancel(passwordResponse)) {
    throw new Error("cancelled")
  }

  const email = (emailResponse as string).trim()
  const password = passwordResponse as string

  prompts.log.step("Authenticating...")

  let response: Response
  try {
    response = await fetch(`${apiUrl}/api/portal/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
  } catch (networkError: any) {
    prompts.log.error("")
    prompts.log.error(`❌ Could not connect to API: ${apiUrl}`)
    prompts.log.info("")

    const isLocalUrl = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")
    if (isLocalUrl) {
      prompts.log.info("💡 Make sure the portal backend is running:")
      prompts.log.info("   cd snow-flow-enterprise/portal/backend && npm run dev")
    } else {
      prompts.log.info("💡 Check your internet connection and try again.")
    }
    prompts.log.info("")
    throw new Error(`Unable to connect to ${apiUrl}`)
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Authentication failed")
  }

  const data = await response.json()
  await handlePortalAuthSuccess({
    token: data.token,
    portalUser: data.user,
    organization: data.organization,
  }, apiUrl, portalUrl)
}

/**
 * Magic link authentication flow
 */
async function magicLinkAuthFlow(apiUrl: string, portalUrl: string) {
  prompts.log.info("🔗 Magic Link Authentication")
  prompts.log.info("")

  const emailResponse = await prompts.text({
    message: "Email:",
    validate: (value) => {
      if (!value || !value.includes("@")) {
        return "Please enter a valid email address"
      }
      return undefined
    },
  })

  if (prompts.isCancel(emailResponse)) {
    throw new Error("cancelled")
  }

  const email = (emailResponse as string).trim()

  prompts.log.step("Sending magic link...")

  let response: Response
  try {
    response = await fetch(`${apiUrl}/api/portal/auth/magic-link/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
  } catch (networkError: any) {
    prompts.log.error("")
    prompts.log.error(`❌ Could not connect to API: ${apiUrl}`)
    prompts.log.info("")

    const isLocalUrl = apiUrl.includes("localhost") || apiUrl.includes("127.0.0.1")
    if (isLocalUrl) {
      prompts.log.info("💡 Make sure the portal backend is running:")
      prompts.log.info("   cd snow-flow-enterprise/portal/backend && npm run dev")
    } else {
      prompts.log.info("💡 Check your internet connection and try again.")
    }
    prompts.log.info("")
    throw new Error(`Unable to connect to ${apiUrl}`)
  }

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || "Failed to send magic link")
  }

  prompts.log.success("✓ Magic link sent!")
  prompts.log.info("")
  prompts.log.info("📧 Check your email for a login link.")
  prompts.log.info("   Click the link to authenticate, then return here.")
  prompts.log.info("")

  // Wait for user to click magic link and paste the token
  const tokenResponse = await prompts.text({
    message: "Enter the verification code from your email:",
    validate: (value) => {
      if (!value || value.trim().length === 0) {
        return "Verification code is required"
      }
      return undefined
    },
  })

  if (prompts.isCancel(tokenResponse)) {
    throw new Error("cancelled")
  }

  const verificationToken = (tokenResponse as string).trim()

  prompts.log.step("Verifying magic link...")

  const verifyResponse = await fetch(`${apiUrl}/api/portal/auth/magic-link/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: verificationToken }),
  })

  if (!verifyResponse.ok) {
    const error = await verifyResponse.json()
    throw new Error(error.error || "Magic link verification failed")
  }

  const data = await verifyResponse.json()
  await handlePortalAuthSuccess({
    token: data.token,
    portalUser: data.user,
    organization: data.organization,
  }, apiUrl, portalUrl)
}

/**
 * Handle successful portal authentication
 */
async function handlePortalAuthSuccess(data: {
  token: string
  portalUser?: {
    id: number
    email: string
    name?: string
    plan: string
    organizationId?: number
    role?: string
  }
  organization?: {
    id: number
    name: string
  }
}, apiUrl: string = API_URL, portalUrl: string = PORTAL_URL) {
  const machineId = generateMachineId()

  prompts.log.success("✓ Authentication successful!")
  prompts.log.info("")

  // Fetch configured credentials (Jira, Azure DevOps, Confluence)
  prompts.log.step("Syncing configured integrations...")

  let credentials: PortalCredentials = {}
  let mcpServerUrl = ""

  try {
    const credentialsResponse = await fetch(`${apiUrl}/api/portal/auth/credentials`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${data.token}`,
        "Content-Type": "application/json",
      },
    })

    if (credentialsResponse.ok) {
      const credData = await credentialsResponse.json()
      credentials = credData.credentials || {}
      mcpServerUrl = credData.mcpServerUrl || ""
      prompts.log.success("✓ Integrations synced!")
    } else {
      // No credentials configured yet - that's OK
      prompts.log.info("   No integrations configured yet")
    }
  } catch (error) {
    // Network error - continue without credentials
    prompts.log.warn("   Could not fetch integrations (configure in portal)")
  }

  prompts.log.info("")

  // Save to portal config file
  const portalConfig: PortalConfig = {
    token: data.token,
    userId: data.portalUser?.id || 0,
    email: data.portalUser?.email || "",
    name: data.portalUser?.name,
    plan: (data.portalUser?.plan as "individual" | "teams") || "individual",
    organizationId: data.organization?.id,
    organizationName: data.organization?.name,
    role: data.portalUser?.role as any,
    machineId,
    credentials,
    mcpServerUrl,
    lastSynced: Date.now(),
  }

  savePortalConfig(portalConfig)

  // Also save to Auth system for consistency
  await Auth.set("portal", {
    type: "portal",
    token: data.token,
    userId: data.portalUser?.id || 0,
    email: data.portalUser?.email || "",
    name: data.portalUser?.name,
    plan: (data.portalUser?.plan as "individual" | "teams") || "individual",
    organizationId: data.organization?.id,
    organizationName: data.organization?.name,
    role: data.portalUser?.role as any,
    machineId,
  })

  // Show summary
  prompts.log.info("")
  prompts.log.info(UI.logoPortal("Authenticated"))
  prompts.log.info("")
  prompts.log.info(`   Email: ${data.portalUser?.email}`)
  prompts.log.info(`   Plan:  ${data.portalUser?.plan || "Individual"}`)

  if (data.organization) {
    prompts.log.info(`   Team:  ${data.organization.name}`)
    prompts.log.info(`   Role:  ${data.portalUser?.role || "member"}`)
  }

  prompts.log.info("")
  prompts.log.info("   Available Tools:")
  prompts.log.info("   ✓ Snow-Flow MCP Server (ServiceNow)")

  // Show configured integrations
  if (credentials.jira?.enabled) {
    prompts.log.info(`   ✓ Jira (${credentials.jira.baseUrl})`)
  }
  if (credentials["azure-devops"]?.enabled) {
    prompts.log.info(`   ✓ Azure DevOps (${credentials["azure-devops"].baseUrl})`)
  }
  if (credentials.confluence?.enabled) {
    prompts.log.info(`   ✓ Confluence (${credentials.confluence.baseUrl})`)
  }

  // If no integrations configured, show how to add them
  const hasIntegrations = credentials.jira?.enabled ||
    credentials["azure-devops"]?.enabled ||
    credentials.confluence?.enabled

  if (!hasIntegrations) {
    prompts.log.info("")
    prompts.log.info("   💡 Configure integrations at:")
    prompts.log.info(`      ${portalUrl}/portal/credentials`)
  }

  if (mcpServerUrl) {
    prompts.log.info("")
    prompts.log.info(`   MCP Server: ${mcpServerUrl}`)
  }

  prompts.log.info("")
  prompts.log.info("   📖 CLAUDE.md will be configured automatically at startup")
  prompts.log.info("   Next: Just type your request in the TUI to start developing")
  prompts.log.info("")
}

/**
 * Portal Logout Command
 */
export const AuthPortalLogoutCommand = cmd({
  command: "portal-logout",
  describe: "Log out from Snow-Flow Portal",
  async handler() {
    prompts.log.info("")
    prompts.log.info("🚪 Snow-Flow Portal Logout")
    prompts.log.info("")

    const config = readPortalConfig()

    if (!config) {
      prompts.log.warn("⚠️  Not currently logged in to Snow-Flow Portal")
      prompts.log.info("")
      return
    }

    // Delete local config
    deletePortalConfig()

    // Remove from Auth system
    await Auth.remove("portal")

    prompts.log.success("✓ Logged out successfully")
    prompts.log.info("")
    prompts.log.info(`   Removed credentials for: ${config.email}`)
    prompts.log.info("")
  },
})

/**
 * Portal Status Command
 */
export const AuthPortalStatusCommand = cmd({
  command: "portal-status",
  describe: "Show portal authentication status",
  async handler() {
    prompts.log.info("")
    prompts.log.info("📊 Snow-Flow Portal Status")
    prompts.log.info("")

    const config = readPortalConfig()

    if (!config) {
      prompts.log.warn("⚠️  Not authenticated with Snow-Flow Portal")
      prompts.log.info("")
      prompts.log.info("   Run 'snow-code auth portal-login' to get started")
      prompts.log.info("")
      return
    }

    // Check if token is still valid
    let tokenValid = false
    try {
      const response = await fetch(`${API_URL}/api/portal/auth/session`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      })
      tokenValid = response.ok
    } catch (error) {
      // Network error - can't verify
    }

    // Show status
    prompts.log.info(`   Email:  ${config.email}`)
    prompts.log.info(`   Plan:   ${config.plan}`)

    if (config.organizationName) {
      prompts.log.info(`   Team:   ${config.organizationName}`)
      prompts.log.info(`   Role:   ${config.role || "member"}`)
    }

    prompts.log.info("")
    prompts.log.info(`   Token:  ${tokenValid ? "✓ Valid" : "⚠️  Expired or invalid"}`)
    prompts.log.info(`   Last Synced: ${new Date(config.lastSynced).toLocaleString()}`)
    prompts.log.info("")

    if (!tokenValid) {
      prompts.log.warn("   Run 'snow-code auth portal-login' to re-authenticate")
      prompts.log.info("")
    }
  },
})

/**
 * Portal Refresh Command - Refresh authentication token
 */
export const AuthPortalRefreshCommand = cmd({
  command: "portal-refresh",
  describe: "Refresh portal authentication token",
  async handler() {
    prompts.log.info("")
    prompts.log.info("🔄 Snow-Flow Portal Token Refresh")
    prompts.log.info("")

    const config = readPortalConfig()

    if (!config) {
      prompts.log.error("❌ Not authenticated with Snow-Flow Portal")
      prompts.log.info("")
      prompts.log.info("   Run 'snow-code auth portal-login' first")
      prompts.log.info("")
      process.exit(1)
    }

    try {
      prompts.log.step("Refreshing token...")

      const response = await fetch(`${API_URL}/api/portal/auth/refresh`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.token}`,
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()

        if (response.status === 401) {
          prompts.log.error("❌ Token expired - please re-authenticate")
          prompts.log.info("")
          prompts.log.info("   Run 'snow-code auth portal-login' to re-authenticate")
          prompts.log.info("")
          process.exit(1)
        }

        throw new Error(error.error || "Token refresh failed")
      }

      const data = await response.json()

      // Update config with new token
      const updatedConfig: PortalConfig = {
        ...config,
        token: data.token,
        lastSynced: Date.now(),
      }

      savePortalConfig(updatedConfig)

      // Update Auth system
      await Auth.set("portal", {
        type: "portal",
        token: data.token,
        userId: config.userId,
        email: config.email,
        name: config.name,
        plan: config.plan,
        organizationId: config.organizationId,
        organizationName: config.organizationName,
        role: config.role,
        machineId: config.machineId,
      })

      prompts.log.success("✓ Token refreshed successfully!")
      prompts.log.info("")
    } catch (error: any) {
      prompts.log.error(`❌ Refresh failed: ${error.message}`)
      prompts.log.info("")
      process.exit(1)
    }
  },
})

// Export for use in main auth command
export { readPortalConfig }
