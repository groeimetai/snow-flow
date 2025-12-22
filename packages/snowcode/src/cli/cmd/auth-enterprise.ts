/**
 * Snow-Code Enterprise Authentication via Device Authorization Flow
 *
 * Simplified browser-based authentication for enterprise users.
 * No password, no license key input - just approve in browser and paste code.
 */

import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import os from "os"
import path from "path"
import fs from "fs"
import open from "open"
import { UI } from "../ui"
import { detectHeadlessEnvironment } from "../../util/headless"

// Enterprise portal URL
const PORTAL_URL = process.env.SNOW_FLOW_PORTAL_URL || "https://portal.snow-flow.dev"
const API_URL = process.env.SNOW_FLOW_API_URL || "https://portal.snow-flow.dev"

// Config directory
const CONFIG_DIR = path.join(os.homedir(), ".snow-code")
const ENTERPRISE_CONFIG_FILE = path.join(CONFIG_DIR, "enterprise.json")

interface ServiceNowInstanceConfig {
  id: number
  instanceName: string
  instanceUrl: string
  environmentType: string
  clientId: string
  clientSecret: string
  isDefault: boolean
  enabled: boolean
}

type CredentialSource = 'user' | 'org'

interface CredentialPreferences {
  jira?: CredentialSource
  'azure-devops'?: CredentialSource
  confluence?: CredentialSource
  servicenow?: CredentialSource
  github?: CredentialSource
  gitlab?: CredentialSource
}

interface EnterpriseTheme {
  source: 'service-integrator' | 'custom-theme'
  // Custom theme info (if source is 'custom-theme')
  themeId?: number
  themeName?: string
  displayName?: string
  // Colors (hex format, e.g., '#3b82f6')
  primaryColor: string
  secondaryColor: string
  accentColor: string
  // Branding
  brandName?: string
  logoUrl?: string
  faviconUrl?: string
  whiteLabelEnabled?: boolean
  // Support info
  supportEmail?: string
  supportUrl?: string
  footerText?: string
  // Full theme config for advanced usage (desktop/console)
  themeConfig?: any
}

/**
 * Enterprise configuration stored locally.
 *
 * SECURITY: Only the JWT token is stored locally. All credentials (Jira, Azure DevOps,
 * Confluence, ServiceNow) are fetched server-side by the enterprise MCP server using
 * the JWT token to authenticate with the Portal API. Credentials NEVER leave the server.
 */
interface EnterpriseConfig {
  token: string
  customerId: number
  customerName: string
  company: string
  // Auth method: 'browser' for enterprise user login, 'license-key' for admin login
  authMethod: 'browser' | 'license-key'
  // Enterprise user info (when authMethod is 'browser')
  userId?: string
  username?: string
  email?: string
  role?: string
  mcpServerUrl: string
  // Theme configuration from portal (for UI customization only, no secrets)
  theme?: EnterpriseTheme
  lastSynced: number
}

/**
 * Read enterprise config from disk
 */
function readEnterpriseConfig(): EnterpriseConfig | null {
  try {
    if (!fs.existsSync(ENTERPRISE_CONFIG_FILE)) {
      return null
    }
    const data = fs.readFileSync(ENTERPRISE_CONFIG_FILE, "utf-8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Failed to read enterprise config:", error)
    return null
  }
}

/**
 * Save enterprise config to disk
 */
function saveEnterpriseConfig(config: EnterpriseConfig): void {
  try {
    // Ensure config directory exists
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(ENTERPRISE_CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8")
  } catch (error) {
    console.error("Failed to save enterprise config:", error)
    throw error
  }
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
 * Enterprise Login Command
 * Uses device authorization flow with browser-based approval
 */
export const AuthEnterpriseLoginCommand = cmd({
  command: "enterprise-login",
  describe: "Authenticate with Snow-Flow Enterprise using browser",
  async handler() {
    prompts.log.info("")
    prompts.log.info("🚀 Snow-Flow Enterprise Authentication")
    prompts.log.info("")

    try {
      // Step 1: Request device authorization session
      prompts.log.step("Requesting device authorization...")

      const machineInfo = getMachineInfo()
      const requestResponse = await fetch(`${API_URL}/api/auth/device/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ machineInfo })
      })

      if (!requestResponse.ok) {
        const error = await requestResponse.json()
        throw new Error(error.error || "Failed to request device authorization")
      }

      const { sessionId, verificationUrl, expiresIn } = await requestResponse.json()

      // Step 2: Open browser for user approval
      prompts.log.info("")
      prompts.log.success("✓ Device authorization session created")
      prompts.log.info("")

      // Check for headless environment
      const headlessEnv = detectHeadlessEnvironment()

      if (headlessEnv.isHeadless) {
        // Headless environment - show URL prominently
        prompts.log.info(`🌐 ${headlessEnv.reason}`)
        prompts.log.warn("Cannot auto-open browser in this environment")
        prompts.log.info("")
        prompts.log.step("Please open this URL in your browser:")
        prompts.log.info("")
        prompts.log.info(`   ${verificationUrl}`)
        prompts.log.info("")
      } else {
        // Normal environment - try to auto-open
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
        }
      })

      if (prompts.isCancel(authCodeResponse)) {
        prompts.log.info("")
        prompts.log.warn("⚠️  Authorization cancelled")
        process.exit(0)
      }

      const authCode = (authCodeResponse as string).trim()

      // Step 4: Verify code and get token
      prompts.log.step("Verifying authorization code...")

      const verifyResponse = await fetch(`${API_URL}/api/auth/device/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, authCode })
      })

      if (!verifyResponse.ok) {
        const error = await verifyResponse.json()
        throw new Error(error.error || "Failed to verify authorization code")
      }

      const verifyData = await verifyResponse.json()
      const { token, authType, customer, user } = verifyData

      prompts.log.success("✓ Authorization verified!")
      prompts.log.info("")

      // Determine if this is an enterprise user or admin (license key) login
      const isEnterpriseUser = authType === 'enterprise-user'
      const isEnterpriseAdmin = authType === 'enterprise'

      if (!isEnterpriseUser && !isEnterpriseAdmin) {
        // Portal user tried enterprise login - redirect them
        prompts.log.warn("This account is not associated with an Enterprise subscription.")
        prompts.log.info("Use 'snow-code auth portal-login' for Individual/Teams plans.")
        prompts.log.info("")
        process.exit(0)
      }

      // SECURITY: Block license key admin logins - they must use a user account
      if (isEnterpriseAdmin) {
        prompts.log.error("")
        prompts.log.error("⚠️  License key admin login is not allowed via CLI")
        prompts.log.info("")
        prompts.log.info("   Enterprise admins must create user accounts in the portal.")
        prompts.log.info("   Each CLI login counts as a licensed seat.")
        prompts.log.info("")
        prompts.log.info("   To create user accounts:")
        prompts.log.info("   1. Log in to the Snow-Flow Enterprise Portal")
        prompts.log.info("   2. Go to Settings → Team Management")
        prompts.log.info("   3. Invite users with their email addresses")
        prompts.log.info("   4. Users can then log in with 'snow-code auth login'")
        prompts.log.info("")
        process.exit(1)
      }

      // Step 5: Fetch enterprise credentials with user ID for credential selection
      prompts.log.step("Syncing enterprise credentials...")

      // For enterprise users, use fetch-for-cli to get both user and org credentials
      const credentialsResponse = isEnterpriseUser
        ? await fetch(`${API_URL}/api/credentials/fetch-for-cli`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
              licenseKey: customer.licenseKey,
              userId: user?.id
            })
          })
        : await fetch(`${API_URL}/api/auth/enterprise/credentials`, {
            method: "GET",
            headers: { "Authorization": `Bearer ${token}` }
          })

      if (!credentialsResponse.ok) {
        const error = await credentialsResponse.json()
        throw new Error(error.error || "Failed to fetch enterprise credentials")
      }

      const credentialsData = await credentialsResponse.json()

      // For enterprise users, handle credential selection
      let credentials = credentialsData.credentials || {}
      let servicenowInstances = credentialsData.servicenowInstances || []
      let mcpServerUrl = credentialsData.mcpServerUrl || ""
      let credentialPreferences: CredentialPreferences = {}
      // Extract theme from response
      const theme: EnterpriseTheme | undefined = credentialsData.theme || undefined

      // Check if user has credentials from multiple sources
      if (isEnterpriseUser && credentialsData.availableCredentials) {
        const { user: userCreds, org: orgCreds } = credentialsData.availableCredentials

        // Find services available from both sources
        const sharedServices = (userCreds || []).filter((s: string) => (orgCreds || []).includes(s))

        if (sharedServices.length > 0) {
          prompts.log.info("")
          prompts.log.info("📋 You have credentials available from multiple sources.")
          prompts.log.info("")

          // Ask user to select for each shared service
          for (const service of sharedServices) {
            const serviceLabel = service === 'azure-devops' ? 'Azure DevOps' :
                                service.charAt(0).toUpperCase() + service.slice(1)

            // Find the credentials for display
            const userCred = (credentialsData.credentials || []).find(
              (c: any) => c.service === service && c.source === 'user'
            )
            const orgCred = (credentialsData.credentials || []).find(
              (c: any) => c.service === service && c.source === 'org'
            )

            const choice = await prompts.select({
              message: `Which ${serviceLabel} credentials do you want to use?`,
              options: [
                {
                  value: 'user',
                  label: `Personal (${userCred?.baseUrl || 'your personal credentials'})`
                },
                {
                  value: 'org',
                  label: `Organization (${orgCred?.baseUrl || 'company credentials'})`
                }
              ]
            })

            if (prompts.isCancel(choice)) {
              prompts.log.info("")
              prompts.log.warn("⚠️  Credential selection cancelled")
              process.exit(0)
            }

            credentialPreferences[service as keyof CredentialPreferences] = choice as CredentialSource
          }

          // Set preferences for services only available from one source
          for (const service of userCreds || []) {
            if (!sharedServices.includes(service)) {
              credentialPreferences[service as keyof CredentialPreferences] = 'user'
            }
          }
          for (const service of orgCreds || []) {
            if (!sharedServices.includes(service)) {
              credentialPreferences[service as keyof CredentialPreferences] = 'org'
            }
          }
        }
      }

      // SECURITY: Do NOT store credentials locally - they are fetched server-side
      // by the enterprise MCP server using the JWT token.
      // We only show what integrations are available (read-only info).

      // Parse available integrations from response (for display only)
      const availableIntegrations: string[] = []
      const credsArray = Array.isArray(credentialsData.credentials)
        ? credentialsData.credentials
        : Object.keys(credentialsData.credentials || {})

      if (Array.isArray(credentialsData.credentials)) {
        for (const cred of credsArray) {
          if (cred.service && cred.enabled !== false) {
            availableIntegrations.push(cred.service)
          }
        }
      } else if (credentialsData.credentials) {
        // Object format
        const creds = credentialsData.credentials
        if (creds.jira?.enabled) availableIntegrations.push('jira')
        if (creds['azure-devops']?.enabled) availableIntegrations.push('azure-devops')
        if (creds.confluence?.enabled) availableIntegrations.push('confluence')
      }

      // Step 6: Save configuration (SECURITY: No credentials stored locally)
      const enterpriseConfig: EnterpriseConfig = {
        token,
        customerId: customer.id,
        customerName: customer.name,
        company: customer.company,
        // NOTE: licenseKey is NOT stored - JWT token is used for authentication
        authMethod: isEnterpriseUser ? 'browser' : 'license-key',
        ...(isEnterpriseUser && user && {
          userId: String(user.id),
          username: user.username,
          email: user.email,
          role: user.role
        }),
        mcpServerUrl,
        theme,
        lastSynced: Date.now()
      }

      saveEnterpriseConfig(enterpriseConfig)

      prompts.log.success("✓ Enterprise authentication complete!")
      prompts.log.info("")

      // Step 7: Show summary
      prompts.log.info("")
      prompts.log.info(UI.logoEnterprise("Authenticated"))
      prompts.log.info("")

      if (isEnterpriseUser && user) {
        prompts.log.info(`   User:     ${user.username || user.email}`)
        prompts.log.info(`   Role:     ${user.role}`)
      }
      prompts.log.info(`   Customer: ${customer.name}`)
      prompts.log.info(`   Company:  ${customer.company}`)
      prompts.log.info("")
      prompts.log.info("   Available Integrations (credentials fetched server-side):")

      if (availableIntegrations.includes('jira')) {
        prompts.log.info(`   ✓ Jira`)
      }
      if (availableIntegrations.includes('azure-devops')) {
        prompts.log.info(`   ✓ Azure DevOps`)
      }
      if (availableIntegrations.includes('confluence')) {
        prompts.log.info(`   ✓ Confluence`)
      }

      // Show ServiceNow instances (read-only info)
      if (servicenowInstances && servicenowInstances.length > 0) {
        prompts.log.info("")
        prompts.log.info("   ServiceNow Instances:")
        for (const inst of servicenowInstances) {
          const defaultTag = inst.isDefault ? " (default)" : ""
          prompts.log.info(`   ✓ ${inst.instanceName} [${inst.environmentType}]${defaultTag}`)
        }
      }

      prompts.log.info("")
      prompts.log.info(`   MCP Server: ${mcpServerUrl}`)

      // Show theme info if available
      if (theme) {
        prompts.log.info("")
        prompts.log.info("   Theme:")
        if (theme.brandName) {
          prompts.log.info(`   ✓ Brand: ${theme.brandName}`)
        }
        prompts.log.info(`   ✓ Colors: ${theme.primaryColor} / ${theme.secondaryColor} / ${theme.accentColor}`)
        if (theme.source === 'custom-theme' && theme.displayName) {
          prompts.log.info(`   ✓ Custom Theme: ${theme.displayName}`)
        }
      }

      prompts.log.info("")
      prompts.log.info("   ℹ️  Note: Credentials are managed server-side by the enterprise MCP server.")
      prompts.log.info("   ℹ️  No sensitive data is stored locally.")
      prompts.log.info("")
      prompts.log.info("   📖 CLAUDE.md will be configured automatically at startup")
      prompts.log.info("   Next: Run 'snow-flow agent \"<objective>\"' to start developing")
      prompts.log.info("")

    } catch (error: any) {
      prompts.log.error("")
      prompts.log.error(`❌ Authentication failed: ${error.message}`)
      prompts.log.error("")
      process.exit(1)
    }
  }
})

/**
 * Enterprise Sync Command
 * Syncs configuration (theme, MCP server URL) from portal.
 *
 * SECURITY: Credentials are NOT stored locally. They are fetched server-side
 * by the enterprise MCP server using the JWT token.
 */
export const AuthEnterpriseSyncCommand = cmd({
  command: "enterprise-sync",
  describe: "Sync enterprise configuration from portal",
  async handler() {
    prompts.log.info("")
    prompts.log.info("🔄 Snow-Flow Enterprise Configuration Sync")
    prompts.log.info("")

    try {
      // Read existing config
      const existingConfig = readEnterpriseConfig()
      if (!existingConfig) {
        prompts.log.error("❌ No enterprise configuration found")
        prompts.log.info("")
        prompts.log.info("   Run 'snow-code auth enterprise-login' first")
        prompts.log.info("")
        process.exit(1)
      }

      // Fetch configuration info from portal (not credentials - those stay server-side)
      prompts.log.step("Fetching latest configuration...")

      const configResponse = await fetch(`${API_URL}/api/auth/enterprise/credentials`, {
        method: "GET",
        headers: { "Authorization": `Bearer ${existingConfig.token}` }
      })

      if (!configResponse.ok) {
        const error = await configResponse.json()

        // If unauthorized, token might be expired
        if (configResponse.status === 401) {
          prompts.log.error("❌ Authentication token expired")
          prompts.log.info("")
          prompts.log.info("   Run 'snow-code auth enterprise-login' to re-authenticate")
          prompts.log.info("")
          process.exit(1)
        }

        throw new Error(error.error || "Failed to fetch enterprise configuration")
      }

      const configData = await configResponse.json()

      // Extract non-sensitive configuration
      const mcpServerUrl = configData.mcpServerUrl || existingConfig.mcpServerUrl || ""
      const theme: EnterpriseTheme | undefined = configData.theme || undefined

      // SECURITY: Only update non-sensitive configuration - NO credentials stored locally
      const updatedConfig: EnterpriseConfig = {
        ...existingConfig,
        mcpServerUrl,
        theme,
        lastSynced: Date.now()
      }

      saveEnterpriseConfig(updatedConfig)

      prompts.log.success("✓ Configuration synced successfully!")
      prompts.log.info("")

      // Show available integrations (read-only info, no credentials stored)
      prompts.log.info("   Available Integrations (credentials fetched server-side):")

      // Parse credentials to show what's available (without storing them)
      const credentials = configData.credentials || {}
      if (credentials.jira?.enabled || (Array.isArray(configData.credentials) && configData.credentials.some((c: any) => c.service === 'jira'))) {
        prompts.log.info(`   ✓ Jira`)
      } else {
        prompts.log.info(`   ✗ Jira (not configured)`)
      }

      if (credentials["azure-devops"]?.enabled || (Array.isArray(configData.credentials) && configData.credentials.some((c: any) => c.service === 'azure-devops'))) {
        prompts.log.info(`   ✓ Azure DevOps`)
      } else {
        prompts.log.info(`   ✗ Azure DevOps (not configured)`)
      }

      if (credentials.confluence?.enabled || (Array.isArray(configData.credentials) && configData.credentials.some((c: any) => c.service === 'confluence'))) {
        prompts.log.info(`   ✓ Confluence`)
      } else {
        prompts.log.info(`   ✗ Confluence (not configured)`)
      }

      // Show ServiceNow instances (read-only info)
      const servicenowInstances = configData.servicenowInstances || []
      if (servicenowInstances.length > 0) {
        prompts.log.info("")
        prompts.log.info("   ServiceNow Instances:")
        for (const inst of servicenowInstances) {
          const defaultTag = inst.isDefault ? " (default)" : ""
          prompts.log.info(`   ✓ ${inst.instanceName} [${inst.environmentType}]${defaultTag}`)
        }
      } else {
        prompts.log.info(`   ✗ ServiceNow (no instances configured)`)
      }

      // Show theme info if available
      if (theme) {
        prompts.log.info("")
        prompts.log.info("   Theme:")
        if (theme.brandName) {
          prompts.log.info(`   ✓ Brand: ${theme.brandName}`)
        }
        prompts.log.info(`   ✓ Colors: ${theme.primaryColor} / ${theme.secondaryColor} / ${theme.accentColor}`)
        if (theme.source === 'custom-theme' && theme.displayName) {
          prompts.log.info(`   ✓ Custom Theme: ${theme.displayName}`)
        }
      }

      prompts.log.info("")
      prompts.log.info("   ℹ️  Note: Credentials are fetched server-side by the enterprise MCP server.")
      prompts.log.info("   ℹ️  No sensitive data is stored locally.")
      prompts.log.info("")

    } catch (error: any) {
      prompts.log.error("")
      prompts.log.error(`❌ Sync failed: ${error.message}`)
      prompts.log.error("")
      process.exit(1)
    }
  }
})

/**
 * Enterprise Status Command
 * Show current enterprise authentication status
 *
 * SECURITY: Only shows locally stored info (no credentials).
 * Credentials are fetched server-side by the enterprise MCP server.
 */
export const AuthEnterpriseStatusCommand = cmd({
  command: "enterprise-status",
  describe: "Show enterprise authentication status",
  async handler() {
    prompts.log.info("")
    prompts.log.info("📊 Snow-Flow Enterprise Status")
    prompts.log.info("")

    const config = readEnterpriseConfig()

    if (!config) {
      prompts.log.warn("⚠️  Not authenticated with Snow-Flow Enterprise")
      prompts.log.info("")
      prompts.log.info("   Run 'snow-code auth enterprise-login' to get started")
      prompts.log.info("")
      return
    }

    // Show user info for enterprise users
    if (config.authMethod === 'browser' && config.username) {
      prompts.log.info(`   User:     ${config.username}${config.email ? ` (${config.email})` : ''}`)
      prompts.log.info(`   Role:     ${config.role || 'user'}`)
      prompts.log.info("")
    }

    // Show status
    prompts.log.info(`   Customer: ${config.customerName}`)
    prompts.log.info(`   Company:  ${config.company}`)
    prompts.log.info(`   Auth:     ${config.authMethod === 'browser' ? 'Browser login' : 'License key'}`)
    prompts.log.info("")

    // Show theme info if available
    if (config.theme) {
      prompts.log.info("   Theme:")
      if (config.theme.brandName) {
        prompts.log.info(`   ✓ Brand: ${config.theme.brandName}`)
      }
      prompts.log.info(`   ✓ Colors: ${config.theme.primaryColor} / ${config.theme.secondaryColor} / ${config.theme.accentColor}`)
      if (config.theme.source === 'custom-theme' && config.theme.displayName) {
        prompts.log.info(`   ✓ Custom Theme: ${config.theme.displayName}`)
      }
      if (config.theme.whiteLabelEnabled) {
        prompts.log.info(`   ✓ White-Label: Enabled`)
      }
      prompts.log.info("")
    }

    prompts.log.info(`   MCP Server: ${config.mcpServerUrl}`)
    prompts.log.info(`   Last Synced: ${new Date(config.lastSynced).toLocaleString()}`)
    prompts.log.info("")
    prompts.log.info("   ℹ️  Note: Credentials are managed server-side by the enterprise MCP server.")
    prompts.log.info("   ℹ️  Run 'snow-code auth enterprise-sync' to check available integrations.")
    prompts.log.info("")
  }
})

/**
 * Enterprise Theme Export Command
 * Export theme configuration to CSS/JSON files for use in desktop/console apps
 */
export const AuthEnterpriseThemeExportCommand = cmd<object, { format: string; output?: string }>({
  command: "enterprise-theme-export",
  describe: "Export enterprise theme to CSS/JSON files",
  builder: {
    format: {
      type: "string",
      choices: ["css", "json", "all"] as const,
      default: "all",
      describe: "Output format"
    },
    output: {
      type: "string",
      alias: "o",
      describe: "Output directory (default: current directory)"
    }
  },
  async handler(args) {
    prompts.log.info("")
    prompts.log.info("🎨 Snow-Flow Enterprise Theme Export")
    prompts.log.info("")

    const config = readEnterpriseConfig()

    if (!config || !config.theme) {
      prompts.log.warn("⚠️  No enterprise theme configured")
      prompts.log.info("")
      prompts.log.info("   Theme is loaded after enterprise login.")
      prompts.log.info("   Run 'snow-code auth enterprise-login' to authenticate and load theme.")
      prompts.log.info("")
      return
    }

    const theme = config.theme
    const outputDir = args.output || process.cwd()

    // Import theme export utilities dynamically
    const { generateCssVariables, generateShikiTheme } = await import("../theme-export.js")

    const exportedFiles: string[] = []

    // Export CSS
    if (args.format === "css" || args.format === "all") {
      const css = generateCssVariables(theme)
      const cssPath = path.join(outputDir, "snow-flow-theme.css")
      fs.writeFileSync(cssPath, css)
      exportedFiles.push(cssPath)
    }

    // Export JSON
    if (args.format === "json" || args.format === "all") {
      const json = JSON.stringify({
        version: "1.0",
        exportedAt: new Date().toISOString(),
        source: theme.source,
        brandName: theme.brandName,
        colors: {
          primary: theme.primaryColor,
          secondary: theme.secondaryColor,
          accent: theme.accentColor
        },
        branding: {
          logoUrl: theme.logoUrl,
          faviconUrl: theme.faviconUrl,
          whiteLabelEnabled: theme.whiteLabelEnabled
        },
        support: {
          email: theme.supportEmail,
          url: theme.supportUrl,
          footerText: theme.footerText
        },
        shikiTheme: generateShikiTheme(theme)
      }, null, 2)
      const jsonPath = path.join(outputDir, "snow-flow-theme.json")
      fs.writeFileSync(jsonPath, json)
      exportedFiles.push(jsonPath)
    }

    prompts.log.success("✓ Theme exported successfully!")
    prompts.log.info("")
    prompts.log.info("   Theme Info:")
    if (theme.brandName) {
      prompts.log.info(`   Brand: ${theme.brandName}`)
    }
    prompts.log.info(`   Source: ${theme.source}`)
    prompts.log.info(`   Colors: ${theme.primaryColor} / ${theme.secondaryColor} / ${theme.accentColor}`)
    prompts.log.info("")
    prompts.log.info("   Exported Files:")
    for (const file of exportedFiles) {
      prompts.log.info(`   ✓ ${file}`)
    }
    prompts.log.info("")
    prompts.log.info("   Usage:")
    prompts.log.info("   - CSS: Import in your app's stylesheet")
    prompts.log.info("   - JSON: Load in your app's configuration")
    prompts.log.info("")
  }
})

// Export for use in main auth command
export { readEnterpriseConfig }
