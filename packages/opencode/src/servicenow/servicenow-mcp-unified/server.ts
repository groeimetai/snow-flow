/**
 * Unified ServiceNow MCP Server
 *
 * Consolidates 34 separate MCP servers into a single server with:
 * - Auto-discovery of 235+ tools
 * - Shared OAuth authentication
 * - Unified error handling
 * - Dynamic tool registration
 *
 * Security: Enterprise users get ServiceNow credentials fetched at runtime
 * from the enterprise portal - no local secrets stored.
 *
 * This eliminates ~15,000 LOC of duplicate code.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import https from 'https';
import http from 'http';

import { toolRegistry } from './shared/tool-registry.js';
import { authManager } from './shared/auth.js';
import { executeWithErrorHandling, SnowFlowError, classifyError } from './shared/error-handler.js';
import { ServiceNowContext, JWTPayload, MCPToolDefinition } from './shared/types.js';
import { extractJWTPayload, validatePermission, validateJWTExpiry, filterToolsByRole } from './shared/permission-validator.js';
import { MCPPromptManager } from '../shared/mcp-prompt-manager.js';
import { META_TOOLS, tool_search_exec, tool_execute_exec } from './tools/meta/index.js';
import { ToolSearch } from './shared/tool-search.js';

/**
 * ServiceNow Unified MCP Server
 */
export class ServiceNowUnifiedServer {
  private server: Server;
  private context: ServiceNowContext;
  private promptManager: MCPPromptManager;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'servicenow-unified',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          prompts: {}
        }
      }
    );

    // Initialize prompt manager for MCP prompts support
    this.promptManager = new MCPPromptManager('servicenow-unified');

    // Load ServiceNow context from environment
    this.context = this.loadContext();

    // Setup request handlers
    this.setupHandlers();
  }

  /**
   * Load ServiceNow credentials from auth.json files
   * Checks multiple possible locations in priority order
   * Returns undefined if no valid credentials found
   */
  private loadFromAuthJson(): ServiceNowContext | undefined {
    // Possible auth.json locations in priority order
    // NOTE: snow-code uses xdg-basedir which returns different paths per platform:
    // - macOS: ~/Library/Application Support/
    // - Linux: ~/.local/share/
    // - Windows: %APPDATA%
    const authPaths = [
      // 1. macOS: ~/Library/Application Support/snow-code/auth.json (XDG data dir on macOS)
      ...(process.platform === 'darwin'
        ? [path.join(os.homedir(), 'Library', 'Application Support', 'snow-code', 'auth.json')]
        : []),
      // 2. Windows: %APPDATA%/snow-code/auth.json
      ...(process.platform === 'win32' && process.env.APPDATA
        ? [path.join(process.env.APPDATA, 'snow-code', 'auth.json')]
        : []),
      // 3. Linux/fallback: ~/.local/share/snow-code/auth.json (XDG data dir on Linux)
      path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json'),
      // 4. Snow-Flow specific auth
      path.join(os.homedir(), '.snow-flow', 'auth.json'),
      // 5. OpenCode (fallback for compatibility)
      path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json'),
    ];

    for (const authPath of authPaths) {
      try {
        if (!fs.existsSync(authPath)) {
          continue;
        }

        const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

        // Check for servicenow credentials in auth.json structure
        let servicenowCreds = authData['servicenow'];

        // If not found, check if the root IS the servicenow config (for ~/.snow-flow/auth.json)
        if (!servicenowCreds && authData.instance && (authData.clientId || authData.username)) {
          servicenowCreds = authData;
        }

        if (!servicenowCreds) {
          continue;
        }

        // Validate credentials are not placeholders
        const isPlaceholder = (val?: string) => !val || val.includes('your-') || val.includes('placeholder');

        const instance = servicenowCreds.instance;
        const authType = servicenowCreds.type; // 'servicenow-oauth' or 'servicenow-basic'

        // Support both OAuth and Basic auth
        const clientId = servicenowCreds.clientId;
        const clientSecret = servicenowCreds.clientSecret;
        const username = servicenowCreds.username;
        const password = servicenowCreds.password;

        // Validate instance
        if (isPlaceholder(instance)) {
          continue;
        }

        // Check for valid OAuth credentials
        const hasValidOAuth = clientId && clientSecret &&
                             !isPlaceholder(clientId) && !isPlaceholder(clientSecret);

        // Check for valid Basic auth credentials
        const hasValidBasic = username && password &&
                             !isPlaceholder(username) && !isPlaceholder(password);

        // Need either valid OAuth OR valid Basic auth
        if (!hasValidOAuth && !hasValidBasic) {
          continue;
        }

        const effectiveAuthType = hasValidOAuth ? 'OAuth' : 'Basic';
        // Parse token expiry (from auth.json expiresAt field)
        let tokenExpiry: number | undefined;
        if (servicenowCreds.expiresAt) {
          tokenExpiry = typeof servicenowCreds.expiresAt === 'number'
            ? servicenowCreds.expiresAt
            : parseInt(servicenowCreds.expiresAt, 10);
        }

        console.error('[Auth] ✅ Loaded credentials from:', authPath);
        console.error('[Auth]    Instance:', instance);
        console.error('[Auth]    Auth Type:', effectiveAuthType);
        if (hasValidOAuth) {
          console.error('[Auth]    Client ID:', clientId ? '***' + clientId.slice(-4) : 'MISSING');
          console.error('[Auth]    Has Refresh Token:', !!servicenowCreds.refreshToken);
          console.error('[Auth]    Has Access Token:', !!servicenowCreds.accessToken);
          if (tokenExpiry) {
            const expiresIn = Math.round((tokenExpiry - Date.now()) / 1000 / 60);
            console.error('[Auth]    Token Expires In:', expiresIn > 0 ? `${expiresIn} minutes` : 'EXPIRED');
          }
        } else {
          console.error('[Auth]    Username:', username);
        }

        return {
          instanceUrl: instance.startsWith('http')
            ? instance
            : `https://${instance}`,
          clientId: hasValidOAuth ? clientId : '',
          clientSecret: hasValidOAuth ? clientSecret : '',
          accessToken: servicenowCreds.accessToken,
          refreshToken: servicenowCreds.refreshToken || servicenowCreds.refresh_token,
          tokenExpiry: tokenExpiry, // Pass token expiry so auth manager knows when to refresh
          username: hasValidBasic ? username : undefined,
          password: hasValidBasic ? password : undefined
        };
      } catch (error: any) {
        console.error('[Auth] Failed to load from', authPath, ':', error.message);
        continue;
      }
    }

    // No valid auth.json found
    console.error('[Auth] No valid auth.json found in any location');
    console.error('[Auth] Checked paths:');
    authPaths.forEach(p => console.error('[Auth]   -', p));
    return undefined;
  }

  /**
   * Enterprise auth data structure (from ~/.snow-flow/auth.json)
   */
  private loadEnterpriseAuth(): { jwt: string; portalUrl: string; subdomain?: string } | undefined {
    // Check for enterprise auth from device authorization flow
    const enterpriseAuthPaths = [
      // 1. Snow-Code enterprise config (from device auth flow)
      path.join(os.homedir(), '.snow-code', 'enterprise.json'),
      // 2. Snow-Flow enterprise auth (legacy)
      path.join(os.homedir(), '.snow-flow', 'auth.json'),
    ];

    for (const authPath of enterpriseAuthPaths) {
      try {
        if (!fs.existsSync(authPath)) {
          continue;
        }

        const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));

        // Check for JWT token in different possible structures
        let jwt: string | undefined;
        let subdomain: string | undefined;

        // Structure 1: { token: "jwt...", subdomain: "acme" } (snow-code device auth)
        if (authData.token) {
          jwt = authData.token;
          subdomain = authData.subdomain;
        }
        // Structure 2: { jwt: "jwt...", customer: { ... } } (snow-flow enterprise auth)
        else if (authData.jwt) {
          jwt = authData.jwt;
        }

        if (!jwt) {
          continue;
        }

        // Check if token is expired (basic check - full validation happens on portal)
        try {
          const payload = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64').toString());
          if (payload.exp && payload.exp * 1000 < Date.now()) {
            console.error('[Auth] Enterprise JWT expired, skipping enterprise portal fetch');
            continue;
          }
        } catch {
          // Can't parse JWT, skip
          continue;
        }

        // Determine portal URL based on subdomain
        let portalUrl = 'https://portal.snow-flow.dev';
        if (subdomain && subdomain !== 'portal') {
          portalUrl = `https://${subdomain}.snow-flow.dev`;
        }

        console.error('[Auth] Found enterprise auth from:', authPath);
        console.error('[Auth]   Portal URL:', portalUrl);
        return { jwt, portalUrl, subdomain };
      } catch (error: any) {
        console.error('[Auth] Failed to load enterprise auth from', authPath, ':', error.message);
        continue;
      }
    }

    return undefined;
  }

  /**
   * Fetch ServiceNow credentials from enterprise portal (runtime, no local secrets!)
   *
   * SECURITY: This is the preferred method for enterprise users.
   * ServiceNow credentials are fetched at runtime using the enterprise JWT,
   * so no client secrets are stored locally on the developer's machine.
   */
  private async loadFromEnterprisePortal(): Promise<ServiceNowContext | undefined> {
    const enterpriseAuth = this.loadEnterpriseAuth();
    if (!enterpriseAuth) {
      return undefined;
    }

    console.error('[Auth] 🔐 Fetching ServiceNow credentials from enterprise portal (secure mode)...');

    try {
      // Call the portal API to get ServiceNow credentials
      const response = await this.fetchFromPortal(
        `${enterpriseAuth.portalUrl}/api/user-credentials/servicenow/default`,
        enterpriseAuth.jwt
      );

      if (!response.success || !response.instance) {
        console.error('[Auth] Enterprise portal returned no ServiceNow instance');
        console.error('[Auth] Response:', JSON.stringify(response));
        return undefined;
      }

      const instance = response.instance;

      // Validate required fields
      if (!instance.instanceUrl || !instance.clientId || !instance.clientSecret) {
        console.error('[Auth] Enterprise portal returned incomplete credentials');
        return undefined;
      }

      console.error('[Auth] ✅ Fetched ServiceNow credentials from enterprise portal');
      console.error('[Auth]    Instance:', instance.instanceUrl);
      console.error('[Auth]    Client ID:', instance.clientId ? '***' + instance.clientId.slice(-4) : 'MISSING');
      console.error('[Auth]    Environment:', instance.environmentType || 'unknown');

      return {
        instanceUrl: instance.instanceUrl,
        clientId: instance.clientId,
        clientSecret: instance.clientSecret,
        refreshToken: undefined, // Enterprise uses M2M OAuth, no refresh token needed
        username: undefined,
        password: undefined,
        enterprise: {
          tier: 'enterprise',
          company: enterpriseAuth.subdomain,
          features: ['secure-credentials', 'runtime-fetch'],
        }
      };
    } catch (error: any) {
      console.error('[Auth] Failed to fetch credentials from enterprise portal:', error.message);
      return undefined;
    }
  }

  /**
   * Make HTTPS request to enterprise portal
   */
  private fetchFromPortal(url: string, jwt: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const httpModule = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${jwt}`,
          'Accept': 'application/json',
          'User-Agent': 'Snow-Flow-MCP/1.0'
        }
      };

      const req = httpModule.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode === 401 || res.statusCode === 403) {
              reject(new Error('Unauthorized - enterprise JWT may be expired'));
              return;
            }
            if (res.statusCode !== 200) {
              reject(new Error(`Portal returned status ${res.statusCode}: ${data}`));
              return;
            }
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e: any) {
            reject(new Error(`Failed to parse portal response: ${e.message}`));
          }
        });
      });

      req.on('error', (e) => {
        reject(new Error(`Portal request failed: ${e.message}`));
      });

      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Portal request timed out'));
      });

      req.end();
    });
  }

  /**
   * Load ServiceNow context from environment variables OR auth.json fallback
   * Note: Server will start even without credentials (unauthenticated mode)
   *
   * Priority (for synchronous loading):
   * 1. Environment variables (SERVICENOW_* or SNOW_*)
   * 2. snow-code auth.json (platform-specific XDG path + fallbacks)
   * 3. Unauthenticated mode (empty credentials)
   *
   * Note: Enterprise portal fetch (highest priority) happens in initialize() because it's async
   */
  private loadContext(): ServiceNowContext {
    // STEP 1: Try environment variables first
    // Handle SNOW_INSTANCE with or without https:// prefix to avoid double-prefix issue
    const snowInstance = process.env.SNOW_INSTANCE;
    const normalizedSnowInstance = snowInstance
      ? (snowInstance.startsWith('http://') || snowInstance.startsWith('https://')
          ? snowInstance
          : `https://${snowInstance}`)
      : undefined;
    const instanceUrl = process.env.SERVICENOW_INSTANCE_URL || normalizedSnowInstance;
    const clientId = process.env.SERVICENOW_CLIENT_ID || process.env.SNOW_CLIENT_ID;
    const clientSecret = process.env.SERVICENOW_CLIENT_SECRET || process.env.SNOW_CLIENT_SECRET;
    const refreshToken = process.env.SERVICENOW_REFRESH_TOKEN || process.env.SNOW_REFRESH_TOKEN;
    const username = process.env.SERVICENOW_USERNAME || process.env.SNOW_USERNAME;
    const password = process.env.SERVICENOW_PASSWORD || process.env.SNOW_PASSWORD;

    // Helper: Convert empty strings to undefined (treat empty as missing)
    const normalizeCredential = (val?: string) => val && val.trim() !== '' ? val : undefined;

    // Check for placeholder values
    const isPlaceholder = (val?: string) => !val || val.includes('your-') || val.includes('placeholder');

    // Check if env vars are valid
    const hasValidEnvVars = instanceUrl && clientId && clientSecret &&
                           !isPlaceholder(instanceUrl) &&
                           !isPlaceholder(clientId) &&
                           !isPlaceholder(clientSecret);

    if (hasValidEnvVars) {
      console.error('[Auth] Using credentials from environment variables');
      return {
        instanceUrl: instanceUrl!,
        clientId: clientId!,
        clientSecret: clientSecret!,
        refreshToken: normalizeCredential(refreshToken),
        username: normalizeCredential(username),
        password: normalizeCredential(password)
      };
    }

    // STEP 2: Try snow-code auth.json fallback (free users / local credentials)
    const authJsonContext = this.loadFromAuthJson();
    if (authJsonContext) {
      return authJsonContext;
    }

    // STEP 3: No valid credentials found - start in unauthenticated mode
    // Note: Enterprise users will get credentials from portal in initialize()
    console.error('[Auth] No local ServiceNow credentials found');
    console.error('[Auth] Checked:');
    console.error('[Auth]   1. Environment variables (SERVICENOW_* or SNOW_*)');
    console.error('[Auth]   2. snow-code auth.json (see logged paths above)');
    console.error('[Auth] Will attempt enterprise portal fetch in initialize()...');

    // Return empty context - may be updated in initialize() if enterprise auth exists
    return {
      instanceUrl: '',
      clientId: '',
      clientSecret: '',
      refreshToken: undefined,
      username: undefined,
      password: undefined
    };
  }

  /**
   * Check if current context has valid credentials (OAuth or Basic auth)
   */
  private hasValidCredentials(): boolean {
    // Must have instance URL
    if (!this.context.instanceUrl) {
      return false;
    }

    // Check for valid OAuth credentials
    const hasOAuth = !!(this.context.clientId && this.context.clientSecret);

    // Check for valid Basic auth credentials
    const hasBasic = !!(this.context.username && this.context.password);

    return hasOAuth || hasBasic;
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools (filtered by lazy mode, domains, session, and/or user role)
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      // 🆕 Lazy loading via SNOW_LAZY_TOOLS env var
      // This dramatically reduces token usage from ~71k to ~2k by only exposing meta-tools
      // AI uses tool_search + tool_execute to access all 235+ tools dynamically
      const lazyToolsEnabled = process.env.SNOW_LAZY_TOOLS === 'true';

      // Extract sessionId for session-based filtering
      const jwtPayloadForSession = extractJWTPayload((request as any).headers);
      const sessionId = jwtPayloadForSession?.sessionId ||
                        (request as any).headers?.['x-session-id'] ||
                        process.env.SNOW_SESSION_ID;

      if (lazyToolsEnabled) {
        console.error('[Server] 🚀 LAZY TOOLS MODE ACTIVE');
        console.error('[Server]   Only tool_search + tool_execute exposed (~2k tokens)');
        console.error('[Server]   All 235+ tools accessible via tool_execute');

        // In lazy mode with session filtering enabled, we can optionally show enabled tools
        // This is controlled by SNOW_LAZY_SHOW_ENABLED=true
        const showEnabledTools = process.env.SNOW_LAZY_SHOW_ENABLED === 'true';
        if (showEnabledTools && sessionId) {
          const enabledToolIds = await ToolSearch.getEnabledTools(sessionId);
          if (enabledToolIds.size > 0) {
            console.error(`[Server]   Session ${sessionId} has ${enabledToolIds.size} enabled tools`);

            // Get definitions for enabled tools
            const enabledToolDefs: MCPToolDefinition[] = [];
            for (const toolId of enabledToolIds) {
              const tool = toolRegistry.getTool(toolId);
              if (tool) {
                enabledToolDefs.push(tool.definition);
              }
            }

            // Return meta-tools + enabled tools
            const metaToolDefs = META_TOOLS.map(t => t.definition);
            const allDefs = [...metaToolDefs, ...enabledToolDefs];

            return {
              tools: allDefs.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              }))
            };
          }
        }

        // Standard lazy mode: just meta-tools
        const metaToolDefs = META_TOOLS.map(t => t.definition);
        return {
          tools: metaToolDefs.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        };
      }

      // 🆕 Domain filtering via SNOW_TOOL_DOMAINS env var
      // This reduces token usage when using MCP with external clients like Claude Code
      // Example: SNOW_TOOL_DOMAINS=operations,deployment,cmdb
      const toolDomainsEnv = process.env.SNOW_TOOL_DOMAINS;

      let allTools: MCPToolDefinition[];
      if (toolDomainsEnv) {
        const requestedDomains = toolDomainsEnv.split(',').map(d => d.trim()).filter(Boolean);
        const availableDomains = toolRegistry.getAvailableDomains();

        // Validate requested domains
        const invalidDomains = requestedDomains.filter(d => !availableDomains.includes(d.toLowerCase()));
        if (invalidDomains.length > 0) {
          console.error(`[Server] ⚠️  Unknown domains in SNOW_TOOL_DOMAINS: ${invalidDomains.join(', ')}`);
          console.error(`[Server]    Available domains: ${availableDomains.join(', ')}`);
        }

        allTools = toolRegistry.getToolDefinitionsByDomains(requestedDomains);
        console.error(`[Server] Domain filtering enabled: ${requestedDomains.join(', ')}`);
        console.error(`[Server]   Tools loaded: ${allTools.length} (from ${requestedDomains.length} domains)`);
      } else {
        allTools = toolRegistry.getToolDefinitions();
      }

      // 🆕 Phase 2: Role-based tool filtering
      const jwtPayload = extractJWTPayload((request as any).headers);
      const userRole = jwtPayload?.role || 'developer';
      const filteredTools = filterToolsByRole(allTools, jwtPayload);

      const totalAvailable = toolRegistry.getToolDefinitions().length;
      console.error(
        `[Server] Listing ${filteredTools.length}/${totalAvailable} tools` +
        (toolDomainsEnv ? ` (domains: ${toolDomainsEnv})` : '') +
        ` for role: ${userRole}`
      );

      return {
        tools: filteredTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    });

    // Execute tool
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Enhanced logging: show tool name AND key parameters
      const logArgs = this.formatArgsForLogging(args);
      console.error(`[Server] Executing tool: ${name}`);
      if (logArgs) {
        console.error(`[Server]   Parameters: ${logArgs}`);
      }

      // Extract sessionId from JWT payload or headers for session-based tool enabling
      const jwtPayloadForSession = extractJWTPayload((request as any).headers);
      const sessionId = jwtPayloadForSession?.sessionId ||
                        (request as any).headers?.['x-session-id'] ||
                        process.env.SNOW_SESSION_ID;

      try {
        // 🆕 Handle meta-tools (tool_search, tool_execute) for lazy loading mode
        if (name === 'tool_search') {
          console.error('[Server] Executing meta-tool: tool_search');
          // Pass sessionId to enable session-based tool enabling
          const contextWithSession = { ...this.context, sessionId };
          const result = await tool_search_exec(args as any, contextWithSession);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        if (name === 'tool_execute') {
          console.error('[Server] Executing meta-tool: tool_execute');
          // Pass sessionId for potential future use
          const contextWithSession = { ...this.context, sessionId };
          const result = await tool_execute_exec(args as any, contextWithSession);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          };
        }

        // Get tool from registry
        const tool = toolRegistry.getTool(name);
        if (!tool) {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Tool not found: ${name}`
          );
        }

        // 🆕 Phase 2: Permission validation before execution
        const jwtPayload = extractJWTPayload((request as any).headers);
        validateJWTExpiry(jwtPayload);
        validatePermission(tool.definition, jwtPayload);

        // Execute tool with error handling (permission check passed!)
        const result = await executeWithErrorHandling(
          name,
          async () => {
            return await tool.executor(args, this.context);
          },
          {
            retry: this.isRetryableOperation(name),
            context: {
              args,
              instanceUrl: this.context.instanceUrl
            }
          }
        );

        // Return result in MCP format
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };

      } catch (error: any) {
        console.error(`[Server] Tool execution failed: ${name}`, error.message);

        // Ensure error is properly classified as SnowFlowError before calling toToolResult()
        const snowFlowError = error instanceof SnowFlowError
          ? error
          : classifyError(error);

        throw new McpError(
          ErrorCode.InternalError,
          snowFlowError.message,
          snowFlowError.toToolResult()
        );
      }
    });

    // ========== MCP PROMPTS SUPPORT ==========

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = this.promptManager.listPrompts();
      console.error(`[Server] Listing ${prompts.length} prompts`);

      return {
        prompts: prompts.map(prompt => ({
          name: prompt.name,
          description: prompt.description,
          arguments: prompt.arguments?.map(arg => ({
            name: arg.name,
            description: arg.description,
            required: arg.required
          }))
        }))
      };
    });

    // Get and execute a specific prompt
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`[Server] Getting prompt: ${name}`);

      try {
        const prompt = this.promptManager.getPrompt(name);
        if (!prompt) {
          throw new McpError(
            ErrorCode.InvalidRequest,
            `Prompt not found: ${name}`
          );
        }

        // Execute the prompt to get the messages
        const result = await this.promptManager.executePrompt(
          name,
          (args as Record<string, string>) || {}
        );

        return {
          description: result.description || prompt.description,
          messages: result.messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        };
      } catch (error: any) {
        console.error(`[Server] Prompt execution failed: ${name}`, error.message);
        throw new McpError(
          ErrorCode.InternalError,
          error.message
        );
      }
    });

    // Error handler
    this.server.onerror = (error) => {
      console.error('[Server] MCP Error:', error);
    };
  }

  /**
   * Format arguments for logging (show key parameters without overwhelming output)
   */
  private formatArgsForLogging(args: any): string {
    if (!args || typeof args !== 'object') {
      return '';
    }

    const parts: string[] = [];
    const maxValueLength = 100; // Truncate long values

    // Helper: truncate long strings
    const truncate = (value: any): string => {
      const str = String(value);
      if (str.length > maxValueLength) {
        return str.substring(0, maxValueLength) + '...';
      }
      return str;
    };

    // Helper: format value for display
    const formatValue = (value: any): string => {
      if (value === null || value === undefined) {
        return 'null';
      }
      if (typeof value === 'object') {
        // For objects/arrays, show just the type
        if (Array.isArray(value)) {
          return `Array(${value.length})`;
        }
        return `{${Object.keys(value).length} keys}`;
      }
      return truncate(value);
    };

    // Show key parameters (up to 5 most relevant ones)
    const keyParams = ['table', 'query', 'action', 'sys_id', 'name', 'type', 'identifier'];
    const shownParams = new Set<string>();

    // First, show key parameters if they exist
    for (const key of keyParams) {
      if (key in args && shownParams.size < 5) {
        parts.push(`${key}=${formatValue(args[key])}`);
        shownParams.add(key);
      }
    }

    // Then, show remaining parameters (up to 5 total)
    for (const [key, value] of Object.entries(args)) {
      if (shownParams.size >= 5) break;
      if (!shownParams.has(key) && !['script', 'template', 'client_script', 'server_script', 'css'].includes(key)) {
        parts.push(`${key}=${formatValue(value)}`);
        shownParams.add(key);
      }
    }

    // Show count of additional parameters if any
    const totalParams = Object.keys(args).length;
    if (totalParams > shownParams.size) {
      parts.push(`...+${totalParams - shownParams.size} more`);
    }

    return parts.join(', ');
  }

  /**
   * Determine if operation should be retried automatically
   */
  private isRetryableOperation(toolName: string): boolean {
    // Operations that benefit from automatic retry
    const retryableOperations = [
      'snow_query_table',
      'snow_discover_table_fields',
      'snow_get_by_sysid',
      'snow_comprehensive_search',
      'snow_analyze_query'
    ];

    return retryableOperations.includes(toolName);
  }

  /**
   * Extract keywords from tool name and description for search indexing
   */
  private extractKeywords(name: string, description: string): string[] {
    const keywords = new Set<string>();

    // Extract from tool name (e.g., snow_query_incidents -> query, incidents)
    const nameParts = name.replace(/^snow_/, '').split('_');
    nameParts.forEach(part => {
      if (part.length > 2) {
        keywords.add(part.toLowerCase());
      }
    });

    // Extract significant words from description
    const descWords = description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'will', 'have', 'been', 'tool'].includes(w));

    // Take top 10 most relevant words from description
    descWords.slice(0, 10).forEach(w => keywords.add(w));

    return Array.from(keywords);
  }

  /**
   * Initialize server (discover tools, validate, start)
   *
   * Credential Priority (highest to lowest):
   * 1. Enterprise portal (runtime fetch - no local secrets!) [ASYNC]
   * 2. Environment variables (SERVICENOW_* or SNOW_*) [already loaded in constructor]
   * 3. Local auth.json files [already loaded in constructor]
   */
  async initialize(): Promise<void> {
    console.error('[Server] ServiceNow Unified MCP Server starting...');

    try {
      // STEP 0: Try enterprise portal fetch FIRST (secure mode - no local secrets!)
      // This takes priority over local credentials if enterprise auth is available
      if (!this.hasValidCredentials() || this.loadEnterpriseAuth()) {
        console.error('[Server] Checking enterprise portal for credentials...');
        const enterpriseContext = await this.loadFromEnterprisePortal();
        if (enterpriseContext) {
          this.context = enterpriseContext;
          console.error('[Server] ✅ Using SECURE enterprise credentials (fetched at runtime)');
          console.error('[Server]    No ServiceNow secrets stored locally!');
        } else if (!this.hasValidCredentials()) {
          console.error('[Server] No credentials available from enterprise portal');
          console.error('[Server] Falling back to local credentials (if any)...');
        }
      }

      console.error('[Server] Instance:', this.context.instanceUrl || 'NOT CONFIGURED');
      console.error('[Server] Auth Mode:', this.context.enterprise ? 'ENTERPRISE (secure)' : 'LOCAL');

      // Initialize tool registry with auto-discovery
      console.error('[Server] Discovering tools...');
      const discoveryResult = await toolRegistry.initialize();

      console.error('[Server] Tool discovery complete:');
      console.error(`  - Domains: ${discoveryResult.domains.length}`);
      console.error(`  - Tools found: ${discoveryResult.toolsFound}`);
      console.error(`  - Tools registered: ${discoveryResult.toolsRegistered}`);
      console.error(`  - Tools failed: ${discoveryResult.toolsFailed}`);
      console.error(`  - Duration: ${discoveryResult.duration}ms`);

      if (discoveryResult.toolsFailed > 0) {
        console.error('[Server] Some tools failed to load:');
        discoveryResult.errors.forEach(err => {
          console.warn(`  - ${err.filePath}: ${err.error}`);
        });
      }

      // Populate ToolSearch index for session-based tool enabling
      // This mirrors the tool index from the original snow-flow implementation
      console.error('[Server] Building tool search index...');
      const allTools = toolRegistry.getToolDefinitions();
      const toolIndexEntries = allTools.map(tool => {
        const registeredTool = toolRegistry.getTool(tool.name);
        return {
          id: tool.name,
          description: tool.description.substring(0, 200),
          category: registeredTool?.domain || 'unknown',
          keywords: this.extractKeywords(tool.name, tool.description),
          deferred: true // All tools are deferred in lazy mode
        };
      });
      ToolSearch.registerTools(toolIndexEntries);
      console.error(`[Server] Tool search index populated with ${toolIndexEntries.length} tools`);

      // Test authentication (only if we have credentials)
      if (this.hasValidCredentials()) {
        console.error('[Server] Testing authentication...');
        try {
          await authManager.getAuthenticatedClient(this.context);
          console.error('[Server] Authentication successful');
        } catch (error: any) {
          console.error('[Server] Authentication test failed:', error.message);
          console.error('[Server] Server will start, but tool calls may fail until credentials are valid');
        }
      } else {
        console.error('[Server] ⚠️  No ServiceNow credentials configured!');
        console.error('[Server] Tools will return authentication errors.');
        console.error('[Server] To configure:');
        console.error('[Server]   Enterprise users: snow-code auth login');
        console.error('[Server]   Free users: Configure environment variables or auth.json');
      }

      // Get server statistics
      const stats = toolRegistry.getStatistics();
      console.error('[Server] Server statistics:');
      console.error(`  - Total tools: ${stats.totalTools}`);
      console.error(`  - Total domains: ${stats.totalDomains}`);
      console.error('  - Tools by domain:');
      Object.entries(stats.toolsByDomain).forEach(([domain, count]) => {
        console.error(`    - ${domain}: ${count} tools`);
      });

      // 🆕 Show optimization hints when all tools are loaded
      // This helps users reduce token usage when using external MCP clients
      const lazyToolsEnabled = process.env.SNOW_LAZY_TOOLS === 'true';
      const domainFilterEnabled = !!process.env.SNOW_TOOL_DOMAINS;

      if (lazyToolsEnabled) {
        console.error('[Server] 🚀 LAZY TOOLS MODE ACTIVE (SNOW_LAZY_TOOLS=true)');
        console.error('[Server]    Token usage: ~2k (down from ~71k)');
        console.error('[Server]    AI uses tool_search + tool_execute to access all tools');
      } else if (domainFilterEnabled) {
        console.error('[Server] 🔧 Domain filtering ACTIVE via SNOW_TOOL_DOMAINS');
      } else {
        console.error('[Server] 💡 TIP: To reduce token usage with external MCP clients:');
        console.error('[Server]    Option 1 (recommended): SNOW_LAZY_TOOLS=true (~2k tokens)');
        console.error('[Server]    Option 2: SNOW_TOOL_DOMAINS=operations,deployment,cmdb (~15k tokens)');
      }

      console.error('[Server] Initialization complete ✅');

    } catch (error: any) {
      console.error('[Server] Initialization failed:', error.message);
      throw error;
    }
  }

  /**
   * Start server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Server] Connected via stdio transport');
  }

  /**
   * Stop server gracefully
   */
  async stop(): Promise<void> {
    console.error('[Server] Stopping server...');
    await this.server.close();
    authManager.clearCache();
    console.error('[Server] Server stopped');
  }

  /**
   * Get server instance (for testing)
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get auth manager (for testing)
   */
  getAuthManager() {
    return authManager;
  }

  /**
   * Get tool registry (for testing)
   */
  getToolRegistry() {
    return toolRegistry;
  }
}
