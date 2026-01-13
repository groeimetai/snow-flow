import { Auth } from "../../auth"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { ModelsDev } from "../../provider/models"
import { map, pipe, sortBy, values } from "remeda"
import path from "path"
import os from "os"
import crypto from "crypto"
import { Global } from "../../global"
import { Plugin } from "../../plugin"
import { Instance } from "../../project/instance"
import { ServiceNowOAuth } from "../../auth/servicenow-oauth"
import { PortalSync } from "../../auth/portal-sync"

// Import enterprise auth commands
import {
  AuthEnterpriseLoginCommand,
  AuthEnterpriseSyncCommand,
  AuthEnterpriseStatusCommand,
  AuthEnterpriseThemeExportCommand,
  readEnterpriseConfig
} from "./auth-enterprise.js"
import open from "open"

// Import portal auth commands (Individual/Teams - email-based)
import {
  AuthPortalLoginCommand,
  AuthPortalLogoutCommand,
  AuthPortalStatusCommand,
  AuthPortalRefreshCommand
} from "./auth-portal.js"

/**
 * SECURITY: Validate ServiceNow URL using proper URL parsing
 * Prevents URL substring attacks
 */
function isValidServiceNowUrl(value: string): boolean {
  if (!value || value.trim() === "") return false

  // Prepare URL for parsing
  let urlString = value.trim()
  if (!urlString.startsWith("http://") && !urlString.startsWith("https://")) {
    urlString = `https://${urlString}`
  }

  try {
    const parsed = new URL(urlString)
    const hostname = parsed.hostname.toLowerCase()

    // Check if hostname is a valid ServiceNow domain or local
    return hostname.endsWith(".service-now.com") ||
           hostname.endsWith(".servicenow.com") ||
           hostname === "localhost" ||
           hostname === "127.0.0.1" ||
           hostname.startsWith("192.168.")
  } catch {
    return false
  }
}

/**
 * Generate a unique machine ID for device binding
 * Uses hostname + platform + homedir for consistent ID across sessions
 */
function generateMachineId(): string {
  const machineInfo = `${os.hostname()}-${os.platform()}-${os.homedir()}`
  return crypto.createHash('sha256').update(machineInfo).digest('hex')
}

/**
 * Helper function to update .env file with key-value pairs
 */
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

  // Ensure file ends with newline
  if (!envContent.endsWith("\n")) {
    envContent += "\n"
  }

  await Bun.write(envPath, envContent)
}

/**
 * Helper function to update SnowCode MCP config files with ServiceNow credentials
 */
async function updateSnowCodeMCPConfigs(instance: string, clientId: string, clientSecret: string) {
  const projectSnowCodeDir = path.join(process.cwd(), ".snow-code")
  const globalConfigDir = path.join(os.homedir(), ".config", "snow-code")

  // Ensure instance is a full URL
  const instanceUrl = instance.startsWith("http") ? instance : `https://${instance}`

  // ONLY update PRIMARY locations (with hyphen)
  // Legacy locations are read-only for backward compatibility
  const configPaths = [
    // Project-level .mcp.json (primary config for snow-flow)
    path.join(process.cwd(), ".mcp.json"),
    // Project-level (created by snow-flow init) - with hyphen ONLY
    path.join(projectSnowCodeDir, "opencode.json"),
    path.join(projectSnowCodeDir, "config.json"),
    // Global config directory (with hyphen ONLY)
    path.join(globalConfigDir, "opencode.json"),
    path.join(globalConfigDir, "snowcode.json"),
    path.join(globalConfigDir, "config.json"),
  ]

  var updatedCount = 0
  for (const configPath of configPaths) {
    try {
      // Check if file exists
      const file = Bun.file(configPath)
      if (!(await file.exists())) {
        // Silently skip non-existent config files
        continue
      }

      // Read and parse config
      const configText = await file.text()
      var config = JSON.parse(configText)

      // Update ServiceNow credentials in MCP server configs
      if (config.mcp) {
        var serverCount = 0
        for (var serverName in config.mcp) {
          var serverConfig = config.mcp[serverName]

          // Update environment variables
          if (serverConfig.environment) {
            if (serverConfig.environment.SERVICENOW_INSTANCE_URL !== undefined) {
              serverConfig.environment.SERVICENOW_INSTANCE_URL = instanceUrl
            }
            if (serverConfig.environment.SERVICENOW_CLIENT_ID !== undefined) {
              serverConfig.environment.SERVICENOW_CLIENT_ID = clientId
            }
            if (serverConfig.environment.SERVICENOW_CLIENT_SECRET !== undefined) {
              serverConfig.environment.SERVICENOW_CLIENT_SECRET = clientSecret
            }
            if (serverConfig.environment.SNOW_INSTANCE !== undefined) {
              serverConfig.environment.SNOW_INSTANCE = instance
            }
            if (serverConfig.environment.SNOW_CLIENT_ID !== undefined) {
              serverConfig.environment.SNOW_CLIENT_ID = clientId
            }
            if (serverConfig.environment.SNOW_CLIENT_SECRET !== undefined) {
              serverConfig.environment.SNOW_CLIENT_SECRET = clientSecret
            }
            // Also update username/password if present (for basic auth)
            if (serverConfig.environment.SERVICENOW_USERNAME !== undefined) {
              serverConfig.environment.SERVICENOW_USERNAME = ""
            }
            if (serverConfig.environment.SERVICENOW_PASSWORD !== undefined) {
              serverConfig.environment.SERVICENOW_PASSWORD = ""
            }
            serverCount++
          }
        }

        if (serverCount > 0) {
          // Write updated config back
          await Bun.write(configPath, JSON.stringify(config, null, 2))
          // Silently update MCP servers
          updatedCount++
        }
      }
    } catch (error: any) {
      // Silently skip failed config updates
    }
  }

  // Silently complete - no need for verbose logging
  // Config updates are transparent to the user
}

/**
 * Known provider baseURLs for providers where models.dev doesn't specify one
 * These are the official API endpoints for each provider
 */
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
}

/**
 * Helper function to save provider configuration with baseURL to config.json
 * This ensures providers have the correct baseURL set after authentication
 */
async function saveProviderConfig(
  providerId: string,
  providerInfo?: { api?: string; npm?: string; name?: string }
) {
  const globalConfigPath = path.join(os.homedir(), ".config", "snow-code", "config.json")

  // Determine the baseURL to use
  // Priority: 1. models.dev api field, 2. known provider URLs, 3. skip if unknown
  const baseURL = providerInfo?.api || PROVIDER_BASE_URLS[providerId]

  if (!baseURL) {
    // Don't set baseURL if we don't know it - let the SDK use its default
    return
  }

  try {
    // Ensure config directory exists
    const configDir = path.join(os.homedir(), ".config", "snow-code")
    await Bun.write(path.join(configDir, ".keep"), "")

    // Read existing config
    let globalConfig: any = {}
    try {
      const file = Bun.file(globalConfigPath)
      if (await file.exists()) {
        globalConfig = JSON.parse(await file.text())
      }
    } catch {}

    // Initialize provider section if needed
    globalConfig.provider = globalConfig.provider || {}

    // Update or create provider config with baseURL
    // Merge with existing config to preserve other settings
    globalConfig.provider[providerId] = {
      ...globalConfig.provider[providerId],
      options: {
        ...globalConfig.provider[providerId]?.options,
        baseURL: baseURL,
      },
    }

    // Write updated config
    await Bun.write(globalConfigPath, JSON.stringify(globalConfig, null, 2))
  } catch (error) {
    // Silently fail - this is a best-effort enhancement
  }
}

// ============================================================================
// Snow-Flow LLM API - Discovery-based approach for MID Server LLM integration
// ============================================================================

/**
 * Discover available MID Servers from ServiceNow
 */
async function discoverMidServers(instanceUrl: string, accessToken: string): Promise<{
  success: boolean
  midServers?: Array<{ name: string; sys_id: string; status: string; validated: boolean }>
  error?: string
}> {
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
        return { success: true, midServers: data.result?.mid_servers || [] }
      }
      // API not deployed or returned error - fall through to fallback
    } catch {
      // Snow-Flow API not available - fall through to fallback
    }

    // Fallback: Query ecc_agent table directly
    const response = await fetch(
      `${instanceUrl}/api/now/table/ecc_agent?sysparm_query=status=Up&sysparm_fields=name,sys_id,status,validated&sysparm_limit=50`,
      { headers }
    )

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    const midServers = (data.result || []).map((agent: any) => ({
      name: agent.name,
      sys_id: agent.sys_id,
      status: agent.status,
      validated: agent.validated === "true" || agent.validated === true,
    }))

    return { success: true, midServers }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Discover REST Messages configured to use MID Server
 */
async function discoverRestMessages(instanceUrl: string, accessToken: string): Promise<{
  success: boolean
  restMessages?: Array<{
    name: string
    sys_id: string
    endpoint: string
    mid_server: string
    methods: Array<{ name: string; http_method: string; sys_id: string }>
  }>
  error?: string
}> {
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
        return { success: true, restMessages: data.result?.rest_messages || [] }
      }
      // API not deployed or returned error - fall through to fallback
    } catch {
      // Snow-Flow API not available - fall through to fallback
    }

    // Fallback: Query sys_rest_message table directly (get all REST Messages)
    // Note: MID Server config may be on HTTP Method level (sys_rest_message_fn) or REST Message level
    const response = await fetch(
      `${instanceUrl}/api/now/table/sys_rest_message?sysparm_fields=name,sys_id,rest_endpoint&sysparm_display_value=true&sysparm_limit=50`,
      { headers }
    )

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    const restMessages: Array<{
      name: string
      sys_id: string
      endpoint: string
      mid_server: string
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

    return { success: true, restMessages }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Look up model metadata from models.dev database
 * Tries to match model ID using various patterns (exact match, partial match, fuzzy match)
 */
async function lookupModelInModelsDev(modelId: string): Promise<{
  found: boolean
  contextWindow?: number
  maxTokens?: number
  matchedModel?: string
}> {
  try {
    const database = await ModelsDev.get()
    const normalizedId = modelId.toLowerCase().replace(/[_-]/g, "")

    // Search across all providers for a matching model
    for (const [_providerId, provider] of Object.entries(database)) {
      for (const [modelKey, model] of Object.entries(provider.models)) {
        const normalizedKey = modelKey.toLowerCase().replace(/[_-]/g, "")
        const normalizedModelId = (model.id || "").toLowerCase().replace(/[_-]/g, "")
        const normalizedName = (model.name || "").toLowerCase().replace(/[_-]/g, "")

        // Try exact match first
        if (normalizedKey === normalizedId || normalizedModelId === normalizedId) {
          return {
            found: true,
            contextWindow: model.limit?.context,
            maxTokens: model.limit?.output,
            matchedModel: modelKey,
          }
        }

        // Try partial match (e.g., "llama3" matches "llama-3-70b-instruct")
        if (normalizedKey.includes(normalizedId) || normalizedId.includes(normalizedKey) ||
            normalizedModelId.includes(normalizedId) || normalizedId.includes(normalizedModelId) ||
            normalizedName.includes(normalizedId) || normalizedId.includes(normalizedName)) {
          return {
            found: true,
            contextWindow: model.limit?.context,
            maxTokens: model.limit?.output,
            matchedModel: modelKey,
          }
        }
      }
    }

    return { found: false }
  } catch {
    return { found: false }
  }
}

/**
 * Discover available models from LLM endpoint via Snow-Flow API
 */
interface ModelInfo {
  id: string
  name?: string
  contextWindow?: number  // max_model_len (vLLM) or context_length (Ollama)
  maxTokens?: number      // Recommended max output tokens
}

async function discoverModels(instanceUrl: string, accessToken: string, restMessage: string): Promise<{
  success: boolean
  models?: Array<ModelInfo>
  error?: string
}> {
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
      return { success: false, error: `HTTP ${response.status}` }
    }

    const data = await response.json()
    const models: ModelInfo[] = (data.result?.models || []).map((m: any) => {
      // Extract context window from various possible field names
      // vLLM uses max_model_len, Ollama uses context_length, HuggingFace TGI uses max_input_length
      const contextWindow = m.max_model_len || m.context_length || m.max_input_length || m.context_window || undefined

      return {
        id: m.id || m,
        name: m.name || m.id || m,
        contextWindow: contextWindow ? Number(contextWindow) : undefined,
        // Recommended max_tokens is typically 1/4 to 1/2 of context window
        maxTokens: contextWindow ? Math.min(4096, Math.floor(Number(contextWindow) / 4)) : undefined,
      }
    })

    return { success: true, models }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Test LLM chat via Snow-Flow API
 */
async function testSnowFlowLLMChat(options: {
  instanceUrl: string
  accessToken: string
  restMessage: string
  httpMethod: string
  model?: string
  apiBaseUri?: string
}): Promise<{ success: boolean; response?: string; error?: string }> {
  const { instanceUrl, accessToken, restMessage, httpMethod, model, apiBaseUri } = options
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
      return { success: false, error: errorData.error?.message || `HTTP ${response.status}` }
    }

    const data = await response.json()

    if (data.result?.success) {
      return { success: true, response: data.result.response }
    } else {
      return { success: false, error: data.result?.error || "Unknown error" }
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Deploy Snow-Flow LLM API to ServiceNow
 * Creates Scripted REST API with endpoints for MID Server LLM integration
 */
async function deploySnowFlowLLMAPI(options: {
  instanceUrl: string
  accessToken: string
  restMessage?: string
  httpMethod?: string
  defaultModel?: string
  verbose?: boolean
}): Promise<{ success: boolean; error?: string; namespace?: string; baseUri?: string }> {
  const { instanceUrl, accessToken } = options
  const verbose = options.verbose || verboseMode

  const log = (msg: string) => {
    if (verbose) {
      prompts.log.info(`[DEPLOY] ${msg}`)
    }
  }

  const headers = {
    "Authorization": `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "Accept": "application/json",
  }

  try {
    log(`Starting deployment to ${instanceUrl}`)

    // Step 1: Create Script Include - SnowFlowLLMService
    const scriptIncludeScript = `var SnowFlowLLMService = Class.create();
SnowFlowLLMService.prototype = {
    initialize: function() {},

    // Chat via REST Message en MID Server
    chat: function(message, maxTokens, restMessageName, httpMethodName, modelName) {
        var result = { success: false, response: '', error: '' };
        try {
            var r = new sn_ws.RESTMessageV2(restMessageName, httpMethodName);

            // Build OpenAI-compatible request body
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

    // Chat with full OpenAI messages array
    chatOpenAI: function(messages, maxTokens, restMessageName, httpMethodName, modelName) {
        var result = { success: false, response: '', error: '' };
        try {
            var r = new sn_ws.RESTMessageV2(restMessageName, httpMethodName);

            // Build OpenAI-compatible request body with full messages array
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

    // Lijst beschikbare MID Servers
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

    // Lijst REST Messages (all available)
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

    // Query modellen van LLM endpoint via MID Server
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
    log("Step 1: Checking Script Include...")
    const siCheckResponse = await fetch(
      `${instanceUrl}/api/now/table/sys_script_include?sysparm_query=name=SnowFlowLLMService&sysparm_limit=1`,
      { headers }
    )
    const siCheckData = await siCheckResponse.json()

    if (siCheckData.result && siCheckData.result.length > 0) {
      // Update existing Script Include
      log(`Script Include exists (sys_id: ${siCheckData.result[0].sys_id}), updating...`)
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
        return { success: false, error: `Failed to update Script Include: HTTP ${updateResponse.status} - ${errorBody}` }
      }
      log("Script Include updated successfully")
    } else {
      // Create new Script Include
      log("Script Include not found, creating...")
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
        return { success: false, error: `Failed to create Script Include: HTTP ${createResponse.status} - ${errorBody}` }
      }
      const siData = await createResponse.json()
      log(`Script Include created (sys_id: ${siData.result?.sys_id})`)
    }

    // Step 2: Create Scripted REST API
    log("Step 2: Checking Scripted REST API...")
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
      log(`REST API exists (sys_id: ${restApiSysId}, namespace: ${apiNamespace}, base_uri: ${apiBaseUri})`)
    } else {
      // Create REST API Definition
      log("REST API not found, creating...")
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
        return { success: false, error: `Failed to create REST API: HTTP ${restApiResponse.status} - ${errorBody}` }
      }
      const restApiData = await restApiResponse.json()
      restApiSysId = restApiData.result.sys_id

      // Re-fetch to get the generated namespace
      log("Fetching generated namespace...")
      const refetchResponse = await fetch(
        `${instanceUrl}/api/now/table/sys_ws_definition/${restApiSysId}?sysparm_fields=namespace,base_uri`,
        { headers }
      )
      if (refetchResponse.ok) {
        const refetchData = await refetchResponse.json()
        apiNamespace = refetchData.result?.namespace || ""
        apiBaseUri = refetchData.result?.base_uri || ""
      }
      log(`REST API created (sys_id: ${restApiSysId}, namespace: ${apiNamespace}, base_uri: ${apiBaseUri})`)
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
        name: "Chat Completions (OpenAI Compatible)",
        relative_path: "/llm/chat/completions",
        http_method: "POST",
        operation_script: `(function process(request, response) {
    // OpenAI-compatible endpoint
    var body = request.body.data;
    var model = body.model || 'default';
    var messages = body.messages || [];
    var maxTokens = body.max_tokens || 100;

    // Get REST Message config from headers or system property
    var restMessage = request.getHeader('X-Snow-Flow-Rest-Message') ||
                      gs.getProperty('snow_flow.llm.rest_message', '');
    var httpMethod = request.getHeader('X-Snow-Flow-Http-Method') ||
                     gs.getProperty('snow_flow.llm.http_method', 'Chat_Completions');

    if (!restMessage) {
        response.setStatus(400);
        return {
            error: {
                message: 'REST Message not configured. Set X-Snow-Flow-Rest-Message header or snow_flow.llm.rest_message property.',
                type: 'invalid_request_error'
            }
        };
    }

    // Extract user message from messages array
    var userMessage = '';
    for (var i = 0; i < messages.length; i++) {
        if (messages[i].role === 'user') {
            userMessage = messages[i].content;
        }
    }

    var service = new SnowFlowLLMService();
    var result = service.chatOpenAI(messages, maxTokens, restMessage, httpMethod, model);

    if (result.success) {
        response.setStatus(200);
        return {
            id: 'chatcmpl-' + gs.generateGUID(),
            object: 'chat.completion',
            created: Math.floor(new Date().getTime() / 1000),
            model: result.model || model,
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: result.response
                },
                finish_reason: 'stop'
            }],
            usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        };
    } else {
        response.setStatus(500);
        return {
            error: {
                message: result.error,
                type: 'api_error'
            }
        };
    }
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

    log(`Step 3: Creating ${resources.length} REST Resources...`)
    for (const resource of resources) {
      log(`  Checking resource: ${resource.name} (${resource.relative_path})`)
      // Check if resource exists
      const resCheckResponse = await fetch(
        `${instanceUrl}/api/now/table/sys_ws_operation?sysparm_query=web_service_definition=${restApiSysId}^relative_path=${encodeURIComponent(resource.relative_path)}&sysparm_limit=1`,
        { headers }
      )
      const resCheckData = await resCheckResponse.json()

      if (resCheckData.result && resCheckData.result.length > 0) {
        // Update existing resource
        log(`    Resource exists (sys_id: ${resCheckData.result[0].sys_id}), updating...`)
        const updateRes = await fetch(
          `${instanceUrl}/api/now/table/sys_ws_operation/${resCheckData.result[0].sys_id}`,
          {
            method: "PATCH",
            headers,
            body: JSON.stringify({ operation_script: resource.operation_script }),
          }
        )
        if (!updateRes.ok) {
          const errorBody = await updateRes.text()
          return { success: false, error: `Failed to update resource ${resource.name}: HTTP ${updateRes.status} - ${errorBody}` }
        }
        log(`    Resource updated successfully`)
      } else {
        // Create new resource
        log(`    Resource not found, creating...`)
        const createRes = await fetch(
          `${instanceUrl}/api/now/table/sys_ws_operation`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              name: resource.name,
              web_service_definition: restApiSysId,
              http_method: resource.http_method,
              relative_path: resource.relative_path,
              operation_script: resource.operation_script,
              active: true,
            }),
          }
        )
        if (!createRes.ok) {
          const errorBody = await createRes.text()
          return { success: false, error: `Failed to create resource ${resource.name}: HTTP ${createRes.status} - ${errorBody}` }
        }
        const resData = await createRes.json()
        log(`    Resource created (sys_id: ${resData.result?.sys_id})`)
      }
    }
    log("All resources created successfully")

    // Set system properties for REST Message configuration if provided
    if (options.restMessage || options.httpMethod || options.defaultModel) {
      const properties = [
        { name: "snow_flow.llm.rest_message", value: options.restMessage || "" },
        { name: "snow_flow.llm.http_method", value: options.httpMethod || "Chat_Completions" },
        { name: "snow_flow.llm.default_model", value: options.defaultModel || "default" },
      ]

      for (const prop of properties) {
        if (prop.value) {
          // Check if property exists
          const propCheckResponse = await fetch(
            `${instanceUrl}/api/now/table/sys_properties?sysparm_query=name=${encodeURIComponent(prop.name)}&sysparm_limit=1`,
            { headers }
          )
          const propCheckData = await propCheckResponse.json()

          if (propCheckData.result && propCheckData.result.length > 0) {
            // Update existing property
            await fetch(
              `${instanceUrl}/api/now/table/sys_properties/${propCheckData.result[0].sys_id}`,
              {
                method: "PATCH",
                headers,
                body: JSON.stringify({ value: prop.value }),
              }
            )
          } else {
            // Create new property
            await fetch(
              `${instanceUrl}/api/now/table/sys_properties`,
              {
                method: "POST",
                headers,
                body: JSON.stringify({
                  name: prop.name,
                  value: prop.value,
                  description: "Snow-Flow LLM configuration",
                  type: "string",
                }),
              }
            )
          }
        }
      }
    }

    log(`Deployment complete! API base URI: ${apiBaseUri}`)
    return { success: true, namespace: apiNamespace, baseUri: apiBaseUri }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

/**
 * Validate enterprise license key with enterprise server
 * Note: Does NOT require user authentication token - the license key validates itself
 */
async function validateLicenseKey(licenseKey: string, serverUrl?: string): Promise<{
  valid: boolean
  error?: string
  features?: string[]
  serverUrl?: string
}> {
  try {
    // License validation goes to portal server (public endpoint, no auth)
    // Enterprise server has this endpoint but requires authorization header
    const effectiveServerUrl = serverUrl || "https://portal.snow-flow.dev"

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // NOTE: License validation API does NOT require authentication token
    // It validates the license key itself, not the user session
    // User session tokens will cause "invalid signature" JWT errors

    const response = await fetch(`${effectiveServerUrl}/api/license/validate`, {
      method: "POST",
      headers,
      body: JSON.stringify({ licenseKey }),
    })

    const data = await response.json()

    if (!response.ok || !data.success) {
      return {
        valid: false,
        error: data.error || data.message || "Invalid license key",
      }
    }

    return {
      valid: true,
      features: data.features || [],
      serverUrl: data.serverUrl || effectiveServerUrl,
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message,
    }
  }
}

/**
 * Find the enterprise proxy path dynamically
 */
async function findEnterpriseProxyPath(): Promise<string> {
  var enterpriseProxyPath = ""

  // Try to get global npm root dynamically
  try {
    const npmRootResult = Bun.spawnSync(["npm", "root", "-g"])
    if (npmRootResult.exitCode === 0) {
      const globalNodeModules = npmRootResult.stdout.toString().trim()
      const dynamicPath = path.join(globalNodeModules, "snow-flow", "dist", "mcp", "enterprise-proxy", "index.js")
      if (await Bun.file(dynamicPath).exists()) {
        return dynamicPath
      }
    }
  } catch (e) {
    // Ignore errors, fall through to static paths
  }

  // Fallback to static paths if dynamic detection failed
  const possiblePaths = [
    path.join(process.cwd(), "node_modules", "snow-flow", "dist", "mcp", "enterprise-proxy", "index.js"),
    path.join(os.homedir(), ".npm", "lib", "node_modules", "snow-flow", "dist", "mcp", "enterprise-proxy", "index.js"),
    "/usr/local/lib/node_modules/snow-flow/dist/mcp/enterprise-proxy/index.js",
  ]

  for (const testPath of possiblePaths) {
    if (await Bun.file(testPath).exists()) {
      return testPath
    }
  }

  // Return npx as fallback
  return "npx"
}

/**
 * @deprecated Use updateEnterpriseMcpConfig() instead.
 * This interface stores credentials locally which is insecure.
 * Enterprise MCP configuration interface (LEGACY - DO NOT USE)
 */
interface EnterpriseMcpConfig {
  licenseKey: string
  serverUrl?: string
  credentials?: {
    atlassian?: {
      email: string
      apiToken: string
    }
    jira?: {
      host: string
    }
    azure?: {
      organization: string
      project?: string
      pat: string
    }
    confluence?: {
      host: string
    }
  }
}

/**
 * @deprecated Use updateEnterpriseMcpConfig() instead.
 * This function stores credentials locally which is insecure.
 * Add enterprise MCP server to snow-code configuration (LEGACY - DO NOT USE)
 */
async function addEnterpriseMcpServer(config: EnterpriseMcpConfig): Promise<void> {
  const projectSnowCodeDir = path.join(process.cwd(), ".snow-code")
  const globalConfigDir = path.join(os.homedir(), ".config", "snow-code")

  const configPaths = [
    // Project root .mcp.json (used by snow-flow)
    path.join(process.cwd(), ".mcp.json"),
    // Project .snow-code configs
    path.join(projectSnowCodeDir, "opencode.json"),
    path.join(projectSnowCodeDir, "config.json"),
    // Global configs
    path.join(globalConfigDir, "opencode.json"),
    path.join(globalConfigDir, "snowcode.json"),
    path.join(globalConfigDir, "config.json"),
  ]

  for (const configPath of configPaths) {
    try {
      const file = Bun.file(configPath)
      if (!(await file.exists())) {
        continue
      }

      const configText = await file.text()
      var snowCodeConfig = JSON.parse(configText)

      // All snow-flow/snow-code configs use "mcp" key consistently
      // (Claude Desktop uses "mcpServers", but we don't write to that directly)
      const mcpKey = "mcp"

      if (!snowCodeConfig[mcpKey]) {
        snowCodeConfig[mcpKey] = {}
      }

      // Find enterprise proxy path dynamically
      const enterpriseProxyPath = await findEnterpriseProxyPath()

      // Add enterprise MCP server configuration
      const enterpriseConfig = {
        type: "local",
        command: enterpriseProxyPath === "npx" ? ["npx", "snow-flow-enterprise-proxy"] : ["node", enterpriseProxyPath],
        environment: {
          SNOW_LICENSE_KEY: config.licenseKey,
          SNOW_ENTERPRISE_URL: config.serverUrl || "https://enterprise.snow-flow.dev",
          ...(config.credentials?.atlassian && {
            ATLASSIAN_EMAIL: config.credentials.atlassian.email,
            ATLASSIAN_API_TOKEN: config.credentials.atlassian.apiToken,
          }),
          ...(config.credentials?.jira && {
            JIRA_HOST: config.credentials.jira.host,
          }),
          ...(config.credentials?.azure && {
            AZURE_ORG: config.credentials.azure.organization,
            AZURE_PROJECT: config.credentials.azure.project || "",
            AZURE_PAT: config.credentials.azure.pat,
          }),
          ...(config.credentials?.confluence && {
            CONFLUENCE_HOST: config.credentials.confluence.host,
          }),
        },
        enabled: true,
      }

      // Add to config
      snowCodeConfig[mcpKey]["snow-flow-enterprise"] = enterpriseConfig

      await Bun.write(configPath, JSON.stringify(snowCodeConfig, null, 2))
    } catch (error: any) {
      // Skip failed config updates
    }
  }
}

/**
 * Update enterprise MCP configuration with JWT token.
 * SECURITY: This function only uses the JWT token - NO credentials are stored locally.
 * All credentials (Jira, Azure DevOps, Confluence, ServiceNow) are fetched server-side
 * by the enterprise MCP server using the JWT token for authentication.
 *
 * @param jwtToken - The JWT token obtained from device authorization flow
 * @param mcpServerUrl - The enterprise MCP server URL
 */
async function updateEnterpriseMcpConfig(jwtToken: string, mcpServerUrl: string): Promise<void> {
  const projectSnowCodeDir = path.join(process.cwd(), ".snow-code")
  const globalConfigDir = path.join(os.homedir(), ".config", "snow-code")

  const configPaths = [
    // Project root .mcp.json (used by snow-flow)
    path.join(process.cwd(), ".mcp.json"),
    // Project .snow-code configs
    path.join(projectSnowCodeDir, "opencode.json"),
    path.join(projectSnowCodeDir, "config.json"),
    // Global configs
    path.join(globalConfigDir, "opencode.json"),
    path.join(globalConfigDir, "snowcode.json"),
    path.join(globalConfigDir, "config.json"),
  ]

  // Find enterprise proxy path dynamically
  const enterpriseProxyPath = await findEnterpriseProxyPath()

  // Enterprise MCP server configuration
  // SECURITY: Only JWT token is passed - credentials are fetched server-side
  const enterpriseMcpConfig = {
    type: "local",
    command: enterpriseProxyPath === "npx" ? ["npx", "snow-flow-enterprise-proxy"] : ["node", enterpriseProxyPath],
    environment: {
      SNOW_LICENSE_KEY: jwtToken,  // JWT token for authentication - NOT the raw license key
      SNOW_ENTERPRISE_URL: mcpServerUrl || "https://enterprise.snow-flow.dev",
      // NOTE: NO credentials are stored here - they are fetched server-side by the enterprise MCP server
    },
    enabled: true,
  }

  for (const configPath of configPaths) {
    try {
      const dir = path.dirname(configPath)
      // Ensure directory exists by writing a .keep file
      await Bun.write(path.join(dir, ".keep"), "")

      var snowCodeConfig: any = {}
      const file = Bun.file(configPath)
      if (await file.exists()) {
        const configText = await file.text()
        snowCodeConfig = JSON.parse(configText)
      }

      // Ensure mcp key exists
      if (!snowCodeConfig.mcp) {
        snowCodeConfig.mcp = {}
      }

      // Add/update enterprise MCP server configuration
      snowCodeConfig.mcp["snow-flow-enterprise"] = enterpriseMcpConfig

      await Bun.write(configPath, JSON.stringify(snowCodeConfig, null, 2))
    } catch (error: any) {
      // Skip failed config updates - continue with other paths
    }
  }
}

/**
 * Update project documentation (AGENTS.md) with enterprise server information
 * Uses the comprehensive enterprise-docs-generator for detailed workflow instructions
 *
 * MODULAR DESIGN: Only updates AGENTS.md - the generic file that works for all LLMs.
 * Users can optionally create CLAUDE.md for Claude-specific instructions.
 *
 * @param enabledServices - Array of enabled services (e.g., ['jira', 'azdo', 'confluence'])
 */
async function updateDocumentationWithEnterprise(enabledServices?: string[]): Promise<void> {
  try {
    const projectRoot = process.cwd()
    const agentsMdPath = path.join(projectRoot, "AGENTS.md")

    // Import the comprehensive documentation generator
    const { generateEnterpriseInstructions } = await import("./enterprise-docs-generator.js")

    // Generate comprehensive enterprise documentation based on enabled services
    // Default to all services if not specified
    const services = enabledServices && enabledServices.length > 0
      ? enabledServices
      : ['jira', 'azdo', 'confluence']

    const enterpriseDocSection = generateEnterpriseInstructions(services)

    // Check markers for both old (short) and new (comprehensive) documentation
    const oldMarker = "## 🚀 Enterprise Features"
    const newMarker = "ENTERPRISE INTEGRATIONS - AUTONOMOUS DEVELOPMENT WORKFLOW"

    // Helper function to update a documentation file
    async function updateDocFile(filePath: string, fileName: string): Promise<void> {
      try {
        const file = Bun.file(filePath)
        if (await file.exists()) {
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
            prompts.log.info(`Replacing old enterprise docs in ${fileName} with comprehensive version`)
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

          await Bun.write(filePath, updatedContent)
        }
      } catch (err: any) {
        if (err.code !== "ENOENT") {
          prompts.log.info(`Could not update ${fileName}: ${err.message}`)
        }
      }
    }

    // Update AGENTS.md - the generic file that works for all LLMs
    await updateDocFile(agentsMdPath, "AGENTS.md")

  } catch (error: any) {
    prompts.log.info(`Failed to update documentation: ${error.message}`)
    // Don't throw - this is not critical
  }
}

/**
 * Replace AGENTS.md with stakeholder-specific read-only documentation
 * This completely replaces the file (not appends) for stakeholder role users
 * Must be called BEFORE updateDocumentationWithEnterprise() when role is 'stakeholder'
 *
 * MODULAR DESIGN: Only updates AGENTS.md - the generic file that works for all LLMs.
 *
 * @param role - User role from enterprise authentication
 */
async function replaceDocumentationForStakeholder(role: string): Promise<void> {
  if (role !== 'stakeholder') {
    return // Only replace for stakeholder role
  }

  try {
    const projectRoot = process.cwd()
    const agentsMdPath = path.join(projectRoot, "AGENTS.md")

    // Import the stakeholder documentation generator
    const { generateStakeholderDocumentation } = await import("./enterprise-docs-generator.js")

    // Generate stakeholder-specific documentation
    const stakeholderDocs = generateStakeholderDocumentation()

    // Completely replace AGENTS.md with stakeholder version
    await Bun.write(agentsMdPath, stakeholderDocs)
    prompts.log.success("📖 AGENTS.md replaced with stakeholder read-only documentation")

    prompts.log.info("🔒 Stakeholder documentation configured - READ-ONLY access enabled")

  } catch (error: any) {
    prompts.log.info(`Failed to replace stakeholder documentation: ${error.message}`)
    // Don't throw - this is not critical
  }
}

// Enterprise portal URL (same as auth-enterprise.ts)
const ENTERPRISE_PORTAL_URL = process.env.SNOW_FLOW_PORTAL_URL || "https://portal.snow-flow.dev"
const ENTERPRISE_API_URL = process.env.SNOW_FLOW_API_URL || "https://portal.snow-flow.dev"
const ENTERPRISE_CONFIG_DIR = path.join(os.homedir(), ".snow-code")
const ENTERPRISE_CONFIG_FILE = path.join(ENTERPRISE_CONFIG_DIR, "enterprise.json")

interface ServiceNowInstanceFromPortal {
  id: number
  instanceName: string
  instanceUrl: string
  environmentType: string
  clientId: string
  clientSecret: string
  isDefault: boolean
  enabled: boolean
}

interface EnterpriseThemeFromPortal {
  source: 'service-integrator' | 'custom-theme'
  // Custom theme info (if source is 'custom-theme')
  themeId?: number
  themeName?: string
  displayName?: string
  // Branding
  whiteLabelEnabled?: boolean
  brandName?: string
  logoUrl?: string
  faviconUrl?: string
  // Colors
  primaryColor: string
  secondaryColor: string
  accentColor: string
  // Support info
  supportEmail?: string
  supportUrl?: string
  footerText?: string
  // Full theme config for advanced usage
  themeConfig?: any
}

interface EnterpriseCredentialsResult {
  success: boolean
  error?: string
  token?: string
  customer?: {
    id: number
    name: string
    company: string
    licenseKey: string
  }
  credentials?: {
    jira?: { baseUrl: string; email: string; apiToken: string; enabled: boolean }
    "azure-devops"?: { baseUrl: string; username?: string; apiToken: string; enabled: boolean }
    confluence?: { baseUrl: string; email: string; apiToken: string; enabled: boolean }
  }
  servicenowInstances?: ServiceNowInstanceFromPortal[]
  mcpServerUrl?: string
  theme?: EnterpriseThemeFromPortal
}

/**
 * Perform enterprise device authorization flow (browser-based)
 * Returns credentials including ServiceNow instances from portal
 */
async function performEnterpriseDeviceAuth(): Promise<EnterpriseCredentialsResult> {
  try {
    // Step 1: Request device authorization session
    prompts.log.step("Requesting device authorization...")

    const machineInfo = `${os.userInfo().username}@${os.hostname()} (${os.platform()})`
    const requestResponse = await fetch(`${ENTERPRISE_API_URL}/api/auth/device/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ machineInfo })
    })

    if (!requestResponse.ok) {
      const error = await requestResponse.json()
      return { success: false, error: error.error || "Failed to request device authorization" }
    }

    const { sessionId, verificationUrl } = await requestResponse.json()

    // Step 2: Open browser for user approval
    prompts.log.info("")
    prompts.log.success("✓ Device authorization session created")
    prompts.log.info("")
    prompts.log.info("🌐 Opening browser for authorization...")
    prompts.log.info("")
    prompts.log.info(`   If browser doesn't open automatically, visit:`)
    prompts.log.info(`   ${verificationUrl}`)
    prompts.log.info("")

    try {
      await open(verificationUrl)
    } catch {
      prompts.log.warn("   Could not open browser automatically")
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
      return { success: false, error: "Authorization cancelled" }
    }

    const authCode = (authCodeResponse as string).trim()

    // Step 4: Verify code and get token
    prompts.log.step("Verifying authorization code...")

    const verifyResponse = await fetch(`${ENTERPRISE_API_URL}/api/auth/device/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, authCode })
    })

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json()
      return { success: false, error: error.error || "Failed to verify authorization code" }
    }

    const { token, authType, customer, user } = await verifyResponse.json()

    // SECURITY: Block license key admin logins - they must use a user account
    // Each device auth counts as a seat, so admins should not use CLI directly
    if (authType === 'enterprise') {
      prompts.log.error("")
      prompts.log.error("⚠️  License key admin login is not allowed via CLI")
      prompts.log.info("")
      prompts.log.info("   Enterprise admins must create user accounts in the portal.")
      prompts.log.info("   Each CLI login counts as a licensed seat.")
      prompts.log.info("")
      prompts.log.info("   To create users:")
      prompts.log.info("   1. Go to https://portal.snow-flow.dev")
      prompts.log.info("   2. Navigate to Users → Add User")
      prompts.log.info("   3. Assign the user a role (developer/stakeholder)")
      prompts.log.info("   4. Have the user login with their credentials")
      prompts.log.info("")
      return { success: false, error: "License key admin login not allowed - please use a user account" }
    }

    prompts.log.success("✓ Authorization verified!")
    if (user) {
      prompts.log.info(`   Welcome, ${user.username || user.email}!`)
    }
    prompts.log.info("")

    // Step 5: Fetch enterprise credentials
    prompts.log.step("Syncing enterprise credentials...")

    const credentialsResponse = await fetch(`${ENTERPRISE_API_URL}/api/auth/enterprise/credentials`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}` }
    })

    if (!credentialsResponse.ok) {
      const error = await credentialsResponse.json()
      return { success: false, error: error.error || "Failed to fetch enterprise credentials" }
    }

    const { credentials, servicenowInstances, mcpServerUrl, theme } = await credentialsResponse.json()

    // Step 6: Save configuration to enterprise.json
    // SECURITY: Only store JWT token and non-sensitive metadata.
    // Credentials (Jira, Azure, ServiceNow) are fetched server-side by enterprise MCP server.
    const enterpriseConfig = {
      token,
      customerId: customer.id,
      customerName: customer.name,
      company: customer.company,
      // NOTE: licenseKey, credentials, and servicenowInstances are NOT stored locally
      // They are fetched server-side by the enterprise MCP server using the JWT token
      mcpServerUrl,
      theme,  // Theme is safe to store (UI customization only, no secrets)
      lastSynced: Date.now()
    }

    // Ensure config directory exists
    const fs = await import("fs")
    if (!fs.existsSync(ENTERPRISE_CONFIG_DIR)) {
      fs.mkdirSync(ENTERPRISE_CONFIG_DIR, { recursive: true })
    }
    fs.writeFileSync(ENTERPRISE_CONFIG_FILE, JSON.stringify(enterpriseConfig, null, 2), "utf-8")

    prompts.log.success("✓ Enterprise credentials synced!")
    prompts.log.info("")

    // Return credentials for display purposes only (not stored locally)
    return {
      success: true,
      token,
      customer,
      credentials,  // For display only, not stored
      servicenowInstances: servicenowInstances || [],  // For display only, not stored
      mcpServerUrl,
      theme
    }

  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export const AuthCommand = cmd({
  command: "auth",
  describe: "manage credentials",
  builder: (yargs) =>
    yargs
      .command(AuthLoginCommand)
      .command(AuthLogoutCommand)
      .command(AuthListCommand)
      // Enterprise commands (license key auth)
      .command(AuthEnterpriseLoginCommand)
      .command(AuthEnterpriseSyncCommand)
      .command(AuthEnterpriseStatusCommand)
      .command(AuthEnterpriseThemeExportCommand)
      // Portal commands (email-based auth for Individual/Teams)
      .command(AuthPortalLoginCommand)
      .command(AuthPortalLogoutCommand)
      .command(AuthPortalStatusCommand)
      .command(AuthPortalRefreshCommand)
      .demandCommand(),
  async handler() {},
})

export const AuthListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list providers",
  async handler() {
    UI.empty()
    const authPath = path.join(Global.Path.data, "auth.json")
    const homedir = os.homedir()
    const displayPath = authPath.startsWith(homedir) ? authPath.replace(homedir, "~") : authPath
    prompts.intro(`Credentials ${UI.Style.TEXT_DIM}${displayPath}`)
    const results = await Auth.all().then((x) => Object.entries(x))
    const database = await ModelsDev.get()

    for (const [providerID, result] of results) {
      const name = database[providerID]?.name || providerID
      prompts.log.info(`${name} ${UI.Style.TEXT_DIM}${result.type}`)
    }

    prompts.outro(`${results.length} credentials`)

    // Environment variables section
    const activeEnvVars: Array<{ provider: string; envVar: string }> = []

    for (const [providerID, provider] of Object.entries(database)) {
      for (const envVar of provider.env) {
        if (process.env[envVar]) {
          activeEnvVars.push({
            provider: provider.name || providerID,
            envVar,
          })
        }
      }
    }

    if (activeEnvVars.length > 0) {
      UI.empty()
      prompts.intro("Environment")

      for (const { provider, envVar } of activeEnvVars) {
        prompts.log.info(`${provider} ${UI.Style.TEXT_DIM}${envVar}`)
      }

      prompts.outro(`${activeEnvVars.length} environment variable` + (activeEnvVars.length === 1 ? "" : "s"))
    }
  },
})

// Global verbose flag for detailed logging
let verboseMode = false

export const AuthLoginCommand = cmd({
  command: "login [url]",
  describe: "log in to a provider",
  builder: (yargs) =>
    yargs
      .positional("url", {
        describe: "opencode auth provider",
        type: "string",
      })
      .option("verbose", {
        describe: "enable verbose logging for debugging",
        type: "boolean",
        default: false,
      }),
  async handler(args) {
    verboseMode = args.verbose as boolean
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("Add credential")
        if (args.url) {
          const wellknown = await fetch(`${args.url}/.well-known/opencode`).then((x) => x.json())
          prompts.log.info(`Running \`${wellknown.auth.command.join(" ")}\``)
          const proc = Bun.spawn({
            cmd: wellknown.auth.command,
            stdout: "pipe",
          })
          const exit = await proc.exited
          if (exit !== 0) {
            prompts.log.error("Failed")
            prompts.outro("Done")
            await Instance.dispose()
            process.exit(0)
          }
          const token = await new Response(proc.stdout).text()
          await Auth.set(args.url, {
            type: "wellknown",
            key: wellknown.auth.env,
            token: token.trim(),
          })
          prompts.log.success("Logged into " + args.url)
          prompts.outro("Done")
          await Instance.dispose()
          process.exit(0)
        }
        // First ask what type of authentication they want
        const authCategory = await prompts.select({
          message: "What would you like to authenticate?",
          options: [
            {
              value: "complete",
              label: "Complete Setup",
              hint: "LLM + ServiceNow + Snow-Flow License (recommended)",
            },
            {
              value: "snow-flow",
              label: "Snow-Flow License",
              hint: "Individual/Teams or Enterprise license",
            },
            {
              value: "llm",
              label: "LLM Provider",
              hint: "Anthropic, OpenAI, etc.",
            },
            {
              value: "servicenow",
              label: "ServiceNow Instance",
              hint: "direct ServiceNow connection",
            },
          ],
        })

        if (prompts.isCancel(authCategory)) throw new UI.CancelledError()

        // Handle Snow-Flow License authentication (Individual/Teams or Enterprise)
        if (authCategory === "snow-flow") {
          prompts.log.step("Snow-Flow License Authentication")
          prompts.log.info("")

          const accountType = await prompts.select({
            message: "Select your account type",
            options: [
              {
                value: "portal",
                label: "Individual / Teams",
                hint: "email-based login (€99/mo or €79/seat)",
              },
              {
                value: "enterprise",
                label: "Enterprise",
                hint: "license key login (custom pricing)",
              },
            ],
          })

          if (prompts.isCancel(accountType)) throw new UI.CancelledError()

          if (accountType === "portal") {
            // Portal authentication (Individual/Teams)
            const authMethod = await prompts.select({
              message: "How would you like to authenticate?",
              options: [
                {
                  value: "browser",
                  label: "Browser",
                  hint: "recommended - opens browser for approval",
                },
                {
                  value: "email",
                  label: "Email & Password",
                  hint: "direct login",
                },
                {
                  value: "magic-link",
                  label: "Magic Link",
                  hint: "passwordless via email",
                },
              ],
            })

            if (prompts.isCancel(authMethod)) throw new UI.CancelledError()

            // Import and run portal auth flow
            const {
              AuthPortalLoginCommand
            } = await import("./auth-portal.js")

            prompts.outro("Starting portal authentication...")

            // Execute the appropriate auth flow based on method
            const portalArgs = { method: authMethod }
            await AuthPortalLoginCommand.handler(portalArgs as any)

            await Instance.dispose()
            process.exit(0)
          } else {
            // Enterprise authentication - device authorization flow (browser-based)
            // SECURITY: Uses JWT token, no credentials stored locally
            prompts.log.step("Snow-Flow Enterprise Login")
            prompts.log.info("Authenticate via browser (device authorization)")
            prompts.log.message("")

            // Run enterprise device authorization flow
            const enterpriseAuthResult = await performEnterpriseDeviceAuth()

            if (!enterpriseAuthResult.success) {
              prompts.log.error(`Enterprise authentication failed: ${enterpriseAuthResult.error}`)
              prompts.outro("Authentication failed")
              await Instance.dispose()
              process.exit(1)
            }

            // Store enterprise auth (JWT token only - no credentials locally)
            const machineId = generateMachineId()
            await Auth.set("enterprise", {
              type: "enterprise",
              enterpriseUrl: ENTERPRISE_API_URL,
              token: enterpriseAuthResult.token,
              machineId,
            })

            // Show success message
            prompts.log.info("")
            prompts.log.success(`Welcome to Snow-Flow Enterprise!`)
            if (enterpriseAuthResult.customer) {
              prompts.log.info(`Customer: ${enterpriseAuthResult.customer.name}`)
              prompts.log.info(`Company: ${enterpriseAuthResult.customer.company}`)
            }

            // Show available integrations (read-only, credentials are server-side)
            prompts.log.message("")
            prompts.log.info("Available Integrations (credentials managed server-side):")

            const creds = enterpriseAuthResult.credentials || {}
            let enabledServices: string[] = []

            if (creds.jira?.enabled) {
              prompts.log.message(`  • Jira`)
              enabledServices.push('jira')
            }
            if (creds["azure-devops"]?.enabled) {
              prompts.log.message(`  • Azure DevOps`)
              enabledServices.push('azdo')
            }
            if (creds.confluence?.enabled) {
              prompts.log.message(`  • Confluence`)
              enabledServices.push('confluence')
            }

            // Show ServiceNow instances
            if (enterpriseAuthResult.servicenowInstances && enterpriseAuthResult.servicenowInstances.length > 0) {
              prompts.log.message("")
              prompts.log.info("ServiceNow Instances:")
              for (const inst of enterpriseAuthResult.servicenowInstances) {
                const defaultTag = inst.isDefault ? " (default)" : ""
                prompts.log.message(`  • ${inst.instanceName} [${inst.environmentType}]${defaultTag}`)
              }
            }

            // Update documentation with enterprise features
            if (enabledServices.length > 0) {
              await updateDocumentationWithEnterprise(enabledServices)
            }

            // Configure MCP server with JWT token
            try {
              await updateEnterpriseMcpConfig(enterpriseAuthResult.token!, enterpriseAuthResult.mcpServerUrl || "https://enterprise.snow-flow.dev")
              prompts.log.info("")
              prompts.log.info("Added snow-flow-enterprise MCP server to config")
            } catch (error: any) {
              prompts.log.warn(`Failed to configure MCP server: ${error.message}`)
            }

            prompts.log.message("")
            prompts.log.info("ℹ️  Note: Credentials are managed server-side by the enterprise MCP server.")
            prompts.log.info("ℹ️  No sensitive data is stored locally.")
            prompts.log.message("")
            prompts.log.success("✅ Enterprise authentication complete!")
            prompts.log.success("📖 AGENTS.md configured with ServiceNow + Enterprise development guidelines")
            prompts.log.message("")
            prompts.log.info("Next steps:")
            prompts.log.message("")
            prompts.log.message('  • Just type your request in the TUI to start developing')
            prompts.outro("Done")
            await Instance.dispose()
            process.exit(0)
          }
        }

        // Track if this is a complete setup (chains all auth steps)
        const isCompleteSetup = authCategory === "complete"

        // Track if ServiceNow was configured via enterprise (skip manual config)
        let serviceNowConfiguredViaPortal = false
        let enterpriseResult: EnterpriseCredentialsResult | null = null

        // For complete setup: Ask about Snow-Flow account FIRST
        if (isCompleteSetup) {
          prompts.log.step("Step 1: Snow-Flow Account")
          prompts.log.info("")

          const accountType = await prompts.select({
            message: "Do you have a Snow-Flow account?",
            options: [
              {
                value: "enterprise",
                label: "Yes, Enterprise",
                hint: "browser login - auto-configures ServiceNow + credentials (recommended)",
              },
              {
                value: "manual",
                label: "No, manual setup",
                hint: "enter ServiceNow credentials manually",
              },
            ],
          })

          if (prompts.isCancel(accountType)) throw new UI.CancelledError()

          if (accountType === "enterprise") {
            // Run enterprise device authorization flow
            prompts.log.info("")
            enterpriseResult = await performEnterpriseDeviceAuth()

            if (!enterpriseResult.success) {
              prompts.log.error(`Enterprise authentication failed: ${enterpriseResult.error}`)
              prompts.outro("Setup cancelled")
              await Instance.dispose()
              process.exit(1)
            }

            // Show what was retrieved
            prompts.log.info("")
            prompts.log.info(UI.logoEnterprise("Connected"))
            prompts.log.info("")
            prompts.log.info(`   Customer: ${enterpriseResult.customer?.name}`)
            prompts.log.info(`   Company:  ${enterpriseResult.customer?.company}`)
            prompts.log.info("")

            // Show available tools
            if (enterpriseResult.credentials?.jira?.enabled) {
              prompts.log.info(`   ✓ Jira (${enterpriseResult.credentials.jira.baseUrl})`)
            }
            if (enterpriseResult.credentials?.["azure-devops"]?.enabled) {
              prompts.log.info(`   ✓ Azure DevOps (${enterpriseResult.credentials["azure-devops"].baseUrl})`)
            }
            if (enterpriseResult.credentials?.confluence?.enabled) {
              prompts.log.info(`   ✓ Confluence (${enterpriseResult.credentials.confluence.baseUrl})`)
            }

            // Show theme info if available
            if (enterpriseResult.theme) {
              prompts.log.info("")
              prompts.log.info("   Theme:")
              if (enterpriseResult.theme.brandName) {
                prompts.log.info(`   ✓ Brand: ${enterpriseResult.theme.brandName}`)
              }
              prompts.log.info(`   ✓ Colors: ${enterpriseResult.theme.primaryColor} / ${enterpriseResult.theme.secondaryColor} / ${enterpriseResult.theme.accentColor}`)
            }

            // Handle ServiceNow instances
            const instances = enterpriseResult.servicenowInstances || []

            if (instances.length > 0) {
              prompts.log.info("")
              prompts.log.info("   ServiceNow Instances:")
              for (const inst of instances) {
                const defaultTag = inst.isDefault ? " (default)" : ""
                prompts.log.info(`   ✓ ${inst.instanceName} [${inst.environmentType}]${defaultTag}`)
              }
              prompts.log.info("")

              // Select which instance to use
              let selectedInstance: ServiceNowInstanceFromPortal

              if (instances.length === 1) {
                // Only one instance, use it directly
                selectedInstance = instances[0]
                prompts.log.success(`   Using: ${selectedInstance.instanceName}`)
              } else {
                // Multiple instances, let user choose
                const instanceChoice = await prompts.select({
                  message: "Select ServiceNow instance to use:",
                  options: instances.map((inst) => ({
                    value: inst.id.toString(),
                    label: `${inst.instanceName} [${inst.environmentType}]`,
                    hint: inst.isDefault ? "default" : inst.instanceUrl,
                  })),
                })

                if (prompts.isCancel(instanceChoice)) throw new UI.CancelledError()

                selectedInstance = instances.find((i) => i.id.toString() === instanceChoice)!
                prompts.log.success(`   Selected: ${selectedInstance.instanceName}`)
              }

              // Configure ServiceNow with the selected instance
              const instanceUrl = selectedInstance.instanceUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")

              // Write to .env file
              await updateEnvFile([
                { key: "SNOW_INSTANCE", value: instanceUrl },
                { key: "SNOW_AUTH_METHOD", value: "oauth" },
                { key: "SNOW_CLIENT_ID", value: selectedInstance.clientId },
                { key: "SNOW_CLIENT_SECRET", value: selectedInstance.clientSecret },
              ])

              // Update SnowCode MCP configs
              await updateSnowCodeMCPConfigs(instanceUrl, selectedInstance.clientId, selectedInstance.clientSecret)

              prompts.log.success("✓ ServiceNow configured from portal!")
              serviceNowConfiguredViaPortal = true
            } else {
              prompts.log.warn("   No ServiceNow instances configured in portal")
              prompts.log.info("   You can add instances at: https://portal.snow-flow.dev/portal/servicenow")
              prompts.log.info("")
              // Will fall through to manual ServiceNow config
            }

            prompts.log.info("")
          }

          // Manual ServiceNow setup (if not configured via portal)
          if (!serviceNowConfiguredViaPortal) {
            prompts.log.step("Step 2: ServiceNow Configuration")
            prompts.log.info("Snow-Flow requires ServiceNow connection for development")
            prompts.log.message("")

            const snowInstance = (await prompts.text({
              message: "ServiceNow instance URL",
              placeholder: "dev12345.service-now.com",
              validate: (value) => {
                if (!value || value.trim() === "") return "Instance URL is required"
                if (!isValidServiceNowUrl(value)) {
                  return "Must be a ServiceNow domain (e.g., dev12345.service-now.com)"
                }
              },
            })) as string

            if (prompts.isCancel(snowInstance)) throw new UI.CancelledError()

            const snowAuthMethod = (await prompts.select({
              message: "Authentication method",
              options: [
                { value: "oauth", label: "OAuth 2.0", hint: "recommended - required for MID Server LLM" },
                { value: "basic", label: "Basic Auth", hint: "username/password" },
              ],
            })) as string

            if (prompts.isCancel(snowAuthMethod)) throw new UI.CancelledError()

            if (snowAuthMethod === "oauth") {
              const snowClientId = (await prompts.text({
                message: "OAuth Client ID",
                placeholder: "32-character hex string from ServiceNow",
                validate: (value) => {
                  if (!value || value.trim() === "") return "Client ID is required"
                  if (value.length < 32) return "Client ID too short (expected 32+ characters)"
                },
              })) as string

              if (prompts.isCancel(snowClientId)) throw new UI.CancelledError()

              const snowClientSecret = (await prompts.password({
                message: "OAuth Client Secret",
                validate: (value) => {
                  if (!value || value.trim() === "") return "Client Secret is required"
                  if (value.length < 32) return "Client Secret too short (expected 32+ characters)"
                },
              })) as string

              if (prompts.isCancel(snowClientSecret)) throw new UI.CancelledError()

              // Run OAuth flow for ServiceNow
              const oauth = new ServiceNowOAuth()
              const snowAuthResult = await oauth.authenticate({
                instance: snowInstance,
                clientId: snowClientId,
                clientSecret: snowClientSecret,
              })

              if (snowAuthResult.success) {
                // Write to .env file
                await updateEnvFile([
                  { key: "SNOW_INSTANCE", value: snowInstance },
                  { key: "SNOW_AUTH_METHOD", value: "oauth" },
                  { key: "SNOW_CLIENT_ID", value: snowClientId },
                  { key: "SNOW_CLIENT_SECRET", value: snowClientSecret },
                ])
                // Update SnowCode MCP configs
                await updateSnowCodeMCPConfigs(snowInstance, snowClientId, snowClientSecret)
                prompts.log.success("ServiceNow authentication successful!")
              } else {
                prompts.log.error(`ServiceNow authentication failed: ${snowAuthResult.error}`)
                prompts.outro("Setup cancelled")
                await Instance.dispose()
                process.exit(1)
              }
            } else {
              // Basic auth
              const snowUsername = (await prompts.text({
                message: "ServiceNow username",
                placeholder: "admin",
                validate: (value) => {
                  if (!value || value.trim() === "") return "Username is required"
                },
              })) as string

              if (prompts.isCancel(snowUsername)) throw new UI.CancelledError()

              const snowPassword = (await prompts.password({
                message: "ServiceNow password",
                validate: (value) => {
                  if (!value || value.trim() === "") return "Password is required"
                },
              })) as string

              if (prompts.isCancel(snowPassword)) throw new UI.CancelledError()

              // Save to Auth store
              await Auth.set("servicenow", {
                type: "servicenow-basic",
                instance: snowInstance,
                username: snowUsername,
                password: snowPassword,
              })

              // Write to .env file
              await updateEnvFile([
                { key: "SNOW_INSTANCE", value: snowInstance },
                { key: "SNOW_AUTH_METHOD", value: "basic" },
                { key: "SNOW_USERNAME", value: snowUsername },
                { key: "SNOW_PASSWORD", value: snowPassword },
              ])
              // Update MCP configs with instance only (no OAuth credentials)
              await updateSnowCodeMCPConfigs(snowInstance, "", "")

              prompts.log.success("ServiceNow credentials saved!")
            }
          }

          prompts.log.message("")
          prompts.log.step(serviceNowConfiguredViaPortal ? "Step 2: LLM Provider Configuration" : "Step 3: LLM Provider Configuration")
        }

        // LLM Provider authentication
        let provider: string = ""
        await ModelsDev.refresh().catch(() => {})
        const providers = await ModelsDev.get()

        if (authCategory === "llm" || authCategory === "complete") {
          const priority: Record<string, number> = {
            anthropic: 0,
            "github-copilot": 1,
            openai: 2,
            google: 3,
            openrouter: 4,
            vercel: 5,
            opencode: 99,
          }
          const selectedProvider = await prompts.autocomplete({
            message: "Select LLM provider",
            maxItems: 10,
            options: [
              ...pipe(
                providers,
                values(),
                sortBy(
                  (x) => priority[x.id] ?? 99,
                  (x) => x.name ?? x.id,
                ),
                map((x) => ({
                  label: x.name,
                  value: x.id,
                  hint: priority[x.id] === 0 ? "recommended" : undefined,
                })),
              ),
              {
                value: "other",
                label: "Other",
              },
              {
                value: "midserver-llm",
                label: "ServiceNow MID Server LLM",
                hint: "local LLM via MID Server (enterprise)",
              },
            ],
          })

          if (prompts.isCancel(selectedProvider)) throw new UI.CancelledError()
          provider = selectedProvider as string
        }

        // Handle direct ServiceNow authentication from category selection
        if (authCategory === "servicenow") {
          provider = "servicenow"
        }

        // Handle ServiceNow authentication
        if (provider === "servicenow") {
          prompts.log.step("ServiceNow Authentication")

          const instance = (await prompts.text({
            message: "ServiceNow instance URL",
            placeholder: "dev12345.service-now.com",
            validate: (value) => {
              if (!value || value.trim() === "") return "Instance URL is required"
              if (!isValidServiceNowUrl(value)) {
                return "Must be a ServiceNow domain (e.g., dev12345.service-now.com)"
              }
            },
          })) as string

          if (prompts.isCancel(instance)) throw new UI.CancelledError()

          const authMethod = (await prompts.select({
            message: "Authentication method",
            options: [
              { value: "oauth", label: "OAuth 2.0", hint: "recommended" },
              { value: "basic", label: "Basic Auth", hint: "username/password" },
            ],
          })) as string

          if (prompts.isCancel(authMethod)) throw new UI.CancelledError()

          if (authMethod === "oauth") {
            const clientId = (await prompts.text({
              message: "OAuth Client ID",
              placeholder: "32-character hex string from ServiceNow",
              validate: (value) => {
                if (!value || value.trim() === "") return "Client ID is required"
                if (value.length < 32) return "Client ID too short (expected 32+ characters)"
              },
            })) as string

            if (prompts.isCancel(clientId)) throw new UI.CancelledError()

            const clientSecret = (await prompts.password({
              message: "OAuth Client Secret",
              validate: (value) => {
                if (!value || value.trim() === "") return "Client Secret is required"
                if (value.length < 32) return "Client Secret too short (expected 32+ characters)"
              },
            })) as string

            if (prompts.isCancel(clientSecret)) throw new UI.CancelledError()

            // Run full OAuth flow
            const oauth = new ServiceNowOAuth()
            const result = await oauth.authenticate({
              instance,
              clientId,
              clientSecret,
            })

            if (result.success) {
              // Write to .env file
              await updateEnvFile([
                { key: "SNOW_INSTANCE", value: instance },
                { key: "SNOW_AUTH_METHOD", value: "oauth" },
                { key: "SNOW_CLIENT_ID", value: clientId },
                { key: "SNOW_CLIENT_SECRET", value: clientSecret },
              ])
              // Update SnowCode MCP configs
              await updateSnowCodeMCPConfigs(instance, clientId, clientSecret)
              prompts.log.success("ServiceNow authentication successful")
              prompts.log.info("Credentials saved to .env and SnowCode configs")
            } else {
              prompts.log.error(`Authentication failed: ${result.error}`)
            }
          } else {
            // Basic auth
            const username = (await prompts.text({
              message: "ServiceNow username",
              placeholder: "admin",
              validate: (value) => {
                if (!value || value.trim() === "") return "Username is required"
              },
            })) as string

            if (prompts.isCancel(username)) throw new UI.CancelledError()

            const password = (await prompts.password({
              message: "ServiceNow password",
              validate: (value) => {
                if (!value || value.trim() === "") return "Password is required"
              },
            })) as string

            if (prompts.isCancel(password)) throw new UI.CancelledError()

            // Save to Auth store
            await Auth.set("servicenow", {
              type: "servicenow-basic",
              instance,
              username,
              password,
            })

            // Write to .env file
            await updateEnvFile([
              { key: "SNOW_INSTANCE", value: instance },
              { key: "SNOW_AUTH_METHOD", value: "basic" },
              { key: "SNOW_USERNAME", value: username },
              { key: "SNOW_PASSWORD", value: password },
            ])
            // Note: Basic auth doesn't use OAuth, so we update MCP configs with instance only
            // MCP servers will use username/password from .env instead
            await updateSnowCodeMCPConfigs(instance, "", "")

            prompts.log.success("ServiceNow credentials saved")
            prompts.log.info("Credentials saved to .env and SnowCode configs")
          }

          // If this is a standalone ServiceNow setup (not complete), stop here
          if (authCategory === "servicenow") {
            prompts.log.message("")
            prompts.log.success("✅ ServiceNow authentication complete!")
            prompts.log.message("")
            prompts.log.info("Next steps:")
            prompts.log.message("")
            prompts.log.message('  • Just type your request in the TUI to start developing')
            prompts.log.message("  • Use /auth in the TUI to configure more credentials")
            prompts.outro("Done")
            await Instance.dispose()
            process.exit(0)
          }

          // For complete setup, ask about Snow-Flow License (optional)
          // Skip if already authenticated via enterprise in Step 1
          if (serviceNowConfiguredViaPortal && enterpriseResult?.success) {
            // Already authenticated via enterprise, skip this step
            prompts.log.message("")
            prompts.log.success("✅ Complete Setup finished!")
            prompts.log.message("")
            prompts.log.info("Configured:")
            prompts.log.message("  ✓ Snow-Flow Enterprise (license + Jira/Azure DevOps/Confluence)")
            prompts.log.message("  ✓ ServiceNow instance")
            prompts.log.message("  ✓ LLM Provider")
            prompts.log.success("📖 AGENTS.md configured with ServiceNow + Enterprise development guidelines")
            prompts.log.message("")
            prompts.log.info("Next steps:")
            prompts.log.message("")
            prompts.log.message('  • Just type your request in the TUI to start developing')
            prompts.outro("Done")
            await Instance.dispose()
            process.exit(0)
          }

          prompts.log.message("")
          const configureEnterprise = await prompts.confirm({
            message: "Configure Snow-Flow License? (optional - enables Jira, Azure DevOps, Confluence)",
            initialValue: false,
          })

          if (prompts.isCancel(configureEnterprise) || !configureEnterprise) {
            prompts.log.message("")
            prompts.log.success("✅ Authentication complete!")
            prompts.log.message("")
            prompts.log.info("Next steps:")
            prompts.log.message("")
            prompts.log.message('  • Just type your request in the TUI to start developing')
            prompts.log.message("  • Run: snow-flow auth list to see configured credentials")
            prompts.outro("Done")
            await Instance.dispose()
            process.exit(0)
          }

          // User wants Snow-Flow License, ask which type (same as standalone)
          prompts.log.message("")

          const accountType2 = await prompts.select({
            message: "Select your account type",
            options: [
              {
                value: "portal",
                label: "Individual / Teams",
                hint: "email-based login (€99/mo or €79/seat)",
              },
              {
                value: "enterprise",
                label: "Enterprise",
                hint: "license key login (custom pricing)",
              },
            ],
          })

          if (prompts.isCancel(accountType2)) throw new UI.CancelledError()

          if (accountType2 === "portal") {
            // Portal authentication (Individual/Teams) - same as standalone
            const authMethod = await prompts.select({
              message: "How would you like to authenticate?",
              options: [
                {
                  value: "browser",
                  label: "Browser",
                  hint: "recommended - opens browser for approval",
                },
                {
                  value: "email",
                  label: "Email & Password",
                  hint: "direct login",
                },
                {
                  value: "magic-link",
                  label: "Magic Link",
                  hint: "passwordless via email",
                },
              ],
            })

            if (prompts.isCancel(authMethod)) throw new UI.CancelledError()

            // Import and run portal auth flow
            const {
              AuthPortalLoginCommand
            } = await import("./auth-portal.js")

            prompts.outro("Starting portal authentication...")

            // Execute the appropriate auth flow based on method
            const portalArgs = { method: authMethod }
            await AuthPortalLoginCommand.handler(portalArgs as any)

            await Instance.dispose()
            process.exit(0)
          }

          // Enterprise - set provider and fall through
          provider = "enterprise"
          // Fall through to Enterprise handler below
        }

        // Handle Enterprise authentication (uses same flow as standalone)
        if (provider === "enterprise") {
          prompts.log.step("Snow-Flow Enterprise Login")
          prompts.log.info("Login with the credentials provided by your admin")
          prompts.log.message("")

          // Enterprise portal URL is fixed
          const portalUrl = "https://portal.snow-flow.dev"
          const mcpServerUrl = "https://enterprise.snow-flow.dev"

          let username: string = ""
          let password: string
          let authData: any
          const machineId = generateMachineId()

          // Login flow
          let loginSuccess = false

          while (!loginSuccess) {
            username = (await prompts.text({
              message: "Username",
              placeholder: "john.doe",
              validate: (value) => {
                if (!value || value.trim() === "") return "Username is required"
              },
            })) as string

            if (prompts.isCancel(username)) throw new UI.CancelledError()

            password = (await prompts.password({
              message: "Password",
              validate: (value) => {
                if (!value || value.trim() === "") return "Password is required"
              },
            })) as string

            if (prompts.isCancel(password)) throw new UI.CancelledError()

            prompts.log.message("")
            const spinner = prompts.spinner()
            spinner.start("Authenticating...")

            try {
              const response = await fetch(`${portalUrl}/api/user-auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
              })

              authData = await response.json()

              if (!response.ok || !authData.success) {
                spinner.stop("Authentication failed", 1)
                prompts.log.error(authData.error || "Invalid username or password")

                const tryAgain = await prompts.confirm({
                  message: "Would you like to try again?",
                  initialValue: true,
                })
                if (prompts.isCancel(tryAgain) || !tryAgain) {
                  prompts.outro("Login cancelled")
                  await Instance.dispose()
                  process.exit(1)
                }
                continue
              }

              spinner.stop("Authentication successful!")
              loginSuccess = true
            } catch (error: any) {
              spinner.stop("Connection error", 1)
              prompts.log.error(`Connection error: ${error.message}`)
              prompts.outro("Login cancelled")
              await Instance.dispose()
              process.exit(1)
            }
          }

          const role = authData.user?.role || "developer"
          const email = authData.user?.email
          const licenseKey = authData.customer?.licenseKey || ""

          // Store enterprise auth
          // SECURITY: Only store JWT token - never store license key locally
          await Auth.set("enterprise", {
            type: "enterprise",
            // NOTE: licenseKey is NOT stored - credentials are fetched server-side
            enterpriseUrl: portalUrl,
            token: authData.token,
            sessionToken: authData.sessionToken,
            username,
            email,
            role: authData.user?.role || role,
            machineId,
          })

          // NOTE: .env writes removed - credentials are fetched from Portal API by enterprise MCP server
          // JWT token is stored in MCP config, no need to store license key in .env

          prompts.log.success(`Welcome, ${username}!`)
          prompts.log.info(`Role: ${authData.user?.role || role}`)
          if (authData.customer?.company) {
            prompts.log.info(`Company: ${authData.customer.company}`)
          }

          // Fetch third-party tool credentials from portal (optional)
          prompts.log.message("")
          const fetchSpinner = prompts.spinner()
          fetchSpinner.start("Checking third-party tool integrations...")

          // Track enabled services for documentation generation
          let enabledServices: string[] = []

          // Check if we have a license key to fetch credentials
          if (!licenseKey) {
            fetchSpinner.stop("Could not fetch credentials (no license key)")
            prompts.log.warn("Your customer account may not have a license key configured")
          } else {
            const portalCredentials = await PortalSync.pullFromPortal(licenseKey, portalUrl)

            if (portalCredentials.success && portalCredentials.credentials) {
              const creds = portalCredentials.credentials
              const credCount = (creds.jira ? 1 : 0) + (creds.azureDevOps ? 1 : 0) + (creds.confluence ? 1 : 0)

              if (credCount > 0) {
                fetchSpinner.stop(`Found ${credCount} integration(s)`)
                if (creds.jira) prompts.log.message(`  • Jira: ${creds.jira.baseUrl}`)
                if (creds.azureDevOps) prompts.log.message(`  • Azure DevOps: ${creds.azureDevOps.org}`)
                if (creds.confluence) prompts.log.message(`  • Confluence: ${creds.confluence.baseUrl}`)

                // Build enabled services list based on fetched credentials
                if (creds.jira) enabledServices.push('jira')
                if (creds.azureDevOps) enabledServices.push('azdo')
                if (creds.confluence) enabledServices.push('confluence')
              } else {
                fetchSpinner.stop("No third-party integrations configured in portal")
              }
            } else {
              fetchSpinner.stop("Could not fetch credentials")
              if (portalCredentials.error) {
                prompts.log.warn(`Reason: ${portalCredentials.error}`)
              }
            }
          }

          // For stakeholders, replace docs with read-only version (regardless of integrations)
          await replaceDocumentationForStakeholder(role)

          // Update documentation with enterprise features based on enabled integrations
          if (enabledServices.length > 0) {
            await updateDocumentationWithEnterprise(enabledServices)
          }

          // Configure MCP server with JWT token (writes to all config locations)
          try {
            await updateEnterpriseMcpConfig(authData.token, mcpServerUrl)
            prompts.log.info("Added snow-flow-enterprise MCP server to config")
          } catch (error: any) {
            prompts.log.warn(`Failed to configure MCP server: ${error.message}`)
          }

          prompts.log.message("")
          prompts.log.success("✅ Enterprise authentication complete!")
          prompts.log.success("📖 AGENTS.md configured with ServiceNow + Enterprise development guidelines")
          prompts.log.message("")
          prompts.log.info("Next steps:")
          prompts.log.message("")
          prompts.log.message('  • Just type your request in the TUI to start developing')
          prompts.outro("Done")
          await Instance.dispose()
          process.exit(0)
        }

        // Model selection step - integrated into the auth flow
        let selectedModel: string | undefined
        if (
          provider !== "other" &&
          provider !== "amazon-bedrock" &&
          provider !== "google-vertex" &&
          provider !== "servicenow" &&
          provider !== "enterprise" &&
          provider !== "midserver-llm"
        ) {
          const providerData = providers[provider]
          if (providerData && providerData.models && Object.keys(providerData.models).length > 0) {
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
              // GPT-5 family (highest priority)
              if (model.id.includes('gpt-5')) {
                if (model.id.includes('pro')) return 5100
                if (model.id.includes('codex')) return 5090
                if (model.id === 'gpt-5') return 5080
                if (model.id.includes('mini')) return 5070
                if (model.id.includes('nano')) return 5060
                return 5000
              }
              // GPT-4.1 family
              if (model.id.includes('gpt-4.1')) {
                if (model.id.includes('mini')) return 4110
                return 4120
              }
              // GPT-4o family (4.x = 4000 + x*10)
              if (model.id.includes('gpt-4o')) {
                if (model.id.includes('mini')) return 4080
                return 4100
              }
              // GPT-4 family
              if (model.id.includes('gpt-4')) {
                if (model.id.includes('turbo')) return 4050
                return 4040
              }
              // O-series (o4 > o3 > o1)
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
              // GPT-3.5
              if (model.id.includes('gpt-3.5')) return 3500
              // Codex
              if (model.id.includes('codex')) return 3000
              // Default: use release date as fallback
              return parseInt(model.release_date.replace(/-/g, '')) || 0
            }

            // Custom sorting for Google (Gemini): newer versions first
            const extractGeminiVersion = (model: any): number => {
              const match = model.id.match(/gemini-(\d+)(?:\.(\d+))?/)
              if (!match) {
                // Fallback to release date
                return parseInt(model.release_date.replace(/-/g, '')) || 0
              }
              const major = parseInt(match[1]) || 0
              const minor = parseInt(match[2]) || 0
              return major * 100 + minor
            }

            const getSortKey = (provider: string) => {
              if (provider === "anthropic") return (x: any) => -extractAnthropicVersion(x)
              if (provider === "openai") return (x: any) => -extractOpenAIVersion(x)
              if (provider === "google") return (x: any) => -extractGeminiVersion(x)
              return (x: any) => -parseInt(x.release_date.replace(/-/g, '') || '0')
            }

            const modelOptions = pipe(
              providerData.models,
              values(),
              sortBy(
                (x) => (x.status === "alpha" || x.status === "beta" ? 1 : 0),
                getSortKey(provider),
              ),
              map((model) => {
                const contextWindow = model.limit.context ? ` (${(model.limit.context / 1000).toFixed(0)}K context)` : ""
                const status = model.status ? ` [${model.status}]` : ""
                return {
                  label: model.name + contextWindow + status,
                  value: model.id,
                  hint: model.experimental ? "experimental" : undefined,
                }
              }),
            )

            if (modelOptions.length > 0) {
              const modelChoice = await prompts.autocomplete({
                message: `Select default model for ${providerData.name}`,
                maxItems: 10,
                options: modelOptions,
              })

              if (!prompts.isCancel(modelChoice)) {
                selectedModel = `${provider}/${modelChoice}`
                prompts.log.success(`Default model: ${providerData.models[modelChoice]?.name}`)
              }
            }
          }
        }

        const plugin = await Plugin.list().then((x) => x.find((x) => x.auth?.provider === provider))
        if (plugin && plugin.auth) {
          let index = 0
          if (plugin.auth.methods.length > 1) {
            const method = await prompts.select({
              message: "Login method",
              options: [
                ...plugin.auth.methods.map((x: any, index: number) => ({
                  label: x.label,
                  value: index.toString(),
                })),
              ],
            })
            if (prompts.isCancel(method)) throw new UI.CancelledError()
            index = parseInt(method as string)
          }
          const method = plugin.auth.methods[index]
          if (method.type === "oauth") {
            await new Promise((resolve) => setTimeout(resolve, 10))
            const authorize = await method.authorize()

            if (authorize.url) {
              prompts.log.info("Go to: " + authorize.url)
            }

            if (authorize.method === "auto") {
              if (authorize.instructions) {
                prompts.log.info(authorize.instructions)
              }
              const spinner = prompts.spinner()
              spinner.start("Waiting for authorization...")
              const result = await authorize.callback()
              if (result.type === "failed") {
                spinner.stop("Failed to authorize", 1)
              }
              if (result.type === "success") {
                if ("refresh" in result) {
                  await Auth.set(provider, {
                    type: "oauth",
                    refresh: result.refresh,
                    access: result.access,
                    expires: result.expires,
                  })
                }
                if ("key" in result) {
                  await Auth.set(provider, {
                    type: "api",
                    key: result.key,
                  })
                }
                // Save provider config with baseURL to ensure correct API endpoint
                await saveProviderConfig(provider, providers[provider])
                spinner.stop("Login successful")
              }
            }

            if (authorize.method === "code") {
              const code = await prompts.text({
                message: "Paste the authorization code here: ",
                validate: (x) => (x && x.length > 0 ? undefined : "Required"),
              })
              if (prompts.isCancel(code)) throw new UI.CancelledError()
              const result = await authorize.callback(code)
              if (result.type === "failed") {
                prompts.log.error("Failed to authorize")
              }
              if (result.type === "success") {
                if ("refresh" in result) {
                  await Auth.set(provider, {
                    type: "oauth",
                    refresh: result.refresh,
                    access: result.access,
                    expires: result.expires,
                  })
                }
                if ("key" in result) {
                  await Auth.set(provider, {
                    type: "api",
                    key: result.key,
                  })
                }
                // Save provider config with baseURL to ensure correct API endpoint
                await saveProviderConfig(provider, providers[provider])
                prompts.log.success("Login successful")
              }
            }

            // Save selected model to global config if chosen
            if (selectedModel) {
              try {
                const globalConfigPath = path.join(os.homedir(), ".config", "snow-code", "config.json")
                let globalConfig = {}
                try {
                  const file = Bun.file(globalConfigPath)
                  if (await file.exists()) {
                    globalConfig = JSON.parse(await file.text())
                  }
                } catch {}
                globalConfig = { ...globalConfig, model: selectedModel }
                await Bun.write(globalConfigPath, JSON.stringify(globalConfig, null, 2))
                prompts.log.info(`Saved default model: ${selectedModel}`)
              } catch (err) {
                prompts.log.warn("Could not save model preference to config")
              }
            }

            // If this is a standalone LLM setup (not complete), stop here
            if (authCategory === "llm") {
              prompts.log.message("")
              prompts.log.success("✅ LLM Provider authentication complete!")
              prompts.log.message("")
              prompts.log.info("Next steps:")
              prompts.log.message("")
              prompts.log.message("  • Use /auth in the TUI to configure ServiceNow")
              prompts.log.message("  • Run: snow-code auth list to see configured credentials")
              prompts.outro("Done")
              await Instance.dispose()
              process.exit(0)
            }

            // For complete setup, ServiceNow is already configured at the start
            // Skip Snow-Flow License question if already configured via Enterprise in Step 1
            if (enterpriseResult?.success) {
              // Enterprise already configured, we're done!
              prompts.log.message("")
              prompts.log.success("✅ Authentication complete!")
              prompts.log.message("")
              prompts.log.info("Next steps:")
              prompts.log.message("")
              prompts.log.message('  • Just type your request in the TUI to start developing')
              prompts.log.message("  • Run: snow-code auth list to see configured credentials")
              prompts.outro("Done")
              await Instance.dispose()
              process.exit(0)
            }

            // Only ask about Snow-Flow License if not already configured
            prompts.log.message("")
            const configureEnterpriseAfterLLM = await prompts.confirm({
              message: "Configure Snow-Flow License? (optional - enables Jira, Azure DevOps, Confluence)",
              initialValue: false,
            })

            if (prompts.isCancel(configureEnterpriseAfterLLM) || !configureEnterpriseAfterLLM) {
              prompts.log.message("")
              prompts.log.success("✅ Authentication complete!")
              prompts.log.message("")
              prompts.log.info("Next steps:")
              prompts.log.message("")
              prompts.log.message('  • Just type your request in the TUI to start developing')
              prompts.log.message("  • Run: snow-flow auth list to see configured credentials")
              prompts.outro("Done")
              await Instance.dispose()
              process.exit(0)
            }

            // User wants Snow-Flow License, ask which type (same as standalone)
            prompts.log.message("")

            const accountTypeAfterLLM = await prompts.select({
              message: "Select your account type",
              options: [
                {
                  value: "portal",
                  label: "Individual / Teams",
                  hint: "email-based login (€99/mo or €79/seat)",
                },
                {
                  value: "enterprise",
                  label: "Enterprise",
                  hint: "license key login (custom pricing)",
                },
              ],
            })

            if (prompts.isCancel(accountTypeAfterLLM)) throw new UI.CancelledError()

            if (accountTypeAfterLLM === "portal") {
              // Portal authentication (Individual/Teams) - same as standalone
              const authMethodAfterLLM = await prompts.select({
                message: "How would you like to authenticate?",
                options: [
                  {
                    value: "browser",
                    label: "Browser",
                    hint: "recommended - opens browser for approval",
                  },
                  {
                    value: "email",
                    label: "Email & Password",
                    hint: "direct login",
                  },
                  {
                    value: "magic-link",
                    label: "Magic Link",
                    hint: "passwordless via email",
                  },
                ],
              })

              if (prompts.isCancel(authMethodAfterLLM)) throw new UI.CancelledError()

              // Import and run portal auth flow
              const {
                AuthPortalLoginCommand
              } = await import("./auth-portal.js")

              prompts.outro("Starting portal authentication...")

              // Execute the appropriate auth flow based on method
              const portalArgsAfterLLM = { method: authMethodAfterLLM }
              await AuthPortalLoginCommand.handler(portalArgsAfterLLM as any)

              await Instance.dispose()
              process.exit(0)
            }

            // Enterprise - simple username/password login (admin creates users)
            prompts.log.step("Snow-Flow Enterprise Login")
            prompts.log.info("Login with the credentials provided by your admin")
            prompts.log.message("")

            // Enterprise portal URL is fixed
            const enterprisePortalUrl = "https://portal.snow-flow.dev"
            const enterpriseMcpUrl = "https://enterprise.snow-flow.dev"

            let enterpriseUser: string = ""
            let enterprisePass: string
            let enterpriseAuthResult: any
            const enterpriseMachineId = generateMachineId()

            // Login flow
            let enterpriseLoginSuccess = false

            while (!enterpriseLoginSuccess) {
              enterpriseUser = (await prompts.text({
                message: "Username",
                placeholder: "john.doe",
                validate: (value) => {
                  if (!value || value.trim() === "") return "Username is required"
                },
              })) as string

              if (prompts.isCancel(enterpriseUser)) throw new UI.CancelledError()

              enterprisePass = (await prompts.password({
                message: "Password",
                validate: (value) => {
                  if (!value || value.trim() === "") return "Password is required"
                },
              })) as string

              if (prompts.isCancel(enterprisePass)) throw new UI.CancelledError()

              prompts.log.message("")
              const enterpriseSpinner = prompts.spinner()
              enterpriseSpinner.start("Authenticating...")

              try {
                const response = await fetch(`${enterprisePortalUrl}/api/user-auth/login`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ username: enterpriseUser, password: enterprisePass }),
                })

                enterpriseAuthResult = await response.json()

                if (!response.ok || !enterpriseAuthResult.success) {
                  enterpriseSpinner.stop("Authentication failed", 1)
                  prompts.log.error(enterpriseAuthResult.error || "Invalid username or password")

                  const tryAgainEnterprise = await prompts.confirm({
                    message: "Would you like to try again?",
                    initialValue: true,
                  })
                  if (prompts.isCancel(tryAgainEnterprise) || !tryAgainEnterprise) {
                    prompts.outro("Login cancelled")
                    await Instance.dispose()
                    process.exit(1)
                  }
                  continue
                }

                enterpriseSpinner.stop("Authentication successful!")
                enterpriseLoginSuccess = true
              } catch (error: any) {
                enterpriseSpinner.stop("Connection error", 1)
                prompts.log.error(`Connection error: ${error.message}`)
                prompts.outro("Login cancelled")
                await Instance.dispose()
                process.exit(1)
              }
            }

            const enterpriseRole = enterpriseAuthResult.user?.role || "developer"
            const enterpriseEmail = enterpriseAuthResult.user?.email
            const enterpriseLicenseKey = enterpriseAuthResult.customer?.licenseKey || ""

            // Store enterprise auth
            // SECURITY: Only store JWT token - never store license key locally
            await Auth.set("enterprise", {
              type: "enterprise",
              // NOTE: licenseKey is NOT stored - credentials are fetched server-side
              enterpriseUrl: enterprisePortalUrl,
              token: enterpriseAuthResult.token,
              sessionToken: enterpriseAuthResult.sessionToken,
              username: enterpriseUser,
              email: enterpriseEmail,
              role: enterpriseAuthResult.user?.role || enterpriseRole,
              machineId: enterpriseMachineId,
            })

            // NOTE: .env writes removed - credentials are fetched from Portal API by enterprise MCP server
            // JWT token is stored in MCP config, no need to store license key in .env

            prompts.log.success(`Welcome, ${enterpriseUser}!`)
            prompts.log.info(`Role: ${enterpriseAuthResult.user?.role || enterpriseRole}`)
            if (enterpriseAuthResult.customer?.company) {
              prompts.log.info(`Company: ${enterpriseAuthResult.customer.company}`)
            }

            // Fetch third-party tool credentials from portal (optional)
            prompts.log.message("")
            const enterpriseFetchSpinner = prompts.spinner()
            enterpriseFetchSpinner.start("Checking third-party tool integrations...")

            // Track enabled services for documentation generation
            let enabledServicesEnterprise: string[] = []

            // Check if we have a license key to fetch credentials
            if (!enterpriseLicenseKey) {
              enterpriseFetchSpinner.stop("Could not fetch credentials (no license key)")
              prompts.log.warn("Your customer account may not have a license key configured")
            } else {
              const enterprisePortalCredentials = await PortalSync.pullFromPortal(enterpriseLicenseKey, enterprisePortalUrl)

              if (enterprisePortalCredentials.success && enterprisePortalCredentials.credentials) {
                const creds = enterprisePortalCredentials.credentials
                const credCount = (creds.jira ? 1 : 0) + (creds.azureDevOps ? 1 : 0) + (creds.confluence ? 1 : 0)

                if (credCount > 0) {
                  enterpriseFetchSpinner.stop(`Found ${credCount} integration(s)`)
                  if (creds.jira) prompts.log.message(`  • Jira: ${creds.jira.baseUrl}`)
                  if (creds.azureDevOps) prompts.log.message(`  • Azure DevOps: ${creds.azureDevOps.org}`)
                  if (creds.confluence) prompts.log.message(`  • Confluence: ${creds.confluence.baseUrl}`)

                  // Build enabled services list based on fetched credentials
                  if (creds.jira) enabledServicesEnterprise.push('jira')
                  if (creds.azureDevOps) enabledServicesEnterprise.push('azdo')
                  if (creds.confluence) enabledServicesEnterprise.push('confluence')
                } else {
                  enterpriseFetchSpinner.stop("No third-party integrations configured in portal")
                }
              } else {
                enterpriseFetchSpinner.stop("Could not fetch credentials")
                if (enterprisePortalCredentials.error) {
                  prompts.log.warn(`Reason: ${enterprisePortalCredentials.error}`)
                }
              }
            }

            // For stakeholders, replace docs with read-only version (regardless of integrations)
            await replaceDocumentationForStakeholder(enterpriseRole)

            // Update documentation with enterprise features based on enabled integrations
            if (enabledServicesEnterprise.length > 0) {
              await updateDocumentationWithEnterprise(enabledServicesEnterprise)
            }

            // Configure MCP server with JWT token (writes to all config locations)
            try {
              await updateEnterpriseMcpConfig(enterpriseAuthResult.token, enterpriseMcpUrl)
              prompts.log.info("Added snow-flow-enterprise MCP server to config")
            } catch (error: any) {
              prompts.log.warn(`Failed to configure MCP server: ${error.message}`)
            }

            prompts.log.message("")
            prompts.log.success("✅ Enterprise authentication complete!")
            prompts.log.success("📖 AGENTS.md configured with ServiceNow + Enterprise development guidelines")
            prompts.log.message("")
            prompts.log.info("Next steps:")
            prompts.log.message("")
            prompts.log.message('  • Just type your request in the TUI to start developing')
            prompts.outro("Done")
            await Instance.dispose()
            process.exit(0)
          }
        }

        if (provider === "other") {
          const otherProvider = await prompts.text({
            message: "Enter provider id",
            validate: (x) => (x && x.match(/^[0-9a-z-]+$/) ? undefined : "a-z, 0-9 and hyphens only"),
          })
          if (prompts.isCancel(otherProvider)) throw new UI.CancelledError()
          provider = (otherProvider as string).replace(/^@ai-sdk\//, "")
          prompts.log.warn(
            `This only stores a credential for ${provider} - you will need configure it in opencode.json, check the docs for examples.`,
          )
        }

        if (provider === "amazon-bedrock") {
          prompts.log.info(
            "Amazon bedrock can be configured with standard AWS environment variables like AWS_BEARER_TOKEN_BEDROCK, AWS_PROFILE or AWS_ACCESS_KEY_ID",
          )
          prompts.log.message("")
          prompts.log.success("✅ Authentication complete!")
          prompts.log.message("")
          prompts.log.info("Next steps:")
          prompts.log.message("")
          prompts.log.message('  • Just type your request in the TUI to start developing')
          prompts.log.message("  • Run: snow-flow auth list to see configured credentials")
          prompts.outro("Done")
          await Instance.dispose()
          process.exit(0)
        }

        if (provider === "google-vertex") {
          prompts.log.info(
            "Google Cloud Vertex AI uses Application Default Credentials. Set GOOGLE_APPLICATION_CREDENTIALS or run 'gcloud auth application-default login'. Optionally set GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION (or VERTEX_LOCATION)",
          )
          prompts.log.message("")
          prompts.log.success("✅ Authentication complete!")
          prompts.log.message("")
          prompts.log.info("Next steps:")
          prompts.log.message("")
          prompts.log.message('  • Just type your request in the TUI to start developing')
          prompts.log.message("  • Run: snow-flow auth list to see configured credentials")
          prompts.outro("Done")
          await Instance.dispose()
          process.exit(0)
        }

        // Handle MID Server LLM configuration
        if (provider === "midserver-llm") {
          prompts.log.step("ServiceNow MID Server LLM Configuration")
          prompts.log.info("Configure access to local LLM models through ServiceNow MID Server")
          prompts.log.message("")
          prompts.log.info("This enables routing LLM requests through your MID Server to access")
          prompts.log.info("on-premise models (Ollama, vLLM, LocalAI) within your corporate network.")
          prompts.log.message("")

          // Clean up any invalid config before proceeding (prevents schema validation errors)
          const configCleanupPath = path.join(os.homedir(), ".config", "snow-code", "config.json")
          try {
            const configFile = Bun.file(configCleanupPath)
            if (await configFile.exists()) {
              const configContent = JSON.parse(await configFile.text())
              let configModified = false

              // Clean up invalid provider configurations (move unknown keys to options)
              if (configContent.provider) {
                const validProviderKeys = ["npm", "name", "options", "models", "api", "cost"]
                for (const [, providerConfig] of Object.entries(configContent.provider)) {
                  if (providerConfig && typeof providerConfig === "object") {
                    const config = providerConfig as Record<string, any>
                    const unknownKeys = Object.keys(config).filter((k) => !validProviderKeys.includes(k))
                    if (unknownKeys.length > 0) {
                      if (!config.options) config.options = {}
                      for (const key of unknownKeys) {
                        config.options[key] = config[key]
                        delete config[key]
                      }
                      configModified = true
                    }
                  }
                }
              }

              // Remove legacy root-level midServerLLM (now stored in provider.options)
              if (configContent.midServerLLM) {
                delete configContent.midServerLLM
                configModified = true
              }

              if (configModified) {
                await Bun.write(configCleanupPath, JSON.stringify(configContent, null, 2))
              }
            }
          } catch {
            // Ignore cleanup errors
          }

          // Check if ServiceNow is already configured
          const existingServiceNow = await Auth.get("servicenow")
          let serviceNowInstance = ""
          let hasOAuthCredentials = false

          if (existingServiceNow && existingServiceNow.type === "servicenow-oauth") {
            serviceNowInstance = existingServiceNow.instance
            hasOAuthCredentials = true
            prompts.log.success(`Using existing ServiceNow instance: ${serviceNowInstance}`)
          } else if (existingServiceNow && existingServiceNow.type === "servicenow-basic") {
            serviceNowInstance = existingServiceNow.instance
            hasOAuthCredentials = false
            prompts.log.success(`Using existing ServiceNow instance: ${serviceNowInstance}`)
            prompts.log.warn("Basic Auth detected - discovery and deployment require OAuth")
          } else {
            prompts.log.warn("ServiceNow not configured. OAuth is required for MID Server LLM.")
            const configureNow = await prompts.confirm({
              message: "Would you like to configure ServiceNow OAuth now?",
              initialValue: true,
            })
            if (prompts.isCancel(configureNow) || !configureNow) {
              prompts.outro("MID Server LLM setup cancelled")
              await Instance.dispose()
              process.exit(0)
            }

            // Get ServiceNow instance details
            serviceNowInstance = (await prompts.text({
              message: "ServiceNow instance URL",
              placeholder: "dev12345.service-now.com",
              validate: (value) => {
                if (!value || value.trim() === "") return "Instance URL is required"
                if (!isValidServiceNowUrl(value)) {
                  return "Must be a ServiceNow domain"
                }
              },
            })) as string
            if (prompts.isCancel(serviceNowInstance)) throw new UI.CancelledError()
          }

          // Ensure instance URL format
          const instanceUrl = serviceNowInstance.startsWith("http")
            ? serviceNowInstance
            : `https://${serviceNowInstance}`

          // Get ServiceNow OAuth credentials
          let accessToken: string | undefined
          let clientId: string | undefined
          let clientSecret: string | undefined

          if (existingServiceNow && existingServiceNow.type === "servicenow-oauth") {
            accessToken = existingServiceNow.accessToken
            clientId = existingServiceNow.clientId
            clientSecret = existingServiceNow.clientSecret

            // Check if token needs refresh
            if (existingServiceNow.expiresAt && existingServiceNow.expiresAt < Date.now()) {
              prompts.log.info("Refreshing ServiceNow access token...")
              const oauth = new ServiceNowOAuth()
              const refreshResult = await oauth.refreshAccessToken(
                instanceUrl,
                clientId,
                clientSecret,
                existingServiceNow.refreshToken!
              )
              if (refreshResult.success) {
                accessToken = refreshResult.accessToken

                // Persist the new access token and updated expiration
                const newExpiresAt = refreshResult.expiresIn
                  ? Date.now() + refreshResult.expiresIn * 1000
                  : Date.now() + 30 * 60 * 1000

                await Auth.set("servicenow", {
                  type: "servicenow-oauth",
                  instance: instanceUrl,
                  clientId: clientId!,
                  clientSecret: clientSecret!,
                  accessToken: refreshResult.accessToken!,
                  refreshToken: refreshResult.refreshToken || existingServiceNow.refreshToken,
                  expiresAt: newExpiresAt,
                })

                // Also update the servicenow-llm API key
                await Auth.set("servicenow-llm", {
                  type: "api",
                  key: refreshResult.accessToken!,
                })
                prompts.log.success("Token refreshed successfully")
              } else {
                prompts.log.warn("Token refresh failed, will need to re-authenticate")
                accessToken = undefined
              }
            }
          }

          // If we don't have OAuth credentials, ask for them
          if (!accessToken) {
            prompts.log.message("")
            prompts.log.step("ServiceNow Authentication Required")
            prompts.log.info("OAuth credentials needed for MID Server LLM configuration")

            clientId = (await prompts.text({
              message: "OAuth Client ID",
              placeholder: "32-character hex string from ServiceNow",
              validate: (value) => {
                if (!value || value.trim() === "") return "Client ID is required"
                if (value.length < 32) return "Client ID too short"
              },
            })) as string
            if (prompts.isCancel(clientId)) throw new UI.CancelledError()

            clientSecret = (await prompts.password({
              message: "OAuth Client Secret",
              validate: (value) => {
                if (!value || value.trim() === "") return "Client Secret is required"
              },
            })) as string
            if (prompts.isCancel(clientSecret)) throw new UI.CancelledError()

            // Run OAuth flow
            const oauth = new ServiceNowOAuth()
            const authResult = await oauth.authenticate({
              instance: instanceUrl,
              clientId,
              clientSecret,
            })

            if (!authResult.success) {
              prompts.log.error(`Authentication failed: ${authResult.error}`)
              prompts.outro("MID Server LLM setup cancelled")
              await Instance.dispose()
              process.exit(1)
            }

            accessToken = authResult.accessToken
            hasOAuthCredentials = true

            // Save the ServiceNow OAuth credentials for future use
            // This enables token refresh on subsequent runs
            const expiresAt = authResult.expiresIn
              ? Date.now() + authResult.expiresIn * 1000
              : Date.now() + 30 * 60 * 1000 // Default 30 minutes

            await Auth.set("servicenow", {
              type: "servicenow-oauth",
              instance: instanceUrl,
              clientId: clientId!,
              clientSecret: clientSecret!,
              accessToken: authResult.accessToken!,
              refreshToken: authResult.refreshToken,
              expiresAt: expiresAt,
            })
            prompts.log.success("ServiceNow OAuth credentials saved")
          }

          // ============================================================================
          // DISCOVERY MODE: Discover existing MID Servers and REST Messages
          // ============================================================================
          let selectedMidServer: string = ""
          let selectedRestMessage: string = ""
          let selectedHttpMethod: string = ""
          let selectedModel: string = ""
          let selectedContextWindow: number | undefined = undefined  // Model's max context length
          let selectedMaxTokens: number | undefined = undefined      // Recommended max output tokens
          let gatewayDeployed = false
          let connectivityTested = false
          let apiBaseUri: string = ""  // The actual API base URI from ServiceNow (includes namespace)

          prompts.log.message("")
          const discoverSpinner = prompts.spinner()
          discoverSpinner.start("Discovering MID Servers and LLM endpoints...")

          // Try to discover MID Servers
          const midServersResult = await discoverMidServers(instanceUrl, accessToken!)
          const restMessagesResult = await discoverRestMessages(instanceUrl, accessToken!)

          discoverSpinner.stop("Discovery complete")

          const hasMidServers = midServersResult.success && midServersResult.midServers && midServersResult.midServers.length > 0
          const hasRestMessages = restMessagesResult.success && restMessagesResult.restMessages && restMessagesResult.restMessages.length > 0

          if (hasMidServers && hasRestMessages) {
            // Discovery succeeded - show discovered options
            prompts.log.success(`Found ${midServersResult.midServers!.length} MID Server(s) and ${restMessagesResult.restMessages!.length} LLM REST Message(s)`)
            prompts.log.message("")

            // Select REST Message (which includes MID Server info)
            const restMessageOptions = restMessagesResult.restMessages!.map((rm) => ({
              value: rm.name,
              label: rm.name,
              hint: `MID: ${rm.mid_server || "default"} | ${rm.endpoint}`,
            }))

            selectedRestMessage = (await prompts.select({
              message: "Select LLM REST Message",
              options: restMessageOptions,
            })) as string
            if (prompts.isCancel(selectedRestMessage)) throw new UI.CancelledError()

            // Get the selected REST Message details
            const selectedRM = restMessagesResult.restMessages!.find((rm) => rm.name === selectedRestMessage)!
            selectedMidServer = selectedRM.mid_server || ""

            // Select HTTP Method if multiple available
            if (selectedRM.methods.length > 1) {
              const methodOptions = selectedRM.methods.map((m) => ({
                value: m.name,
                label: m.name,
                hint: m.http_method,
              }))

              selectedHttpMethod = (await prompts.select({
                message: "Select HTTP Method for chat completions",
                options: methodOptions,
              })) as string
              if (prompts.isCancel(selectedHttpMethod)) throw new UI.CancelledError()
            } else if (selectedRM.methods.length === 1) {
              selectedHttpMethod = selectedRM.methods[0].name
            } else {
              selectedHttpMethod = "Chat_Completions"
            }

            // Try to discover models from the LLM endpoint
            prompts.log.message("")
            const modelsSpinner = prompts.spinner()
            modelsSpinner.start("Querying available models from LLM...")

            const modelsResult = await discoverModels(instanceUrl, accessToken!, selectedRestMessage)
            modelsSpinner.stop(modelsResult.success ? "Models discovered" : "Could not query models")

            if (modelsResult.success && modelsResult.models && modelsResult.models.length > 0) {
              // Format context window for display (e.g., "40960" → "40K")
              const formatContextWindow = (ctx?: number) => {
                if (!ctx) return ""
                if (ctx >= 1000) return `${Math.round(ctx / 1000)}K ctx`
                return `${ctx} ctx`
              }

              const modelOptions = modelsResult.models.map((m) => ({
                value: m.id,
                label: m.name || m.id,
                hint: m.contextWindow ? formatContextWindow(m.contextWindow) : undefined,
              }))
              modelOptions.push({ value: "_manual_", label: "Enter model name manually", hint: undefined })

              const modelChoice = (await prompts.select({
                message: "Select model",
                options: modelOptions,
              })) as string
              if (prompts.isCancel(modelChoice)) throw new UI.CancelledError()

              if (modelChoice === "_manual_") {
                selectedModel = (await prompts.text({
                  message: "Model name",
                  placeholder: "e.g., llama3.3 or Qwen/Qwen3-1.7B",
                  validate: (v) => (!v || v.trim() === "") ? "Model name is required" : undefined,
                })) as string
                if (prompts.isCancel(selectedModel)) throw new UI.CancelledError()
              } else {
                selectedModel = modelChoice
                // Get the selected model's metadata from endpoint discovery
                const selectedModelInfo = modelsResult.models.find((m) => m.id === modelChoice)
                if (selectedModelInfo) {
                  selectedContextWindow = selectedModelInfo.contextWindow
                  selectedMaxTokens = selectedModelInfo.maxTokens
                }
              }
            } else {
              // Manual model input
              selectedModel = (await prompts.text({
                message: "Model name",
                placeholder: "e.g., llama3.3 or Qwen/Qwen3-1.7B",
                validate: (v) => (!v || v.trim() === "") ? "Model name is required" : undefined,
              })) as string
              if (prompts.isCancel(selectedModel)) throw new UI.CancelledError()
            }

            // ============================================================================
            // FALLBACK: Look up model metadata from models.dev if not from endpoint
            // ============================================================================
            if (!selectedContextWindow) {
              const lookupSpinner = prompts.spinner()
              lookupSpinner.start("Looking up model specifications in models.dev...")

              const modelsDevLookup = await lookupModelInModelsDev(selectedModel)

              if (modelsDevLookup.found && modelsDevLookup.contextWindow) {
                selectedContextWindow = modelsDevLookup.contextWindow
                selectedMaxTokens = modelsDevLookup.maxTokens || Math.min(4096, Math.floor(modelsDevLookup.contextWindow / 4))
                lookupSpinner.stop(`Found in models.dev: ${modelsDevLookup.matchedModel}`)
                prompts.log.info(`Context window: ${selectedContextWindow.toLocaleString()} tokens`)
                prompts.log.info(`Max output tokens: ${selectedMaxTokens.toLocaleString()}`)
              } else {
                lookupSpinner.stop("Model not found in models.dev")
                prompts.log.warn("Using conservative default: 4,096 max output tokens")
                prompts.log.info("Tip: You can manually configure token limits in ~/.config/snow-code/config.json")
                selectedMaxTokens = 4096
              }
            } else {
              // Show info from endpoint discovery
              prompts.log.info(`Context window: ${selectedContextWindow.toLocaleString()} tokens (from endpoint)`)
            }

            // Deploy Snow-Flow LLM API if not already deployed
            prompts.log.message("")
            const deployApi = await prompts.confirm({
              message: "Deploy/update Snow-Flow LLM API to ServiceNow?",
              initialValue: true,
            })

            if (!prompts.isCancel(deployApi) && deployApi) {
              const deploySpinner = prompts.spinner()
              deploySpinner.start("Deploying Snow-Flow LLM API...")

              const deployResult = await deploySnowFlowLLMAPI({
                instanceUrl,
                accessToken: accessToken!,
                restMessage: selectedRestMessage,
                httpMethod: selectedHttpMethod,
                defaultModel: selectedModel,
              })

              if (deployResult.success) {
                deploySpinner.stop("Snow-Flow LLM API deployed successfully!")
                gatewayDeployed = true
                apiBaseUri = deployResult.baseUri || ""
                if (apiBaseUri) {
                  prompts.log.info(`API endpoint: ${instanceUrl}${apiBaseUri}`)
                }
              } else {
                deploySpinner.stop(`Deployment failed: ${deployResult.error}`)
              }
            }

            // Test connectivity via Snow-Flow LLM API
            if (gatewayDeployed) {
              prompts.log.message("")
              const testChat = await prompts.confirm({
                message: "Test LLM chat through MID Server?",
                initialValue: true,
              })

              if (!prompts.isCancel(testChat) && testChat) {
                const testSpinner = prompts.spinner()
                testSpinner.start("Testing LLM chat via MID Server...")

                const testResult = await testSnowFlowLLMChat({
                  instanceUrl,
                  accessToken: accessToken!,
                  restMessage: selectedRestMessage,
                  httpMethod: selectedHttpMethod,
                  model: selectedModel,
                  apiBaseUri: apiBaseUri,
                })

                if (testResult.success) {
                  testSpinner.stop("LLM chat test passed!")
                  connectivityTested = true
                  if (testResult.response) {
                    prompts.log.info(`Response: "${testResult.response.substring(0, 100)}${testResult.response.length > 100 ? "..." : ""}"`)
                  }
                } else {
                  testSpinner.stop(`Test failed: ${testResult.error}`)
                  prompts.log.warn("The LLM endpoint may not be reachable from the MID Server")
                }
              }
            }
          } else if (hasMidServers) {
            // MID Servers found but no REST Messages configured
            prompts.log.info(`Found ${midServersResult.midServers!.length} MID Server(s), but no LLM REST Messages configured`)
            prompts.log.message("")
            prompts.log.error("❌ MID Server LLM setup cannot continue without REST Messages")
            prompts.log.message("")
            prompts.log.info("To use MID Server LLM, you need to:")
            prompts.log.message("  1. Create a REST Message in ServiceNow")
            prompts.log.message("  2. Configure it to use your MID Server")
            prompts.log.message("  3. Set up HTTP Methods for chat completions")
            prompts.log.message("")
            prompts.log.info("Documentation: https://docs.servicenow.com/bundle/washingtondc-api-reference/page/integrate/outbound-rest/task/t_CreateARESTMessage.html")
            prompts.log.message("")

            prompts.outro("MID Server LLM setup cancelled - no REST Messages configured")
            await Instance.dispose()
            process.exit(1)
          } else {
            // No MID Servers found
            prompts.log.message("")
            prompts.log.error("❌ No active MID Servers found in ServiceNow")
            prompts.log.message("")
            prompts.log.info("MID Server LLM requires:")
            prompts.log.message("  1. A MID Server installed and connected to your ServiceNow instance")
            prompts.log.message("  2. The MID Server must have status 'Up'")
            prompts.log.message("  3. Network access from MID Server to your local LLM endpoint")
            prompts.log.message("")
            prompts.log.info("Documentation: https://docs.servicenow.com/bundle/washingtondc-servicenow-platform/page/product/mid-server/concept/mid-server-landing.html")
            prompts.log.message("")

            prompts.outro("MID Server LLM setup cancelled - no MID Servers found")
            await Instance.dispose()
            process.exit(1)
          }

          // ============================================================================
          // SAVE CONFIGURATION
          // ============================================================================
          const globalConfigPath = path.join(os.homedir(), ".config", "snow-code", "config.json")
          let globalConfig: any = {}
          try {
            const file = Bun.file(globalConfigPath)
            if (await file.exists()) {
              globalConfig = JSON.parse(await file.text())
            }
          } catch {}

          // Clean up any invalid provider configurations
          if (globalConfig.provider) {
            const validProviderKeys = ["npm", "name", "options", "models", "api", "cost"]
            for (const [, providerConfig] of Object.entries(globalConfig.provider)) {
              if (providerConfig && typeof providerConfig === "object") {
                const config = providerConfig as Record<string, any>
                const unknownKeys = Object.keys(config).filter((k) => !validProviderKeys.includes(k))
                if (unknownKeys.length > 0) {
                  if (!config.options) config.options = {}
                  for (const key of unknownKeys) {
                    config.options[key] = config[key]
                    delete config[key]
                  }
                }
              }
            }
          }

          // Add the servicenow-llm provider configuration
          if (!globalConfig.provider) globalConfig.provider = {}

          // Use the actual API base URI from deployment (includes ServiceNow-generated namespace)
          // apiBaseUri is like "/api/1304151/snow_flow", resources are at "/llm/..."
          // So full baseURL for AI SDK is: instanceUrl + apiBaseUri + "/llm"
          const effectiveBaseUri = apiBaseUri ? `${apiBaseUri}/llm` : "/api/snow_flow/llm"

          // Create a friendly alias for the model (e.g., "Qwen/Qwen3-1.7B" → "qwen3-1.7b")
          // This allows users to use `servicenow-llm/qwen3` instead of the full path
          const createModelAlias = (modelId: string): string => {
            // Extract the model name part (after last /)
            const parts = modelId.split("/")
            const modelName = parts[parts.length - 1]
            // Normalize: lowercase, remove special chars except dots and dashes
            return modelName.toLowerCase().replace(/[^a-z0-9.-]/g, "")
          }

          const modelAlias = createModelAlias(selectedModel)
          const useAlias = modelAlias !== selectedModel.toLowerCase()

          // Build models config with both alias and original
          const modelsConfig: Record<string, any> = {}

          // Primary entry: use alias as key, store real ID
          // Use reasonable defaults if context window not discovered
          // Most modern LLMs have at least 8K context, many have 32K+
          const effectiveContextWindow = selectedContextWindow || 32000  // 32K default
          const effectiveMaxTokens = selectedMaxTokens || 4096

          if (useAlias) {
            modelsConfig[modelAlias] = {
              id: selectedModel,  // ← Real model ID for the endpoint
              name: `${selectedModel} (via MID Server)`,
              limit: {
                context: effectiveContextWindow,
                output: effectiveMaxTokens,
              },
            }
          }

          // Also add the full model ID as a direct entry (for backwards compatibility)
          modelsConfig[selectedModel] = {
            name: `${selectedModel} (via MID Server)`,
            limit: {
              context: effectiveContextWindow,
              output: effectiveMaxTokens,
            },
          }

          globalConfig.provider["servicenow-llm"] = {
            npm: "@ai-sdk/openai-compatible",
            name: "ServiceNow MID Server LLM",
            options: {
              baseURL: `${instanceUrl}${effectiveBaseUri}`,
              restMessage: selectedRestMessage,
              httpMethod: selectedHttpMethod,
              midServer: selectedMidServer,
              defaultModel: selectedModel,
              gatewayDeployed: gatewayDeployed,
              connectivityTested: connectivityTested,
            },
            models: modelsConfig,
          }

          // Remove legacy root-level midServerLLM if it exists
          if (globalConfig.midServerLLM) {
            delete globalConfig.midServerLLM
          }

          // Set default model to use the alias (shorter, friendlier)
          globalConfig.model = useAlias ? `servicenow-llm/${modelAlias}` : `servicenow-llm/${selectedModel}`

          await Bun.write(globalConfigPath, JSON.stringify(globalConfig, null, 2))

          // Save the ServiceNow access token as API key for servicenow-llm provider
          // This allows the @ai-sdk/openai-compatible SDK to authenticate with ServiceNow
          if (accessToken) {
            await Auth.set("servicenow-llm", {
              type: "api",
              key: accessToken,
            })
          }

          // ============================================================================
          // OUTPUT SUMMARY
          // ============================================================================
          prompts.log.message("")
          prompts.log.success("✅ MID Server LLM configuration complete!")
          prompts.log.message("")
          prompts.log.info("Configuration saved:")
          prompts.log.message(`  • MID Server: ${selectedMidServer}`)
          prompts.log.message(`  • REST Message: ${selectedRestMessage}`)
          prompts.log.message(`  • HTTP Method: ${selectedHttpMethod}`)
          prompts.log.message(`  • Model ID: ${selectedModel}`)
          if (useAlias) {
            prompts.log.message(`  • Model Alias: ${modelAlias}`)
          }
          if (selectedContextWindow) {
            prompts.log.message(`  • Context Window: ${selectedContextWindow.toLocaleString()} tokens`)
            prompts.log.message(`  • Max Output Tokens: ${(selectedMaxTokens || 4096).toLocaleString()} (auto-calculated)`)
          } else {
            prompts.log.message(`  • Max Output Tokens: ${(selectedMaxTokens || 4096).toLocaleString()} (default)`)
          }
          prompts.log.message(`  • API Deployed: ${gatewayDeployed ? "Yes" : "No"}`)
          prompts.log.message(`  • Connectivity Tested: ${connectivityTested ? "Yes" : "No"}`)

          if (gatewayDeployed) {
            prompts.log.message("")
            prompts.log.info("ServiceNow Snow-Flow LLM API:")
            prompts.log.message(`  ${instanceUrl}/sys_ws_definition.do?sysparm_query=service_id=snow_flow`)
          }

          // Show model usage examples
          prompts.log.message("")
          prompts.log.info("Model usage:")
          if (useAlias) {
            prompts.log.message(`  Default: servicenow-llm/${modelAlias}`)
            prompts.log.message(`  Full ID: servicenow-llm/${selectedModel}`)
          } else {
            prompts.log.message(`  Model: servicenow-llm/${selectedModel}`)
          }
          prompts.log.message("")

          if (gatewayDeployed && connectivityTested) {
            prompts.log.success("🚀 Ready to use! Run: snow-code agent \"<objective>\"")
          } else if (gatewayDeployed) {
            prompts.log.info("API deployed. Test connectivity manually or start using:")
            prompts.log.message('  snow-code agent "<objective>"')
          } else {
            prompts.log.info("Next steps:")
            prompts.log.message("  1. Deploy Snow-Flow LLM API: Use /auth in the TUI (select MID Server LLM again)")
            prompts.log.message('  2. Start developing: snow-code agent "<objective>"')
          }

          prompts.outro("Done")
          await Instance.dispose()
          process.exit(0)
        }

        if (provider === "opencode") {
          prompts.log.info("Create an api key at https://opencode.ai/auth")
        }

        if (provider === "vercel") {
          prompts.log.info("You can create an api key at https://vercel.link/ai-gateway-token")
        }

        const key = await prompts.password({
          message: "Enter your API key",
          validate: (x) => (x && x.length > 0 ? undefined : "Required"),
        })
        if (prompts.isCancel(key)) throw new UI.CancelledError()
        await Auth.set(provider, {
          type: "api",
          key,
        })

        // Save provider config with baseURL to ensure correct API endpoint
        await saveProviderConfig(provider, providers[provider])

        // Save selected model to global config if chosen
        if (selectedModel) {
          try {
            const globalConfigPath = path.join(os.homedir(), ".config", "snow-code", "config.json")
            let globalConfig = {}
            try {
              const file = Bun.file(globalConfigPath)
              if (await file.exists()) {
                globalConfig = JSON.parse(await file.text())
              }
            } catch {}
            globalConfig = { ...globalConfig, model: selectedModel }
            await Bun.write(globalConfigPath, JSON.stringify(globalConfig, null, 2))
            prompts.log.info(`Saved default model: ${selectedModel}`)
          } catch (err) {
            prompts.log.warn("Could not save model preference to config")
          }
        }

        // If this is a standalone LLM setup (not complete), stop here
        if (authCategory === "llm") {
          prompts.log.message("")
          prompts.log.success("✅ LLM Provider authentication complete!")
          prompts.log.message("")
          prompts.log.info("Next steps:")
          prompts.log.message("")
          prompts.log.message("  • Use /auth in the TUI to configure ServiceNow")
          prompts.log.message("  • Run: snow-code auth list to see configured credentials")
          prompts.outro("Done")
          await Instance.dispose()
          process.exit(0)
        }

        // For complete setup, ServiceNow is already configured at the start
        // Now ask about Snow-Flow License (optional)
        prompts.log.message("")
        const configureEnterpriseFinal = await prompts.confirm({
          message: "Configure Snow-Flow License? (optional - enables Jira, Azure DevOps, Confluence)",
          initialValue: false,
        })

        if (!prompts.isCancel(configureEnterpriseFinal) && configureEnterpriseFinal) {
          // User wants Snow-Flow License, ask which type (same as standalone)
          prompts.log.message("")

          const accountTypeFinal = await prompts.select({
            message: "Select your account type",
            options: [
              {
                value: "portal",
                label: "Individual / Teams",
                hint: "email-based login (€99/mo or €79/seat)",
              },
              {
                value: "enterprise",
                label: "Enterprise",
                hint: "license key login (custom pricing)",
              },
            ],
          })

          if (prompts.isCancel(accountTypeFinal)) throw new UI.CancelledError()

          if (accountTypeFinal === "portal") {
            // Portal authentication (Individual/Teams) - same as standalone
            const authMethodFinal = await prompts.select({
              message: "How would you like to authenticate?",
              options: [
                {
                  value: "browser",
                  label: "Browser",
                  hint: "recommended - opens browser for approval",
                },
                {
                  value: "email",
                  label: "Email & Password",
                  hint: "direct login",
                },
                {
                  value: "magic-link",
                  label: "Magic Link",
                  hint: "passwordless via email",
                },
              ],
            })

            if (prompts.isCancel(authMethodFinal)) throw new UI.CancelledError()

            // Import and run portal auth flow
            const {
              AuthPortalLoginCommand
            } = await import("./auth-portal.js")

            prompts.outro("Starting portal authentication...")

            // Execute the appropriate auth flow based on method
            const portalArgsFinal = { method: authMethodFinal }
            await AuthPortalLoginCommand.handler(portalArgsFinal as any)

            await Instance.dispose()
            process.exit(0)
          }

          // Enterprise - simple username/password login (admin creates users)
          prompts.log.step("Snow-Flow Enterprise Login")
          prompts.log.info("Login with the credentials provided by your admin")
          prompts.log.message("")

          // Enterprise portal URL is fixed
          const enterprisePortalUrlFinal = "https://portal.snow-flow.dev"
          const enterpriseMcpUrlFinal = "https://enterprise.snow-flow.dev"

          let enterpriseUserFinal: string = ""
          let enterprisePassFinal: string
          let enterpriseAuthResultFinal: any
          const enterpriseMachineIdFinal = generateMachineId()

          // Login flow
          let enterpriseLoginSuccessFinal = false

          while (!enterpriseLoginSuccessFinal) {
            enterpriseUserFinal = (await prompts.text({
              message: "Username",
              placeholder: "john.doe",
              validate: (value) => {
                if (!value || value.trim() === "") return "Username is required"
              },
            })) as string

            if (prompts.isCancel(enterpriseUserFinal)) throw new UI.CancelledError()

            enterprisePassFinal = (await prompts.password({
              message: "Password",
              validate: (value) => {
                if (!value || value.trim() === "") return "Password is required"
              },
            })) as string

            if (prompts.isCancel(enterprisePassFinal)) throw new UI.CancelledError()

            prompts.log.message("")
            const enterpriseSpinnerFinal = prompts.spinner()
            enterpriseSpinnerFinal.start("Authenticating...")

            try {
              const response = await fetch(`${enterprisePortalUrlFinal}/api/user-auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: enterpriseUserFinal, password: enterprisePassFinal }),
              })

              enterpriseAuthResultFinal = await response.json()

              if (!response.ok || !enterpriseAuthResultFinal.success) {
                enterpriseSpinnerFinal.stop("Authentication failed", 1)
                prompts.log.error(enterpriseAuthResultFinal.error || "Invalid username or password")

                const tryAgainFinal = await prompts.confirm({
                  message: "Would you like to try again?",
                  initialValue: true,
                })
                if (prompts.isCancel(tryAgainFinal) || !tryAgainFinal) {
                  prompts.outro("Login cancelled")
                  await Instance.dispose()
                  process.exit(1)
                }
                continue
              }

              enterpriseSpinnerFinal.stop("Authentication successful!")
              enterpriseLoginSuccessFinal = true
            } catch (error: any) {
              enterpriseSpinnerFinal.stop("Connection error", 1)
              prompts.log.error(`Connection error: ${error.message}`)
              prompts.outro("Login cancelled")
              await Instance.dispose()
              process.exit(1)
            }
          }

          const enterpriseRoleFinal = enterpriseAuthResultFinal.user?.role || "developer"
          const enterpriseEmailFinal = enterpriseAuthResultFinal.user?.email
          const enterpriseLicenseKeyFinal = enterpriseAuthResultFinal.customer?.licenseKey || ""

          // Store enterprise auth
          // SECURITY: Only store JWT token - never store license key locally
          await Auth.set("enterprise", {
            type: "enterprise",
            // NOTE: licenseKey is NOT stored - credentials are fetched server-side
            enterpriseUrl: enterprisePortalUrlFinal,
            token: enterpriseAuthResultFinal.token,
            sessionToken: enterpriseAuthResultFinal.sessionToken,
            username: enterpriseUserFinal,
            email: enterpriseEmailFinal,
            role: enterpriseAuthResultFinal.user?.role || enterpriseRoleFinal,
            machineId: enterpriseMachineIdFinal,
          })

          // NOTE: .env writes removed - credentials are fetched from Portal API by enterprise MCP server
          // JWT token is stored in MCP config, no need to store license key in .env

          prompts.log.success(`Welcome, ${enterpriseUserFinal}!`)
          prompts.log.info(`Role: ${enterpriseAuthResultFinal.user?.role || enterpriseRoleFinal}`)
          if (enterpriseAuthResultFinal.customer?.company) {
            prompts.log.info(`Company: ${enterpriseAuthResultFinal.customer.company}`)
          }

          // Fetch third-party tool credentials from portal (optional)
          prompts.log.message("")
          const enterpriseFetchSpinnerFinal = prompts.spinner()
          enterpriseFetchSpinnerFinal.start("Checking third-party tool integrations...")

          // Track enabled services for documentation generation
          let enabledServicesFinal: string[] = []

          // Check if we have a license key to fetch credentials
          if (!enterpriseLicenseKeyFinal) {
            enterpriseFetchSpinnerFinal.stop("Could not fetch credentials (no license key)")
            prompts.log.warn("Your customer account may not have a license key configured")
          } else {
            const enterprisePortalCredentialsFinal = await PortalSync.pullFromPortal(enterpriseLicenseKeyFinal, enterprisePortalUrlFinal)

            if (enterprisePortalCredentialsFinal.success && enterprisePortalCredentialsFinal.credentials) {
              const creds = enterprisePortalCredentialsFinal.credentials
              const credCount = (creds.jira ? 1 : 0) + (creds.azureDevOps ? 1 : 0) + (creds.confluence ? 1 : 0)

              if (credCount > 0) {
                enterpriseFetchSpinnerFinal.stop(`Found ${credCount} integration(s)`)
                if (creds.jira) prompts.log.message(`  • Jira: ${creds.jira.baseUrl}`)
                if (creds.azureDevOps) prompts.log.message(`  • Azure DevOps: ${creds.azureDevOps.org}`)
                if (creds.confluence) prompts.log.message(`  • Confluence: ${creds.confluence.baseUrl}`)

                // Build enabled services list based on fetched credentials
                if (creds.jira) enabledServicesFinal.push('jira')
                if (creds.azureDevOps) enabledServicesFinal.push('azdo')
                if (creds.confluence) enabledServicesFinal.push('confluence')
              } else {
                enterpriseFetchSpinnerFinal.stop("No third-party integrations configured in portal")
              }
            } else {
              enterpriseFetchSpinnerFinal.stop("Could not fetch credentials")
              if (enterprisePortalCredentialsFinal.error) {
                prompts.log.warn(`Reason: ${enterprisePortalCredentialsFinal.error}`)
              }
            }
          }

          // For stakeholders, replace docs with read-only version (regardless of integrations)
          await replaceDocumentationForStakeholder(enterpriseRoleFinal)

          // Update documentation with enterprise features based on enabled integrations
          if (enabledServicesFinal.length > 0) {
            await updateDocumentationWithEnterprise(enabledServicesFinal)
          }

          // Configure MCP server with JWT token (writes to all config locations)
          try {
            await updateEnterpriseMcpConfig(enterpriseAuthResultFinal.token, enterpriseMcpUrlFinal)
            prompts.log.info("Added snow-flow-enterprise MCP server to config")
          } catch (error: any) {
            prompts.log.warn(`Failed to configure MCP server: ${error.message}`)
          }

          prompts.log.message("")
          prompts.log.success("✅ Enterprise authentication complete!")
          prompts.log.success("📖 AGENTS.md configured with ServiceNow + Enterprise development guidelines")
          prompts.log.message("")
          prompts.log.info("Next steps:")
          prompts.log.message("")
          prompts.log.message('  • Just type your request in the TUI to start developing')
          prompts.outro("Done")
          await Instance.dispose()
          process.exit(0)
        }


        // If enterprise was not configured, show completion here
        prompts.log.message("")
        prompts.log.success("✅ Authentication complete!")
        prompts.log.message("")
        prompts.log.info("Next steps:")
        prompts.log.message("")
        prompts.log.message('  • Just type your request in the TUI to start developing')
        prompts.log.message("  • Run: snow-flow auth list to see configured credentials")
        prompts.outro("Done")
        await Instance.dispose()
        process.exit(0)
      },
    })
  },
})

export const AuthLogoutCommand = cmd({
  command: "logout",
  describe: "log out from a configured provider",
  async handler() {
    UI.empty()
    const credentials = await Auth.all().then((x) => Object.entries(x))
    prompts.intro("Remove credential")
    if (credentials.length === 0) {
      prompts.log.error("No credentials found")
      return
    }
    const database = await ModelsDev.get()
    const providerID = await prompts.select({
      message: "Select provider",
      options: credentials.map(([key, value]) => ({
        label: (database[key]?.name || key) + UI.Style.TEXT_DIM + " (" + value.type + ")",
        value: key,
      })),
    })
    if (prompts.isCancel(providerID)) throw new UI.CancelledError()
    await Auth.remove(providerID)
    prompts.outro("Logout successful")
  },
})
