import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod/v4"
import { Auth } from "../auth"
import { ModelsDev } from "../provider/models"
import { pipe, sortBy, values, map } from "remeda"
import path from "path"
import os from "os"
import crypto from "crypto"
import { ServiceNowOAuth } from "../auth/servicenow-oauth"
import open from "open"
import { detectHeadlessEnvironment } from "../util/headless"
import {
  generateEnterpriseInstructions,
  generateStakeholderDocumentation,
} from "../cli/cmd/enterprise-docs-generator"
import { AnthropicAuthProvider } from "../auth/providers/anthropic"
import { GitHubCopilotAuthProvider } from "../auth/providers/github-copilot"
import type { BuiltInAuthProvider, AuthMethod } from "../auth/providers/types"
import { MCP } from "../mcp"

// Registry of built-in auth providers with OAuth support
const AUTH_PROVIDERS: Record<string, BuiltInAuthProvider> = {
  "anthropic": AnthropicAuthProvider,
  "github-copilot": GitHubCopilotAuthProvider,
}

// State storage for OAuth flows (in-memory, keyed by session ID)
const oauthSessions: Map<string, { verifier: string; callback: (code: string) => Promise<any> }> = new Map()

// Known provider baseURLs for providers where models.dev doesn't specify one
const PROVIDER_BASE_URLS: Record<string, string> = {
  "openai": "https://api.openai.com/v1",
  "anthropic": "https://api.anthropic.com/v1",
  "google": "https://generativelanguage.googleapis.com/v1beta",
  "groq": "https://api.groq.com/openai/v1",
  "mistral": "https://api.mistral.ai/v1",
  "cohere": "https://api.cohere.ai/v1",
  "together": "https://api.together.xyz/v1",
  "fireworks": "https://api.fireworks.ai/inference/v1",
  "perplexity": "https://api.perplexity.ai",
  "deepseek": "https://api.deepseek.com/v1",
  "xai": "https://api.x.ai/v1",
  "cerebras": "https://api.cerebras.ai/v1",
  "openrouter": "https://openrouter.ai/api/v1",
}

// Provider environment variable mapping
const PROVIDER_ENV_VARS: Record<string, string> = {
  "anthropic": "ANTHROPIC_API_KEY",
  "openai": "OPENAI_API_KEY",
  "google": "GOOGLE_API_KEY",
  "google-vertex": "GOOGLE_APPLICATION_CREDENTIALS",
  "amazon-bedrock": "AWS_ACCESS_KEY_ID",
  "azure": "AZURE_OPENAI_API_KEY",
  "groq": "GROQ_API_KEY",
  "mistral": "MISTRAL_API_KEY",
  "cohere": "COHERE_API_KEY",
  "together": "TOGETHER_API_KEY",
  "fireworks": "FIREWORKS_API_KEY",
  "perplexity": "PERPLEXITY_API_KEY",
  "deepseek": "DEEPSEEK_API_KEY",
  "xai": "XAI_API_KEY",
  "cerebras": "CEREBRAS_API_KEY",
  "openrouter": "OPENROUTER_API_KEY",
  "github-copilot": "GITHUB_TOKEN",
  "vercel": "VERCEL_API_KEY",
}

// Generate machine ID for device binding
function generateMachineId(): string {
  const machineInfo = `${os.hostname()}-${os.platform()}-${os.homedir()}`
  return crypto.createHash('sha256').update(machineInfo).digest('hex')
}

// Helper to update .env file
async function updateEnvFile(updates: Array<{ key: string; value: string }>) {
  const envPath = path.join(process.cwd(), ".env")
  let envContent = ""

  try {
    envContent = await Bun.file(envPath).text()
  } catch {
    // File doesn't exist yet
  }

  for (const { key, value } of updates) {
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    if (envContent.includes(`${key}=`)) {
      envContent = envContent.replace(new RegExp(`${escapedKey}=.*`, "g"), `${key}=${value}`)
    } else {
      envContent += `\n${key}=${value}`
    }
  }

  if (!envContent.endsWith("\n")) {
    envContent += "\n"
  }

  await Bun.write(envPath, envContent)
}

// Helper to save provider config with baseURL
async function saveProviderConfig(providerId: string, providerInfo?: { api?: string }) {
  const globalConfigPath = path.join(os.homedir(), ".config", "snow-code", "config.json")
  const baseURL = providerInfo?.api || PROVIDER_BASE_URLS[providerId]

  if (!baseURL) return

  try {
    const configDir = path.join(os.homedir(), ".config", "snow-code")
    await Bun.write(path.join(configDir, ".keep"), "")

    let globalConfig: any = {}
    try {
      const file = Bun.file(globalConfigPath)
      if (await file.exists()) {
        globalConfig = JSON.parse(await file.text())
      }
    } catch {}

    globalConfig.provider = globalConfig.provider || {}
    globalConfig.provider[providerId] = {
      ...globalConfig.provider[providerId],
      options: {
        ...globalConfig.provider[providerId]?.options,
        baseURL: baseURL,
      },
    }

    await Bun.write(globalConfigPath, JSON.stringify(globalConfig, null, 2))
  } catch {
    // Silently fail
  }
}

// Get the path to ServiceNow MCP unified server
function getServiceNowUnifiedMCPPath(): string | undefined {
  const { existsSync } = require("fs")

  // Paths to check for the unified MCP server
  const possiblePaths = [
    // Global npm installation
    (() => {
      try {
        const { execSync } = require("child_process")
        const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim()
        return path.join(npmRoot, 'snow-flow', 'dist', 'mcp', 'servicenow-mcp-unified', 'index.js')
      } catch {
        return null
      }
    })(),
    // Local node_modules
    path.join(process.cwd(), 'node_modules', 'snow-flow', 'dist', 'mcp', 'servicenow-mcp-unified', 'index.js'),
    // Development - relative to this file (packages/snowcode/src/server/auth-routes.ts)
    path.resolve(__dirname, '..', '..', '..', 'core', 'dist', 'mcp', 'servicenow-mcp-unified', 'index.js'),
  ].filter(Boolean) as string[]

  for (const mcpPath of possiblePaths) {
    if (existsSync(mcpPath)) {
      return mcpPath
    }
  }

  return undefined
}

// Update MCP configs with ServiceNow credentials
async function updateSnowCodeMCPConfigs(instance: string, clientId: string, clientSecret: string) {
  const instanceUrl = instance.startsWith("http") ? instance : `https://${instance}`
  const configPaths = [
    path.join(process.cwd(), ".mcp.json"),
    path.join(os.homedir(), ".config", "snow-code", "opencode.json"),
  ]

  const updatedServers = new Set<string>()

  // Get paths to MCP servers
  const serviceNowUnifiedPath = getServiceNowUnifiedMCPPath()

  for (const configPath of configPaths) {
    try {
      const file = Bun.file(configPath)
      let config: any = {}

      if (await file.exists()) {
        config = JSON.parse(await file.text())
      }

      config.mcp = config.mcp || {}

      // CREATE servicenow-unified if not exists AND we found the path
      if (serviceNowUnifiedPath && !config.mcp["servicenow-unified"]) {
        config.mcp["servicenow-unified"] = {
          type: "local",
          command: ["node", serviceNowUnifiedPath],
          environment: {
            SERVICENOW_INSTANCE_URL: instanceUrl,
            SERVICENOW_CLIENT_ID: clientId,
            SERVICENOW_CLIENT_SECRET: clientSecret,
          },
          enabled: true,
        }
        updatedServers.add("servicenow-unified")
      }

      // UPDATE existing servers with ServiceNow credentials
      for (const serverName in config.mcp) {
        const serverConfig = config.mcp[serverName]
        if (serverConfig.environment) {
          if (serverConfig.environment.SERVICENOW_INSTANCE_URL !== undefined) {
            serverConfig.environment.SERVICENOW_INSTANCE_URL = instanceUrl
            updatedServers.add(serverName)
          }
          if (serverConfig.environment.SERVICENOW_CLIENT_ID !== undefined) {
            serverConfig.environment.SERVICENOW_CLIENT_ID = clientId
            updatedServers.add(serverName)
          }
          if (serverConfig.environment.SERVICENOW_CLIENT_SECRET !== undefined) {
            serverConfig.environment.SERVICENOW_CLIENT_SECRET = clientSecret
            updatedServers.add(serverName)
          }
        }
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
    } catch {
      // Skip failed updates
    }
  }

  // Restart any ServiceNow MCP servers that had their credentials updated
  // and reload to pick up any new servers
  if (updatedServers.size > 0) {
    // First reload to pick up newly created configs
    try {
      await MCP.reload()
    } catch {
      // Silently continue
    }

    // Then restart each server to apply new credentials
    for (const serverName of updatedServers) {
      try {
        await MCP.restart(serverName)
      } catch {
        // Silently continue - MCP module has its own logging
      }
    }
  }
}

export const AuthRoute = new Hono()
  // Get all available LLM providers from models.dev
  .get(
    "/providers",
    describeRoute({
      description: "Get list of all available LLM providers",
      operationId: "auth.providers.list",
      responses: {
        200: {
          description: "List of providers",
          content: {
            "application/json": {
              schema: resolver(z.array(z.object({
                id: z.string(),
                name: z.string(),
                description: z.string().optional(),
                authType: z.enum(["api", "oauth", "aws", "gcp"]),
                recommended: z.boolean().optional(),
                envVar: z.string().optional(),
                baseUrl: z.string().optional(),
              }))),
            },
          },
        },
      },
    }),
    async (c) => {
      await ModelsDev.refresh().catch(() => {})
      const providers = await ModelsDev.get()

      const priority: Record<string, number> = {
        anthropic: 0,
        "github-copilot": 1,
        openai: 2,
        google: 3,
        openrouter: 4,
        vercel: 5,
      }

      const providerList = pipe(
        providers,
        values(),
        sortBy(
          (x) => priority[x.id] ?? 99,
          (x) => x.name ?? x.id,
        ),
        map((x) => ({
          id: x.id,
          name: x.name || x.id,
          description: getProviderDescription(x.id),
          authType: getAuthType(x.id),
          recommended: priority[x.id] === 0,
          envVar: PROVIDER_ENV_VARS[x.id],
          baseUrl: x.api || PROVIDER_BASE_URLS[x.id],
        })),
      )

      // Add special providers
      providerList.push({
        id: "midserver-llm",
        name: "ServiceNow MID Server LLM",
        description: "Local LLM via MID Server (enterprise)",
        authType: "api" as const,
        recommended: false,
        envVar: undefined,
        baseUrl: undefined,
      })

      return c.json(providerList)
    }
  )
  // Get models for a specific provider
  .get(
    "/providers/:id/models",
    describeRoute({
      description: "Get models for a specific provider",
      operationId: "auth.providers.models",
      responses: {
        200: {
          description: "List of models",
          content: {
            "application/json": {
              schema: resolver(z.array(z.object({
                id: z.string(),
                name: z.string(),
                contextWindow: z.number().optional(),
                status: z.string().optional(),
              }))),
            },
          },
        },
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const providerId = c.req.valid("param").id
      const providers = await ModelsDev.get()
      const provider = providers[providerId]

      if (!provider || !provider.models) {
        return c.json([])
      }

      // Custom sorting for Anthropic: version-based (4.5 → 4.1 → 4 → 3.5 → 3)
      const extractAnthropicVersion = (model: any): number => {
        const match = model.id.match(/claude-(?:opus|sonnet|haiku)-(\d+)(?:\.(\d+))?/)
        if (!match) return 0
        const major = parseInt(match[1]) || 0
        const minor = parseInt(match[2]) || 0
        return major * 10 + minor
      }

      // Custom sorting for OpenAI: version-based (gpt-5 → gpt-4.1 → gpt-4o → o3 → o1)
      const extractOpenAIVersion = (model: any): number => {
        if (model.id.includes('gpt-5')) {
          if (model.id.includes('pro')) return 5100
          if (model.id.includes('codex')) return 5090
          if (model.id === 'gpt-5') return 5080
          if (model.id.includes('mini')) return 5070
          if (model.id.includes('nano')) return 5060
          return 5000
        }
        if (model.id.includes('gpt-4.1')) {
          if (model.id.includes('mini')) return 4110
          return 4120
        }
        if (model.id.includes('gpt-4o')) {
          if (model.id.includes('mini')) return 4080
          return 4100
        }
        if (model.id.includes('gpt-4')) {
          if (model.id.includes('turbo')) return 4050
          return 4040
        }
        if (model.id.includes('o4')) {
          if (model.id.includes('mini')) return 3950
          return 3960
        }
        if (model.id.includes('o3')) {
          if (model.id.includes('pro')) return 3920
          if (model.id.includes('mini')) return 3900
          if (model.id.includes('deep-research')) return 3910
          return 3915
        }
        if (model.id.includes('o1')) {
          if (model.id.includes('pro')) return 3850
          if (model.id.includes('mini')) return 3840
          if (model.id.includes('preview')) return 3845
          return 3842
        }
        if (model.id.includes('gpt-3.5')) return 3500
        if (model.id.includes('codex')) return 3000
        return parseInt((model.release_date || "0").replace(/-/g, '')) || 0
      }

      // Custom sorting for Google (Gemini): newer versions first
      const extractGeminiVersion = (model: any): number => {
        const match = model.id.match(/gemini-(\d+)(?:\.(\d+))?/)
        if (!match) {
          return parseInt((model.release_date || "0").replace(/-/g, '')) || 0
        }
        const major = parseInt(match[1]) || 0
        const minor = parseInt(match[2]) || 0
        return major * 100 + minor
      }

      const getSortKey = (provider: string) => {
        if (provider === "anthropic") return (x: any) => -extractAnthropicVersion(x)
        if (provider === "openai") return (x: any) => -extractOpenAIVersion(x)
        if (provider === "google") return (x: any) => -extractGeminiVersion(x)
        return (x: any) => -parseInt((x.release_date || "0").replace(/-/g, '') || '0')
      }

      // Filter out embedding and moderation models - only show chat/completion models
      const isCompletionModel = (model: any): boolean => {
        const id = model.id.toLowerCase()
        // Exclude embedding models
        if (id.includes('embedding') || id.includes('embed-')) return false
        // Exclude moderation models
        if (id.includes('moderation')) return false
        // Exclude whisper/audio models
        if (id.includes('whisper') || id.includes('tts')) return false
        // Exclude DALL-E
        if (id.includes('dall-e')) return false
        return true
      }

      // Custom sorting for each provider
      const models = pipe(
        provider.models,
        values(),
        (arr) => arr.filter(isCompletionModel),
        sortBy(
          (x) => (x.status === "alpha" || x.status === "beta" ? 1 : 0),
          getSortKey(providerId),
        ),
        map((model) => ({
          id: model.id,
          name: model.name,
          contextWindow: model.limit?.context,
          status: model.status,
        })),
      )

      return c.json(models)
    }
  )
  // List configured credentials
  .get(
    "/credentials",
    describeRoute({
      description: "List configured authentication credentials",
      operationId: "auth.credentials.list",
      responses: {
        200: {
          description: "List of credentials",
          content: {
            "application/json": {
              schema: resolver(z.array(z.object({
                id: z.string(),
                type: z.string(),
                configured: z.boolean(),
              }))),
            },
          },
        },
      },
    }),
    async (c) => {
      const all = await Auth.all()
      const credentials = Object.entries(all).map(([id, info]) => ({
        id,
        type: info.type,
        configured: true,
      }))
      return c.json(credentials)
    }
  )
  // Save API key for LLM provider
  .post(
    "/llm/apikey",
    describeRoute({
      description: "Save API key for LLM provider",
      operationId: "auth.llm.apikey",
      responses: {
        200: {
          description: "API key saved",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      provider: z.string(),
      apiKey: z.string(),
      model: z.string().optional(),
    })),
    async (c) => {
      const { provider, apiKey, model } = c.req.valid("json")

      // Save to Auth store
      await Auth.set(provider, {
        type: "api",
        key: apiKey,
      })

      // Update .env file
      const envVar = PROVIDER_ENV_VARS[provider] || `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`
      await updateEnvFile([{ key: envVar, value: apiKey }])

      // Save provider config with baseURL
      const providers = await ModelsDev.get()
      await saveProviderConfig(provider, providers[provider])

      // Save model preference if provided
      if (model) {
        const globalConfigPath = path.join(os.homedir(), ".config", "snow-code", "config.json")
        try {
          let globalConfig = {}
          try {
            const file = Bun.file(globalConfigPath)
            if (await file.exists()) {
              globalConfig = JSON.parse(await file.text())
            }
          } catch {}
          globalConfig = { ...globalConfig, model: `${provider}/${model}` }
          await Bun.write(globalConfigPath, JSON.stringify(globalConfig, null, 2))
        } catch {}
      }

      return c.json({ success: true })
    }
  )
  // ServiceNow OAuth authentication
  .post(
    "/servicenow/oauth",
    describeRoute({
      description: "Authenticate with ServiceNow via OAuth",
      operationId: "auth.servicenow.oauth",
      responses: {
        200: {
          description: "OAuth result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                accessToken: z.string().optional(),
                error: z.string().optional(),
                reused: z.boolean().optional(), // true if existing token was reused
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instance: z.string(),
      clientId: z.string(),
      clientSecret: z.string(),
      forceReauth: z.boolean().optional(), // When true, always do full OAuth (for /auth flow)
    })),
    async (c) => {
      const { instance, clientId, clientSecret, forceReauth } = c.req.valid("json")

      try {
        // If forceReauth is true, skip token reuse and always do full OAuth
        if (forceReauth) {
          const oauth = new ServiceNowOAuth()
          const result = await oauth.authenticate({
            instance,
            clientId,
            clientSecret,
            silent: true,
          })

          if (result.success) {
            await updateEnvFile([
              { key: "SNOW_INSTANCE", value: instance },
              { key: "SNOW_AUTH_METHOD", value: "oauth" },
              { key: "SNOW_CLIENT_ID", value: clientId },
              { key: "SNOW_CLIENT_SECRET", value: clientSecret },
            ])
            await updateSnowCodeMCPConfigs(instance, clientId, clientSecret)
            return c.json({ success: true, accessToken: result.accessToken, reused: false })
          }
          return c.json({ success: false, error: result.error })
        }

        // Otherwise, check if we already have valid ServiceNow OAuth credentials
        const existingAuth = await Auth.get("servicenow")

        if (existingAuth && existingAuth.type === "servicenow-oauth") {
          const normalizedInstance = instance.replace(/^https?:\/\//, "").replace(/\/$/, "")
          const existingInstance = existingAuth.instance?.replace(/^https?:\/\//, "").replace(/\/$/, "")

          // Check if it's for the same instance
          if (existingInstance === normalizedInstance || existingAuth.instance?.includes(normalizedInstance)) {
            // Check if token is still valid (not expired)
            if (existingAuth.accessToken && (!existingAuth.expiresAt || existingAuth.expiresAt > Date.now())) {
              // Token is valid, reuse it
              return c.json({
                success: true,
                accessToken: existingAuth.accessToken,
                reused: true
              })
            }

            // Token expired, try to refresh
            if (existingAuth.refreshToken && existingAuth.expiresAt && existingAuth.expiresAt < Date.now()) {
              const oauth = new ServiceNowOAuth()
              const instanceUrl = instance.startsWith("http") ? instance : `https://${instance}`
              const refreshResult = await oauth.refreshAccessToken(
                instanceUrl,
                existingAuth.clientId || clientId,
                existingAuth.clientSecret || clientSecret,
                existingAuth.refreshToken
              )

              if (refreshResult.success && refreshResult.accessToken) {
                // Token refreshed successfully
                return c.json({
                  success: true,
                  accessToken: refreshResult.accessToken,
                  reused: true
                })
              }
              // Refresh failed, fall through to full OAuth
            }
          }
        }

        // No valid token, do full OAuth flow
        const oauth = new ServiceNowOAuth()
        const result = await oauth.authenticate({
          instance,
          clientId,
          clientSecret,
          silent: true, // Suppress console output for TUI mode
        })

        if (result.success) {
          // Save to .env file
          await updateEnvFile([
            { key: "SNOW_INSTANCE", value: instance },
            { key: "SNOW_AUTH_METHOD", value: "oauth" },
            { key: "SNOW_CLIENT_ID", value: clientId },
            { key: "SNOW_CLIENT_SECRET", value: clientSecret },
          ])

          // Update MCP configs
          await updateSnowCodeMCPConfigs(instance, clientId, clientSecret)

          // Return the access token for MID Server LLM configuration
          return c.json({ success: true, accessToken: result.accessToken, reused: false })
        }

        return c.json({ success: false, error: result.error })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // ServiceNow basic auth
  .post(
    "/servicenow/basic",
    describeRoute({
      description: "Save ServiceNow basic auth credentials",
      operationId: "auth.servicenow.basic",
      responses: {
        200: {
          description: "Credentials saved",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instance: z.string(),
      username: z.string(),
      password: z.string(),
    })),
    async (c) => {
      const { instance, username, password } = c.req.valid("json")

      // Save to Auth store
      await Auth.set("servicenow", {
        type: "servicenow-basic",
        instance,
        username,
        password,
      })

      // Save to .env file
      await updateEnvFile([
        { key: "SNOW_INSTANCE", value: instance },
        { key: "SNOW_AUTH_METHOD", value: "basic" },
        { key: "SNOW_USERNAME", value: username },
        { key: "SNOW_PASSWORD", value: password },
      ])

      // Update MCP configs with instance only
      await updateSnowCodeMCPConfigs(instance, "", "")

      return c.json({ success: true })
    }
  )
  // ServiceNow configure from enterprise portal
  .post(
    "/servicenow/configure",
    describeRoute({
      description: "Configure ServiceNow from enterprise portal credentials",
      operationId: "auth.servicenow.configure",
      responses: {
        200: {
          description: "Configuration result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instanceUrl: z.string(),
      authMethod: z.string().default("oauth"),
      clientId: z.string(),
      clientSecret: z.string(),
      // Optional enterprise config
      enterpriseToken: z.string().optional(),
      enterpriseMcpUrl: z.string().optional(),
      // Optional enterprise services info for documentation update
      enabledServices: z.array(z.string()).optional(),
      role: z.string().optional(),
    })),
    async (c) => {
      const { instanceUrl, authMethod, clientId, clientSecret, enterpriseToken, enterpriseMcpUrl, enabledServices, role } = c.req.valid("json")

      try {
        // Clean instance URL (remove protocol and trailing slash)
        const cleanInstance = instanceUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")

        // Save to .env file
        await updateEnvFile([
          { key: "SNOW_INSTANCE", value: cleanInstance },
          { key: "SNOW_AUTH_METHOD", value: authMethod },
          { key: "SNOW_CLIENT_ID", value: clientId },
          { key: "SNOW_CLIENT_SECRET", value: clientSecret },
        ])

        // Update MCP configs
        await updateSnowCodeMCPConfigs(cleanInstance, clientId, clientSecret)

        // If enterprise token provided, also update enterprise config
        if (enterpriseToken && enterpriseMcpUrl) {
          await updateEnterpriseMcpConfig(enterpriseToken, enterpriseMcpUrl)
        }

        // Update documentation with enterprise features if services info provided
        if (enabledServices && enabledServices.length > 0) {
          try {
            await updateDocumentationWithEnterprise(enabledServices)
          } catch {}
        }

        // Handle stakeholder documentation replacement
        if (role) {
          try {
            await replaceDocumentationForStakeholder(role)
          } catch {}
        }

        return c.json({ success: true })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Configure enterprise MCP server for third-party apps (Jira, Azure DevOps, Confluence)
  .post(
    "/enterprise/configure-mcp",
    describeRoute({
      description: "Configure enterprise MCP server for third-party integrations",
      operationId: "auth.enterprise.configureMcp",
      responses: {
        200: {
          description: "Configuration result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      enterpriseToken: z.string(),
      mcpServerUrl: z.string(),
      // Optional enterprise services info for documentation update
      enabledServices: z.array(z.string()).optional(),
      role: z.string().optional(),
    })),
    async (c) => {
      const { enterpriseToken, mcpServerUrl, enabledServices, role } = c.req.valid("json")

      try {
        // Configure enterprise MCP server
        await updateEnterpriseMcpConfig(enterpriseToken, mcpServerUrl)

        // Update documentation with enterprise features if services info provided
        if (enabledServices && enabledServices.length > 0) {
          try {
            await updateDocumentationWithEnterprise(enabledServices)
          } catch {}
        }

        // Handle stakeholder documentation replacement
        if (role) {
          try {
            await replaceDocumentationForStakeholder(role)
          } catch {}
        }

        return c.json({ success: true })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Enterprise device auth - request session (code paste flow)
  .post(
    "/enterprise/device/request",
    describeRoute({
      description: "Request enterprise device authorization session",
      operationId: "auth.enterprise.device.request",
      responses: {
        200: {
          description: "Session created",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                sessionId: z.string().optional(),
                verificationUrl: z.string().optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    async (c) => {
      const portalUrl = "https://portal.snow-flow.dev"
      const machineInfo = `${os.userInfo().username}@${os.hostname()} (${os.platform()})`

      try {
        const response = await fetch(`${portalUrl}/api/auth/device/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ machineInfo }),
        })

        if (!response.ok) {
          const error = await response.json()
          return c.json({ success: false, error: error.error || "Failed to request device authorization" })
        }

        const data = await response.json()

        // Open browser with verification URL
        if (data.verificationUrl) {
          await open(data.verificationUrl)
        }

        return c.json({
          success: true,
          sessionId: data.sessionId,
          verificationUrl: data.verificationUrl,
        })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Enterprise device auth - verify code (code paste flow)
  .post(
    "/enterprise/device/verify",
    describeRoute({
      description: "Verify enterprise device authorization code",
      operationId: "auth.enterprise.device.verify",
      responses: {
        200: {
          description: "Verification result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                token: z.string().optional(),
                customer: z.any().optional(),
                user: z.any().optional(),
                role: z.string().optional(),
                enabledServices: z.array(z.string()).optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      sessionId: z.string(),
      authCode: z.string(),
    })),
    async (c) => {
      const { sessionId, authCode } = c.req.valid("json")
      const portalUrl = "https://portal.snow-flow.dev"

      try {
        // Verify the code
        const verifyResponse = await fetch(`${portalUrl}/api/auth/device/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, authCode }),
        })

        if (!verifyResponse.ok) {
          const error = await verifyResponse.json()
          return c.json({ success: false, error: error.error || "Failed to verify authorization code" })
        }

        const { token, authType, customer, user } = await verifyResponse.json()

        // Block license key admin logins
        if (authType === 'enterprise') {
          return c.json({
            success: false,
            error: "License key admin login not allowed - please use a user account"
          })
        }

        // Save enterprise auth
        const machineId = generateMachineId()
        await Auth.set("enterprise", {
          type: "enterprise",
          enterpriseUrl: portalUrl,
          token,
          machineId,
        })

        // Get user role
        const role = user?.role || customer?.role || 'developer'

        // Update enterprise MCP config
        const mcpServerUrl = "https://enterprise.snow-flow.dev"
        try {
          await updateEnterpriseMcpConfig(token, mcpServerUrl)
        } catch {}

        // Fetch third-party credentials
        const { enabledServices } = await fetchThirdPartyCredentials(token)

        // For stakeholders, replace docs with read-only version
        try {
          await replaceDocumentationForStakeholder(role)
        } catch {}

        // Update documentation with enterprise features
        if (enabledServices.length > 0) {
          try {
            await updateDocumentationWithEnterprise(enabledServices)
          } catch {}
        }

        // Save enterprise config locally
        const enterpriseConfigDir = path.join(os.homedir(), ".snow-code")
        const enterpriseConfigFile = path.join(enterpriseConfigDir, "enterprise.json")
        try {
          await Bun.write(path.join(enterpriseConfigDir, ".keep"), "")
          await Bun.write(enterpriseConfigFile, JSON.stringify({
            token,
            customerId: customer?.id,
            customerName: customer?.name,
            company: customer?.company,
            mcpServerUrl,
            lastSynced: Date.now()
          }, null, 2))
        } catch {}

        return c.json({
          success: true,
          token,
          customer,
          user,
          role,
          enabledServices,
        })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Enterprise browser auth - start device authorization
  .post(
    "/enterprise/device-auth",
    describeRoute({
      description: "Start enterprise device authorization flow",
      operationId: "auth.enterprise.device",
      responses: {
        200: {
          description: "Device auth started",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                deviceCode: z.string().optional(),
                verificationUrl: z.string().optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    async (c) => {
      const machineId = generateMachineId()
      const portalUrl = "https://portal.snow-flow.dev"

      try {
        // Request device code
        const response = await fetch(`${portalUrl}/api/device-auth/code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ machineId }),
        })

        if (!response.ok) {
          return c.json({ success: false, error: "Failed to get device code" })
        }

        const data = await response.json()

        // Open browser with verification URL
        if (data.verificationUrl) {
          await open(data.verificationUrl)
        }

        return c.json({
          success: true,
          deviceCode: data.deviceCode,
          verificationUrl: data.verificationUrl,
        })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Poll for enterprise device auth completion
  .post(
    "/enterprise/device-auth/poll",
    describeRoute({
      description: "Poll for device authorization completion",
      operationId: "auth.enterprise.device.poll",
      responses: {
        200: {
          description: "Poll result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                pending: z.boolean().optional(),
                token: z.string().optional(),
                customer: z.any().optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      deviceCode: z.string(),
    })),
    async (c) => {
      const { deviceCode } = c.req.valid("json")
      const portalUrl = "https://portal.snow-flow.dev"

      try {
        const response = await fetch(`${portalUrl}/api/device-auth/poll`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode }),
        })

        if (!response.ok) {
          const data = await response.json()
          if (data.error === "authorization_pending") {
            return c.json({ success: true, pending: true })
          }
          return c.json({ success: false, error: data.error || "Poll failed" })
        }

        const data = await response.json()

        if (data.success && data.token) {
          // Save enterprise auth
          const machineId = generateMachineId()
          await Auth.set("enterprise", {
            type: "enterprise",
            enterpriseUrl: portalUrl,
            token: data.token,
            machineId,
          })

          // Update enterprise MCP config
          const mcpServerUrl = data.mcpServerUrl || "https://enterprise.snow-flow.dev"
          try {
            await updateEnterpriseMcpConfig(data.token, mcpServerUrl)
          } catch {}

          // Get user role from response (stakeholder, developer, admin, owner)
          const role = data.customer?.role || data.role || 'developer'

          // Fetch third-party credentials (Jira, Azure DevOps, Confluence)
          const { enabledServices } = await fetchThirdPartyCredentials(data.token)

          // For stakeholders, replace docs with read-only version
          try {
            await replaceDocumentationForStakeholder(role)
          } catch {}

          // Update documentation with enterprise features based on enabled integrations
          if (enabledServices.length > 0) {
            try {
              await updateDocumentationWithEnterprise(enabledServices)
            } catch {}
          }

          return c.json({
            success: true,
            pending: false,
            token: data.token,
            customer: data.customer,
            role,
            enabledServices,
          })
        }

        return c.json({ success: true, pending: true })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Portal auth (Individual/Teams) - open browser
  .post(
    "/portal/browser-auth",
    describeRoute({
      description: "Start portal browser authentication",
      operationId: "auth.portal.browser",
      responses: {
        200: {
          description: "Browser auth started",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
      },
    }),
    async (c) => {
      const portalUrl = "https://portal.snow-flow.dev"
      const machineId = generateMachineId()

      // Open browser with auth URL
      await open(`${portalUrl}/auth/cli?machine=${machineId}`)

      return c.json({ success: true })
    }
  )
  // Remove credential
  .delete(
    "/:id",
    describeRoute({
      description: "Remove authentication credential",
      operationId: "auth.remove",
      responses: {
        200: {
          description: "Credential removed",
          content: {
            "application/json": {
              schema: resolver(z.object({ success: z.boolean() })),
            },
          },
        },
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param")
      await Auth.remove(id)
      return c.json({ success: true })
    }
  )
  // Get available auth methods for a provider (OAuth options)
  .get(
    "/providers/:id/methods",
    describeRoute({
      description: "Get available authentication methods for a provider",
      operationId: "auth.providers.methods",
      responses: {
        200: {
          description: "List of auth methods",
          content: {
            "application/json": {
              schema: resolver(z.array(z.object({
                label: z.string(),
                type: z.enum(["oauth", "api"]),
                method: z.enum(["code", "auto", "api"]).optional(),
              }))),
            },
          },
        },
      },
    }),
    validator("param", z.object({ id: z.string() })),
    async (c) => {
      const { id } = c.req.valid("param")

      // Check if provider has built-in OAuth support
      const authProvider = AUTH_PROVIDERS[id]
      if (authProvider && authProvider.methods) {
        const methods = authProvider.methods.map((m: AuthMethod) => ({
          label: m.label,
          type: m.type,
          method: m.type === "api" ? "api" : undefined,
        }))
        return c.json(methods)
      }

      // Default: only API key method
      return c.json([{
        label: "Enter API Key",
        type: "api",
        method: "api",
      }])
    }
  )
  // Start OAuth authorization flow
  .post(
    "/oauth/authorize",
    describeRoute({
      description: "Start OAuth authorization flow for a provider",
      operationId: "auth.oauth.authorize",
      responses: {
        200: {
          description: "Authorization started",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                sessionId: z.string().optional(),
                url: z.string().optional(),
                instructions: z.string().optional(),
                method: z.enum(["code", "auto"]).optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      provider: z.string(),
      methodIndex: z.number(),
    })),
    async (c) => {
      const { provider, methodIndex } = c.req.valid("json")

      const authProvider = AUTH_PROVIDERS[provider]
      if (!authProvider || !authProvider.methods) {
        return c.json({ success: false, error: "Provider does not support OAuth" })
      }

      const method = authProvider.methods[methodIndex]
      if (!method || method.type !== "oauth") {
        return c.json({ success: false, error: "Invalid auth method" })
      }

      try {
        const authResult = await method.authorize()
        const sessionId = crypto.randomUUID()

        // Store callback for later use
        if (authResult.method === "code") {
          oauthSessions.set(sessionId, {
            verifier: "",
            callback: authResult.callback,
          })
        } else if (authResult.method === "auto") {
          // For auto method, start polling in background
          oauthSessions.set(sessionId, {
            verifier: "",
            callback: authResult.callback,
          })
        }

        // Check for headless environment
        const headlessEnv = detectHeadlessEnvironment()

        // Only auto-open browser if not in headless environment
        if (authResult.url && !headlessEnv.isHeadless) {
          try {
            await open(authResult.url)
          } catch {
            // Ignore browser open errors
          }
        }

        return c.json({
          success: true,
          sessionId,
          url: authResult.url,
          instructions: authResult.instructions,
          method: authResult.method,
          headless: headlessEnv.isHeadless,
          headlessReason: headlessEnv.isHeadless ? headlessEnv.reason : undefined,
        })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Exchange OAuth code for tokens
  .post(
    "/oauth/exchange",
    describeRoute({
      description: "Exchange OAuth authorization code for tokens",
      operationId: "auth.oauth.exchange",
      responses: {
        200: {
          description: "Exchange result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      provider: z.string(),
      sessionId: z.string(),
      code: z.string(),
    })),
    async (c) => {
      const { provider, sessionId, code } = c.req.valid("json")

      const session = oauthSessions.get(sessionId)
      if (!session) {
        return c.json({ success: false, error: "Session not found or expired" })
      }

      try {
        const result = await session.callback(code)
        oauthSessions.delete(sessionId)

        if (result.type === "failed") {
          return c.json({ success: false, error: "Authorization failed" })
        }

        // Save credentials
        if ("refresh" in result) {
          await Auth.set(provider, {
            type: "oauth",
            refresh: result.refresh,
            access: result.access,
            expires: result.expires,
          })
        } else if ("key" in result) {
          await Auth.set(provider, {
            type: "api",
            key: result.key,
          })
          // Also update .env file
          const envVar = PROVIDER_ENV_VARS[provider] || `${provider.toUpperCase().replace(/-/g, "_")}_API_KEY`
          await updateEnvFile([{ key: envVar, value: result.key }])
        }

        // Save provider config with baseURL
        const providers = await ModelsDev.get()
        await saveProviderConfig(provider, providers[provider])

        return c.json({ success: true })
      } catch (error: any) {
        oauthSessions.delete(sessionId)
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Poll for auto OAuth completion (GitHub Copilot style)
  .post(
    "/oauth/poll",
    describeRoute({
      description: "Poll for OAuth completion (auto method)",
      operationId: "auth.oauth.poll",
      responses: {
        200: {
          description: "Poll result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                complete: z.boolean(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      provider: z.string(),
      sessionId: z.string(),
    })),
    async (c) => {
      const { provider, sessionId } = c.req.valid("json")

      const session = oauthSessions.get(sessionId)
      if (!session) {
        return c.json({ success: false, complete: false, error: "Session not found or expired" })
      }

      try {
        // For auto method, the callback does the polling internally
        const result = await session.callback("")

        if (result.type === "failed") {
          oauthSessions.delete(sessionId)
          return c.json({ success: false, complete: true, error: "Authorization failed or cancelled" })
        }

        if (result.type === "success") {
          oauthSessions.delete(sessionId)

          // Save credentials
          if ("refresh" in result) {
            await Auth.set(provider, {
              type: "oauth",
              refresh: result.refresh,
              access: result.access,
              expires: result.expires,
            })
          } else if ("key" in result) {
            await Auth.set(provider, {
              type: "api",
              key: result.key,
            })
          }

          // Save provider config with baseURL
          const providers = await ModelsDev.get()
          await saveProviderConfig(provider, providers[provider])

          return c.json({ success: true, complete: true })
        }

        // Still pending
        return c.json({ success: true, complete: false })
      } catch (error: any) {
        return c.json({ success: false, complete: false, error: error.message })
      }
    }
  )
  // =====================================================
  // MID Server LLM Configuration Endpoints
  // =====================================================

  // Discover available MID Servers
  .post(
    "/midserver/discover",
    describeRoute({
      description: "Discover available MID Servers on the ServiceNow instance",
      operationId: "auth.midserver.discover",
      responses: {
        200: {
          description: "List of MID Servers",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                midServers: z.array(z.object({
                  name: z.string(),
                  sys_id: z.string(),
                  status: z.string(),
                  validated: z.boolean(),
                })).optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instanceUrl: z.string(),
      accessToken: z.string(),
    })),
    async (c) => {
      const { instanceUrl, accessToken } = c.req.valid("json")

      const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      }

      try {
        // First try the Snow-Flow LLM API (if deployed)
        try {
          const snowFlowResponse = await fetch(`${instanceUrl}/api/snow_flow/llm/mid-servers`, { headers })
          if (snowFlowResponse.ok) {
            const data = await snowFlowResponse.json()
            return c.json({ success: true, midServers: data.result?.mid_servers || [] })
          }
        } catch {
          // Snow-Flow API not available - fall through to fallback
        }

        // Fallback: Query ecc_agent table directly
        const response = await fetch(
          `${instanceUrl}/api/now/table/ecc_agent?sysparm_query=status=Up&sysparm_fields=name,sys_id,status,validated&sysparm_limit=50`,
          { headers }
        )

        if (!response.ok) {
          return c.json({ success: false, error: `HTTP ${response.status}` })
        }

        const data = await response.json()
        const midServers = (data.result || []).map((agent: any) => ({
          name: agent.name,
          sys_id: agent.sys_id,
          status: agent.status,
          validated: agent.validated === "true" || agent.validated === true,
        }))

        return c.json({ success: true, midServers })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Discover REST Messages configured for LLM
  .post(
    "/midserver/rest-messages",
    describeRoute({
      description: "Discover REST Messages available for MID Server LLM integration",
      operationId: "auth.midserver.restmessages",
      responses: {
        200: {
          description: "List of REST Messages",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                restMessages: z.array(z.object({
                  name: z.string(),
                  sys_id: z.string(),
                  endpoint: z.string(),
                  mid_server: z.string().optional(),
                  methods: z.array(z.object({
                    name: z.string(),
                    http_method: z.string(),
                    sys_id: z.string(),
                  })),
                })).optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instanceUrl: z.string(),
      accessToken: z.string(),
    })),
    async (c) => {
      const { instanceUrl, accessToken } = c.req.valid("json")

      const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      }

      try {
        // First try the Snow-Flow LLM API (if deployed)
        try {
          const snowFlowResponse = await fetch(`${instanceUrl}/api/snow_flow/llm/rest-messages`, { headers })
          if (snowFlowResponse.ok) {
            const data = await snowFlowResponse.json()
            return c.json({ success: true, restMessages: data.result?.rest_messages || [] })
          }
        } catch {
          // Snow-Flow API not available - fall through to fallback
        }

        // Fallback: Query sys_rest_message table directly
        const response = await fetch(
          `${instanceUrl}/api/now/table/sys_rest_message?sysparm_fields=name,sys_id,rest_endpoint&sysparm_display_value=true&sysparm_limit=50`,
          { headers }
        )

        if (!response.ok) {
          return c.json({ success: false, error: `HTTP ${response.status}` })
        }

        const data = await response.json()
        const restMessages: Array<{
          name: string
          sys_id: string
          endpoint: string
          mid_server?: string
          methods: Array<{ name: string; http_method: string; sys_id: string }>
        }> = []

        // For each REST Message, get its HTTP methods
        for (const msg of data.result || []) {
          const methodsResponse = await fetch(
            `${instanceUrl}/api/now/table/sys_rest_message_fn?sysparm_query=rest_message=${msg.sys_id}&sysparm_fields=function_name,http_method,sys_id&sysparm_limit=20`,
            { headers }
          )

          let methods: Array<{ name: string; http_method: string; sys_id: string }> = []
          if (methodsResponse.ok) {
            const methodsData = await methodsResponse.json()
            methods = (methodsData.result || []).map((m: any) => ({
              name: m.function_name,
              http_method: m.http_method,
              sys_id: m.sys_id,
            }))
          }

          restMessages.push({
            name: msg.name,
            sys_id: msg.sys_id,
            endpoint: msg.rest_endpoint || "",
            mid_server: msg.mid_server || "",
            methods,
          })
        }

        return c.json({ success: true, restMessages })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Discover available models from LLM endpoint via MID Server
  .post(
    "/midserver/models",
    describeRoute({
      description: "Discover available models from LLM endpoint via MID Server",
      operationId: "auth.midserver.models",
      responses: {
        200: {
          description: "List of models",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                models: z.array(z.object({
                  id: z.string(),
                  name: z.string().optional(),
                  contextWindow: z.number().optional(),
                  maxTokens: z.number().optional(),
                })).optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instanceUrl: z.string(),
      accessToken: z.string(),
      restMessage: z.string(),
    })),
    async (c) => {
      const { instanceUrl, accessToken, restMessage } = c.req.valid("json")

      const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Accept": "application/json",
      }

      try {
        const response = await fetch(
          `${instanceUrl}/api/snow_flow/llm/models?rest_message=${encodeURIComponent(restMessage)}`,
          { headers }
        )

        if (!response.ok) {
          return c.json({ success: false, error: `HTTP ${response.status}` })
        }

        const data = await response.json()
        const models = (data.result?.models || []).map((m: any) => {
          // Extract context window from various possible field names
          const contextWindow = m.max_model_len || m.context_length || m.max_input_length || m.context_window || undefined

          return {
            id: m.id || m,
            name: m.name || m.id || m,
            contextWindow: contextWindow ? Number(contextWindow) : undefined,
            maxTokens: contextWindow ? Math.min(4096, Math.floor(Number(contextWindow) / 4)) : undefined,
          }
        })

        return c.json({ success: true, models })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Deploy Snow-Flow LLM API to ServiceNow
  .post(
    "/midserver/deploy-api",
    describeRoute({
      description: "Deploy Snow-Flow LLM API to ServiceNow instance",
      operationId: "auth.midserver.deploy",
      responses: {
        200: {
          description: "Deployment result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                namespace: z.string().optional(),
                baseUri: z.string().optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instanceUrl: z.string(),
      accessToken: z.string(),
      restMessage: z.string().optional(),
      httpMethod: z.string().optional(),
      defaultModel: z.string().optional(),
    })),
    async (c) => {
      const { instanceUrl, accessToken, restMessage, httpMethod, defaultModel } = c.req.valid("json")

      const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      }

      try {
        // Step 1: Create Script Include - SnowFlowLLMService
        const scriptIncludeScript = `var SnowFlowLLMService = Class.create();
SnowFlowLLMService.prototype = {
    initialize: function() {},

    chat: function(message, maxTokens, restMessageName, httpMethodName, modelName) {
        var result = { success: false, response: '', error: '' };
        try {
            var r = new sn_ws.RESTMessageV2(restMessageName, httpMethodName);
            var requestBody = JSON.stringify({
                model: modelName || gs.getProperty('snow_flow.llm.default_model', 'default'),
                messages: [{ role: 'user', content: message }],
                max_tokens: maxTokens || 100
            });
            r.setRequestBody(requestBody);

            var response = r.execute();
            var httpStatus = response.getStatusCode();
            var body = response.getBody();

            if (httpStatus == 200) {
                var parsed = JSON.parse(body);
                result.success = true;
                if (parsed.choices && parsed.choices.length > 0) {
                    result.response = parsed.choices[0].message.content;
                } else {
                    result.response = body;
                }
                result.model = parsed.model;
                result.usage = parsed.usage;
            } else {
                result.error = 'HTTP ' + httpStatus + ': ' + body;
            }
        } catch (ex) {
            result.error = ex.getMessage();
        }
        return result;
    },

    chatOpenAI: function(messages, maxTokens, restMessageName, httpMethodName, modelName) {
        var result = { success: false, response: '', error: '' };
        try {
            var r = new sn_ws.RESTMessageV2(restMessageName, httpMethodName);
            var requestBody = JSON.stringify({
                model: modelName || gs.getProperty('snow_flow.llm.default_model', 'default'),
                messages: messages,
                max_tokens: maxTokens || 100
            });
            r.setRequestBody(requestBody);

            var response = r.execute();
            var httpStatus = response.getStatusCode();
            var body = response.getBody();

            if (httpStatus == 200) {
                var parsed = JSON.parse(body);
                result.success = true;
                if (parsed.choices && parsed.choices.length > 0) {
                    result.response = parsed.choices[0].message.content;
                } else {
                    result.response = body;
                }
                result.model = parsed.model;
                result.usage = parsed.usage;
            } else {
                result.error = 'HTTP ' + httpStatus + ': ' + body;
            }
        } catch (ex) {
            result.error = ex.getMessage();
        }
        return result;
    },

    getMidServers: function() {
        var servers = [];
        var gr = new GlideRecord('ecc_agent');
        gr.addQuery('status', 'Up');
        gr.query();
        while (gr.next()) {
            servers.push({
                name: gr.getValue('name'),
                sys_id: gr.getValue('sys_id'),
                status: gr.getValue('status'),
                validated: gr.getValue('validated') == 'true'
            });
        }
        return servers;
    },

    getRestMessages: function() {
        var messages = [];
        var gr = new GlideRecord('sys_rest_message');
        gr.query();
        while (gr.next()) {
            var methods = [];
            var methodGr = new GlideRecord('sys_rest_message_fn');
            methodGr.addQuery('rest_message', gr.getValue('sys_id'));
            methodGr.query();
            while (methodGr.next()) {
                methods.push({
                    name: methodGr.getValue('function_name'),
                    http_method: methodGr.getValue('http_method'),
                    sys_id: methodGr.getValue('sys_id')
                });
            }
            messages.push({
                name: gr.getValue('name'),
                sys_id: gr.getValue('sys_id'),
                endpoint: gr.getValue('rest_endpoint') || '',
                methods: methods
            });
        }
        return messages;
    },

    getModels: function(restMessageName) {
        var result = { success: false, models: [], error: '' };
        try {
            var r = new sn_ws.RESTMessageV2(restMessageName, 'Get_Models');
            var response = r.execute();
            var httpStatus = response.getStatusCode();
            var body = response.getBody();

            if (httpStatus == 200) {
                var parsed = JSON.parse(body);
                result.success = true;
                result.models = parsed.data || [];
            } else {
                result.error = 'HTTP ' + httpStatus;
            }
        } catch (ex) {
            result.error = ex.getMessage();
        }
        return result;
    },

    type: 'SnowFlowLLMService'
};`

        // Check if Script Include exists
        const siCheckResponse = await fetch(
          `${instanceUrl}/api/now/table/sys_script_include?sysparm_query=name=SnowFlowLLMService&sysparm_limit=1`,
          { headers }
        )
        const siCheckData = await siCheckResponse.json()

        if (siCheckData.result && siCheckData.result.length > 0) {
          // Update existing Script Include
          const updateResponse = await fetch(
            `${instanceUrl}/api/now/table/sys_script_include/${siCheckData.result[0].sys_id}`,
            {
              method: "PATCH",
              headers,
              body: JSON.stringify({ script: scriptIncludeScript }),
            }
          )
          if (!updateResponse.ok) {
            const errorBody = await updateResponse.text()
            return c.json({ success: false, error: `Failed to update Script Include: HTTP ${updateResponse.status} - ${errorBody}` })
          }
        } else {
          // Create new Script Include
          const createResponse = await fetch(
            `${instanceUrl}/api/now/table/sys_script_include`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: "SnowFlowLLMService",
                api_name: "global.SnowFlowLLMService",
                script: scriptIncludeScript,
                active: true,
                client_callable: false,
                description: "Snow-Flow LLM Service for MID Server LLM integration",
              }),
            }
          )
          if (!createResponse.ok) {
            const errorBody = await createResponse.text()
            return c.json({ success: false, error: `Failed to create Script Include: HTTP ${createResponse.status} - ${errorBody}` })
          }
        }

        // Step 2: Create Scripted REST API
        const restCheckResponse = await fetch(
          `${instanceUrl}/api/now/table/sys_ws_definition?sysparm_query=service_id=snow_flow&sysparm_fields=sys_id,namespace,base_uri&sysparm_limit=1`,
          { headers }
        )
        const restCheckData = await restCheckResponse.json()

        let restApiSysId: string
        let apiNamespace: string = ""
        let apiBaseUri: string = ""

        if (restCheckData.result && restCheckData.result.length > 0) {
          restApiSysId = restCheckData.result[0].sys_id
          apiNamespace = restCheckData.result[0].namespace || ""
          apiBaseUri = restCheckData.result[0].base_uri || ""
        } else {
          // Create REST API Definition
          const restApiResponse = await fetch(
            `${instanceUrl}/api/now/table/sys_ws_definition`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: "Snow-Flow LLM",
                service_id: "snow_flow",
                short_description: "Snow-Flow LLM API for MID Server integration",
                active: true,
              }),
            }
          )
          if (!restApiResponse.ok) {
            const errorBody = await restApiResponse.text()
            return c.json({ success: false, error: `Failed to create REST API: HTTP ${restApiResponse.status} - ${errorBody}` })
          }
          const restApiData = await restApiResponse.json()
          restApiSysId = restApiData.result.sys_id

          // Re-fetch to get the generated namespace
          const refetchResponse = await fetch(
            `${instanceUrl}/api/now/table/sys_ws_definition/${restApiSysId}?sysparm_fields=namespace,base_uri`,
            { headers }
          )
          if (refetchResponse.ok) {
            const refetchData = await refetchResponse.json()
            apiNamespace = refetchData.result?.namespace || ""
            apiBaseUri = refetchData.result?.base_uri || ""
          }
        }

        // Step 3: Create REST Resources
        const resources = [
          {
            name: "MID Servers",
            relative_path: "/llm/mid-servers",
            http_method: "GET",
            operation_script: `(function process(request, response) {
    var service = new SnowFlowLLMService();
    var servers = service.getMidServers();
    response.setStatus(200);
    return { mid_servers: servers };
})(request, response);`,
          },
          {
            name: "REST Messages",
            relative_path: "/llm/rest-messages",
            http_method: "GET",
            operation_script: `(function process(request, response) {
    var service = new SnowFlowLLMService();
    var messages = service.getRestMessages();
    response.setStatus(200);
    return { rest_messages: messages };
})(request, response);`,
          },
          {
            name: "Chat",
            relative_path: "/llm/chat",
            http_method: "POST",
            operation_script: `(function process(request, response) {
    var body = request.body.data;
    var message = body.message;
    var maxTokens = body.max_tokens || 100;
    var restMessage = body.rest_message;
    var httpMethod = body.http_method || 'Chat_Completions';
    var model = body.model;

    var service = new SnowFlowLLMService();
    var result = service.chat(message, maxTokens, restMessage, httpMethod, model);

    response.setStatus(result.success ? 200 : 500);
    return result;
})(request, response);`,
          },
          {
            name: "Models",
            relative_path: "/llm/models",
            http_method: "GET",
            operation_script: `(function process(request, response) {
    var restMessage = request.queryParams.rest_message;
    if (!restMessage) {
        response.setStatus(400);
        return { error: 'rest_message parameter required' };
    }
    var service = new SnowFlowLLMService();
    var result = service.getModels(restMessage);
    response.setStatus(result.success ? 200 : 500);
    return result;
})(request, response);`,
          },
        ]

        for (const resource of resources) {
          // Check if resource exists
          const resourceCheckResponse = await fetch(
            `${instanceUrl}/api/now/table/sys_ws_operation?sysparm_query=web_service_definition=${restApiSysId}^relative_path=${encodeURIComponent(resource.relative_path)}&sysparm_limit=1`,
            { headers }
          )
          const resourceCheckData = await resourceCheckResponse.json()

          if (resourceCheckData.result && resourceCheckData.result.length > 0) {
            // Update existing resource
            await fetch(
              `${instanceUrl}/api/now/table/sys_ws_operation/${resourceCheckData.result[0].sys_id}`,
              {
                method: "PATCH",
                headers,
                body: JSON.stringify({ operation_script: resource.operation_script }),
              }
            )
          } else {
            // Create new resource
            await fetch(
              `${instanceUrl}/api/now/table/sys_ws_operation`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  name: resource.name,
                  web_service_definition: restApiSysId,
                  relative_path: resource.relative_path,
                  http_method: resource.http_method,
                  operation_script: resource.operation_script,
                  active: true,
                }),
              }
            )
          }
        }

        // Step 4: Set system properties if REST Message and model are provided
        if (restMessage) {
          await fetch(
            `${instanceUrl}/api/now/table/sys_properties`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: "snow_flow.llm.rest_message",
                value: restMessage,
                description: "Default REST Message for Snow-Flow LLM integration",
                type: "string",
              }),
            }
          ).catch(() => {})
        }

        if (httpMethod) {
          await fetch(
            `${instanceUrl}/api/now/table/sys_properties`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: "snow_flow.llm.http_method",
                value: httpMethod,
                description: "Default HTTP Method for Snow-Flow LLM integration",
                type: "string",
              }),
            }
          ).catch(() => {})
        }

        if (defaultModel) {
          await fetch(
            `${instanceUrl}/api/now/table/sys_properties`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                name: "snow_flow.llm.default_model",
                value: defaultModel,
                description: "Default model for Snow-Flow LLM integration",
                type: "string",
              }),
            }
          ).catch(() => {})
        }

        return c.json({
          success: true,
          namespace: apiNamespace,
          baseUri: apiBaseUri,
        })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Test MID Server LLM connectivity
  .post(
    "/midserver/test",
    describeRoute({
      description: "Test MID Server LLM connectivity",
      operationId: "auth.midserver.test",
      responses: {
        200: {
          description: "Test result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                response: z.string().optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      instanceUrl: z.string(),
      accessToken: z.string(),
      restMessage: z.string(),
      httpMethod: z.string(),
      model: z.string().optional(),
      apiBaseUri: z.string().optional(),
    })),
    async (c) => {
      const { instanceUrl, accessToken, restMessage, httpMethod, model, apiBaseUri } = c.req.valid("json")

      // apiBaseUri is like "/api/1304151/snow_flow", add "/llm" for resource path
      const baseUri = apiBaseUri ? `${apiBaseUri}/llm` : "/api/snow_flow/llm"

      const headers = {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      }

      try {
        const response = await fetch(`${instanceUrl}${baseUri}/chat`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            message: 'Say "Hello from MID Server LLM!" in exactly those words.',
            max_tokens: 50,
            rest_message: restMessage,
            http_method: httpMethod,
            model: model,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          return c.json({ success: false, error: errorData.error?.message || `HTTP ${response.status}` })
        }

        const data = await response.json()

        if (data.result?.success) {
          return c.json({ success: true, response: data.result.response })
        } else {
          return c.json({ success: false, error: data.result?.error || "Unknown error" })
        }
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Portal Email/Password login
  .post(
    "/portal/login",
    describeRoute({
      description: "Authenticate with Snow-Flow Portal via email/password",
      operationId: "auth.portal.login",
      responses: {
        200: {
          description: "Login result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                token: z.string().optional(),
                user: z.any().optional(),
                organization: z.any().optional(),
                enabledServices: z.array(z.string()).optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      email: z.string().email(),
      password: z.string().min(1),
    })),
    async (c) => {
      const { email, password } = c.req.valid("json")
      const portalUrl = "https://portal.snow-flow.dev"

      try {
        const response = await fetch(`${portalUrl}/api/portal/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        })

        if (!response.ok) {
          const error = await response.json()
          return c.json({ success: false, error: error.error || "Authentication failed" })
        }

        const data = await response.json()

        // Save to Auth store
        const machineId = generateMachineId()
        await Auth.set("portal", {
          type: "portal",
          token: data.token,
          userId: data.user?.id,
          email: data.user?.email,
          name: data.user?.name,
          plan: data.user?.plan || "individual",
          organizationId: data.organization?.id,
          organizationName: data.organization?.name,
          role: data.user?.role,
          machineId,
        })

        // Fetch third-party credentials
        const { enabledServices } = await fetchThirdPartyCredentials(data.token)

        // Update documentation
        if (enabledServices.length > 0) {
          try {
            await updateDocumentationWithEnterprise(enabledServices)
          } catch {}
        }

        // Update enterprise MCP config with token
        if (data.mcpServerUrl) {
          try {
            await updateEnterpriseMcpConfig(data.token, data.mcpServerUrl)
          } catch {}
        }

        return c.json({
          success: true,
          token: data.token,
          user: data.user,
          organization: data.organization,
          enabledServices,
        })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Portal Magic Link - Request
  .post(
    "/portal/magic-link/request",
    describeRoute({
      description: "Request magic link for passwordless authentication",
      operationId: "auth.portal.magiclink.request",
      responses: {
        200: {
          description: "Request result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                message: z.string().optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      email: z.string().email(),
    })),
    async (c) => {
      const { email } = c.req.valid("json")
      const portalUrl = "https://portal.snow-flow.dev"

      try {
        const response = await fetch(`${portalUrl}/api/portal/auth/magic-link/request`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        })

        if (!response.ok) {
          const error = await response.json()
          return c.json({ success: false, error: error.error || "Failed to send magic link" })
        }

        return c.json({ success: true, message: "Magic link sent! Check your email." })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Portal Magic Link - Verify
  .post(
    "/portal/magic-link/verify",
    describeRoute({
      description: "Verify magic link code",
      operationId: "auth.portal.magiclink.verify",
      responses: {
        200: {
          description: "Verification result",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                token: z.string().optional(),
                user: z.any().optional(),
                organization: z.any().optional(),
                enabledServices: z.array(z.string()).optional(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      code: z.string().min(1),
    })),
    async (c) => {
      const { code } = c.req.valid("json")
      const portalUrl = "https://portal.snow-flow.dev"

      try {
        const response = await fetch(`${portalUrl}/api/portal/auth/magic-link/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: code }),
        })

        if (!response.ok) {
          const error = await response.json()
          return c.json({ success: false, error: error.error || "Invalid or expired code" })
        }

        const data = await response.json()

        // Save to Auth store
        const machineId = generateMachineId()
        await Auth.set("portal", {
          type: "portal",
          token: data.token,
          userId: data.user?.id,
          email: data.user?.email,
          name: data.user?.name,
          plan: data.user?.plan || "individual",
          organizationId: data.organization?.id,
          organizationName: data.organization?.name,
          role: data.user?.role,
          machineId,
        })

        // Fetch third-party credentials
        const { enabledServices } = await fetchThirdPartyCredentials(data.token)

        // Update documentation
        if (enabledServices.length > 0) {
          try {
            await updateDocumentationWithEnterprise(enabledServices)
          } catch {}
        }

        // Update enterprise MCP config with token
        if (data.mcpServerUrl) {
          try {
            await updateEnterpriseMcpConfig(data.token, data.mcpServerUrl)
          } catch {}
        }

        return c.json({
          success: true,
          token: data.token,
          user: data.user,
          organization: data.organization,
          enabledServices,
        })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )
  // Save model preference after OAuth (no API key needed)
  .post(
    "/oauth/save-model",
    describeRoute({
      description: "Save model preference after OAuth authentication",
      operationId: "auth.oauth.saveModel",
      responses: {
        200: {
          description: "Model saved",
          content: {
            "application/json": {
              schema: resolver(z.object({
                success: z.boolean(),
                error: z.string().optional(),
              })),
            },
          },
        },
      },
    }),
    validator("json", z.object({
      provider: z.string(),
      model: z.string(),
    })),
    async (c) => {
      const { provider, model } = c.req.valid("json")

      try {
        // Save model preference to global config
        const globalConfigPath = path.join(os.homedir(), ".config", "snow-code", "config.json")

        let globalConfig: any = {}
        try {
          const file = Bun.file(globalConfigPath)
          if (await file.exists()) {
            globalConfig = JSON.parse(await file.text())
          }
        } catch {}

        // Save the model preference
        globalConfig.model = `${provider}/${model}`

        // Ensure directory exists
        const configDir = path.join(os.homedir(), ".config", "snow-code")
        await Bun.write(path.join(configDir, ".keep"), "")
        await Bun.write(globalConfigPath, JSON.stringify(globalConfig, null, 2))

        // Also save provider config with baseURL
        const providers = await ModelsDev.get()
        await saveProviderConfig(provider, providers[provider])

        return c.json({ success: true })
      } catch (error: any) {
        return c.json({ success: false, error: error.message })
      }
    }
  )

// Helper functions
function getProviderDescription(id: string): string {
  const descriptions: Record<string, string> = {
    "anthropic": "Claude models",
    "openai": "GPT models",
    "google": "Gemini models",
    "google-vertex": "Vertex AI (GCP)",
    "amazon-bedrock": "AWS Bedrock",
    "azure": "Azure OpenAI",
    "groq": "Fast inference",
    "mistral": "Mistral AI",
    "cohere": "Cohere models",
    "together": "Together AI",
    "fireworks": "Fireworks AI",
    "perplexity": "Perplexity AI",
    "deepseek": "DeepSeek",
    "xai": "xAI (Grok)",
    "cerebras": "Cerebras",
    "openrouter": "Model router",
    "github-copilot": "GitHub Copilot",
    "vercel": "Vercel AI",
    "ollama": "Local models",
  }
  return descriptions[id] || "API key"
}

function getAuthType(id: string): "api" | "oauth" | "aws" | "gcp" {
  if (id === "amazon-bedrock") return "aws"
  if (id === "google-vertex") return "gcp"
  return "api"
}

// Get the path to the enterprise proxy entry point
function getEnterpriseProxyPath(): string {
  const { execSync } = require("child_process")
  const { existsSync } = require("fs")

  let snowFlowRoot: string | undefined

  try {
    // Try global npm installation first
    const npmRoot = execSync('npm root -g', { encoding: 'utf-8' }).trim()
    const globalPath = path.join(npmRoot, 'snow-flow')
    if (existsSync(globalPath)) {
      snowFlowRoot = globalPath
    }
  } catch {
    // Global npm failed, try other options
  }

  // If not found globally, try local node_modules
  if (!snowFlowRoot) {
    const localPath = path.join(process.cwd(), 'node_modules', 'snow-flow')
    if (existsSync(localPath)) {
      snowFlowRoot = localPath
    }
  }

  // If not found, try relative to this file (development)
  if (!snowFlowRoot) {
    // In development, we're in packages/snowcode/src/server/auth-routes.ts
    // snow-flow/packages/core has the enterprise proxy
    const devCorePath = path.resolve(__dirname, '..', '..', '..', 'core')
    if (existsSync(devCorePath)) {
      snowFlowRoot = devCorePath
    }
  }

  if (!snowFlowRoot) {
    throw new Error('Could not find snow-flow installation')
  }

  // Construct enterprise proxy path
  const enterpriseProxyPath = path.join(snowFlowRoot, 'dist', 'mcp', 'enterprise-proxy', 'server.js')

  if (!existsSync(enterpriseProxyPath)) {
    // Fallback: try the snow-flow package dist path directly
    const fallbackPath = path.join(snowFlowRoot, 'dist', 'mcp', 'enterprise-proxy', 'server.js')
    if (existsSync(fallbackPath)) {
      return fallbackPath
    }
    throw new Error(`Enterprise proxy not found at: ${enterpriseProxyPath}`)
  }

  return enterpriseProxyPath
}

// Update enterprise MCP config using LOCAL proxy (same as snow-flow auth login)
async function updateEnterpriseMcpConfig(token: string, mcpServerUrl: string) {
  const configPaths = [
    path.join(process.cwd(), ".mcp.json"),
    path.join(os.homedir(), ".config", "snow-code", "opencode.json"),
  ]

  // Get enterprise proxy path
  let enterpriseProxyPath: string
  try {
    enterpriseProxyPath = getEnterpriseProxyPath()
  } catch (err: any) {
    console.error(`Could not find enterprise proxy: ${err.message}`)
    // Fallback to remote SSE if proxy not found
    for (const configPath of configPaths) {
      try {
        const file = Bun.file(configPath)
        let config: any = {}

        if (await file.exists()) {
          config = JSON.parse(await file.text())
        }

        config.mcp = config.mcp || {}
        config.mcp["snow-flow-enterprise"] = {
          type: "remote",
          url: `${mcpServerUrl}/sse`,
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        }

        await Bun.write(configPath, JSON.stringify(config, null, 2))
      } catch {
        // Skip on error
      }
    }
    return
  }

  // Use LOCAL proxy approach (same as snow-flow auth login)
  for (const configPath of configPaths) {
    try {
      const file = Bun.file(configPath)
      let config: any = {}

      if (await file.exists()) {
        config = JSON.parse(await file.text())
      }

      config.mcp = config.mcp || {}
      config.mcp["snow-flow-enterprise"] = {
        type: "local",
        command: ["node", enterpriseProxyPath],
        environment: {
          SNOW_ENTERPRISE_URL: mcpServerUrl,
          SNOW_LICENSE_KEY: token, // JWT token
        },
        enabled: true,
      }

      await Bun.write(configPath, JSON.stringify(config, null, 2))
    } catch {
      // Skip on error
    }
  }

  // Also update .claude/mcp-config.json for Claude Code compatibility
  const claudeMcpConfigPath = path.join(process.cwd(), ".claude", "mcp-config.json")
  try {
    const file = Bun.file(claudeMcpConfigPath)
    if (await file.exists()) {
      const config = JSON.parse(await file.text())

      if (!config.mcpServers) {
        config.mcpServers = {}
      }

      config.mcpServers["snow-flow-enterprise"] = {
        type: "local",
        command: ["node", enterpriseProxyPath],
        environment: {
          SNOW_ENTERPRISE_URL: mcpServerUrl,
          SNOW_LICENSE_KEY: token,
        },
        enabled: true,
      }

      await Bun.write(claudeMcpConfigPath, JSON.stringify(config, null, 2))
    }
  } catch {
    // Skip on error
  }

  // Reload MCP configuration to pick up the new enterprise server
  try {
    await MCP.reload()
  } catch {
    // Silently continue - MCP module has its own logging
  }
}

/**
 * Replace AGENTS.md with stakeholder-specific read-only documentation
 * This completely replaces the file (not appends) for stakeholder role users
 *
 * MODULAR DESIGN: Only updates AGENTS.md - the generic file that works for all LLMs.
 */
async function replaceDocumentationForStakeholder(role: string): Promise<void> {
  if (role !== 'stakeholder') {
    return // Only replace for stakeholder role
  }

  try {
    const projectRoot = process.cwd()
    const agentsMdPath = path.join(projectRoot, "AGENTS.md")

    // Generate stakeholder-specific documentation
    const stakeholderDocs = generateStakeholderDocumentation()

    // Completely replace AGENTS.md with stakeholder version
    await Bun.write(agentsMdPath, stakeholderDocs)

  } catch (error: any) {
    // Don't throw - this is not critical
    console.error(`Failed to replace stakeholder documentation: ${error.message}`)
  }
}

/**
 * Update project documentation (AGENTS.md) with enterprise server information
 * Uses the comprehensive enterprise-docs-generator for detailed workflow instructions
 *
 * MODULAR DESIGN: Only updates AGENTS.md - the generic file that works for all LLMs.
 * Users can optionally create CLAUDE.md for Claude-specific instructions.
 */
async function updateDocumentationWithEnterprise(enabledServices?: string[]): Promise<void> {
  try {
    const projectRoot = process.cwd()
    const agentsMdPath = path.join(projectRoot, "AGENTS.md")

    // Generate comprehensive enterprise documentation based on enabled services
    // Default to all services if not specified
    const services = enabledServices && enabledServices.length > 0
      ? enabledServices
      : ['jira', 'azdo', 'confluence']

    const enterpriseDocSection = generateEnterpriseInstructions(services)

    // Check markers for both old (short) and new (comprehensive) documentation
    const oldMarker = "## 🚀 Enterprise Features"
    const newMarker = "ENTERPRISE INTEGRATIONS - AUTONOMOUS DEVELOPMENT WORKFLOW"

    const file = Bun.file(agentsMdPath)
    const exists = await file.exists()

    if (!exists) {
      // Create new file with enterprise docs
      await Bun.write(agentsMdPath, enterpriseDocSection)
      return
    }

    let content = await file.text()

    // Check if comprehensive docs already exist
    if (content.includes(newMarker)) {
      // Already has comprehensive docs - no update needed
      return
    }

    // Remove old short documentation if it exists (replace with comprehensive)
    if (content.includes(oldMarker)) {
      // Find the start of the old enterprise section
      const oldStart = content.indexOf(oldMarker)
      // Find the end (next ## heading or end of file)
      let oldEnd = content.indexOf("\n## ", oldStart + 1)
      if (oldEnd === -1) {
        // Check for --- separator
        oldEnd = content.indexOf("\n---", oldStart + 1)
      }
      if (oldEnd === -1) {
        oldEnd = content.length
      }

      // Remove the old section
      content = content.slice(0, oldStart) + content.slice(oldEnd)
    }

    // Find the best insertion point (before "## Conclusion" or at the end)
    let insertionPoint = content.lastIndexOf("## Conclusion")
    if (insertionPoint === -1) {
      insertionPoint = content.lastIndexOf("---")
      if (insertionPoint === -1) {
        insertionPoint = content.length
      }
    }

    const updatedContent =
      content.slice(0, insertionPoint) + enterpriseDocSection + "\n\n" + content.slice(insertionPoint)

    await Bun.write(agentsMdPath, updatedContent)

  } catch (error: any) {
    // Don't throw - this is not critical
  }
}

/**
 * Fetch third-party credentials from portal after enterprise auth
 */
async function fetchThirdPartyCredentials(token: string): Promise<{
  enabledServices: string[]
  credentials?: {
    jira?: { baseUrl: string; email: string; apiToken: string; enabled: boolean }
    azureDevOps?: { baseUrl: string; username?: string; apiToken: string; enabled: boolean }
    confluence?: { baseUrl: string; email: string; apiToken: string; enabled: boolean }
  }
}> {
  const portalUrl = "https://portal.snow-flow.dev"
  const machineId = generateMachineId()

  try {
    const response = await fetch(`${portalUrl}/api/credentials/fetch-for-cli`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ machineId }),
    })

    if (!response.ok) {
      return { enabledServices: [] }
    }

    const data = await response.json()

    if (data.success && data.credentials) {
      const enabledServices: string[] = []
      const creds = data.credentials

      if (creds.jira?.enabled) enabledServices.push('jira')
      if (creds.azureDevOps?.enabled || creds['azure-devops']?.enabled) enabledServices.push('azdo')
      if (creds.confluence?.enabled) enabledServices.push('confluence')

      return {
        enabledServices,
        credentials: {
          jira: creds.jira,
          azureDevOps: creds.azureDevOps || creds['azure-devops'],
          confluence: creds.confluence,
        }
      }
    }

    return { enabledServices: [] }
  } catch {
    return { enabledServices: [] }
  }
}
