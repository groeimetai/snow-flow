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
import { ServiceNowContext, JWTPayload } from './shared/types.js';
import { extractJWTPayload, validatePermission, validateJWTExpiry, filterToolsByRole } from './shared/permission-validator.js';
import { MCPPromptManager } from '../shared/mcp-prompt-manager.js';

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
    const authPaths = [
      // 1. Snow-Code (with dash) - OFFICIAL location (must always be with dash!)
      path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json'),
      // 2. Snow-Flow specific auth
      path.join(os.homedir(), '.snow-flow', 'auth.json'),
      // 3. OpenCode (fallback for compatibility)
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
        if (!servicenowCreds && authData.instance && authData.clientId) {
          servicenowCreds = authData;
        }

        if (!servicenowCreds) {
          continue;
        }

        // Validate credentials are not placeholders
        const isPlaceholder = (val?: string) => !val || val.includes('your-') || val.includes('placeholder');

        const instance = servicenowCreds.instance;
        const clientId = servicenowCreds.clientId;
        const clientSecret = servicenowCreds.clientSecret;

        if (isPlaceholder(instance) || isPlaceholder(clientId) || isPlaceholder(clientSecret)) {
          continue;
        }

        console.error('[Auth] ✅ Loaded credentials from:', authPath);
        console.error('[Auth]    Instance:', instance);
        console.error('[Auth]    Client ID:', clientId ? '***' + clientId.slice(-4) : 'MISSING');
        console.error('[Auth]    Has Refresh Token:', !!servicenowCreds.refreshToken);

        return {
          instanceUrl: instance.startsWith('http')
            ? instance
            : `https://${instance}`,
          clientId: clientId,
          clientSecret: clientSecret,
          refreshToken: servicenowCreds.refreshToken || servicenowCreds.refresh_token,
          username: undefined,
          password: undefined
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
   * 2. snow-code auth.json (~/.local/share/snow-code/auth.json)
   * 3. Unauthenticated mode (empty credentials)
   *
   * Note: Enterprise portal fetch (highest priority) happens in initialize() because it's async
   */
  private loadContext(): ServiceNowContext {
    // STEP 1: Try environment variables first
    const instanceUrl = process.env.SERVICENOW_INSTANCE_URL ||
                       (process.env.SNOW_INSTANCE ? `https://${process.env.SNOW_INSTANCE}` : undefined);
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
    console.error('[Auth]   2. snow-code auth.json (~/.local/share/snow-code/auth.json)');
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
   * Check if current context has valid credentials
   */
  private hasValidCredentials(): boolean {
    return !!(this.context.instanceUrl && this.context.clientId && this.context.clientSecret);
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools (filtered by user role)
    this.server.setRequestHandler(ListToolsRequestSchema, async (request) => {
      // 🆕 Phase 2: Role-based tool filtering
      const jwtPayload = extractJWTPayload((request as any).headers);
      const userRole = jwtPayload?.role || 'developer';

      const allTools = toolRegistry.getToolDefinitions();
      const filteredTools = filterToolsByRole(allTools, jwtPayload);

      console.error(
        `[Server] Listing ${filteredTools.length}/${allTools.length} tools for role: ${userRole}`
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

      try {
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
      console.log(`  - Domains: ${discoveryResult.domains.length}`);
      console.log(`  - Tools found: ${discoveryResult.toolsFound}`);
      console.log(`  - Tools registered: ${discoveryResult.toolsRegistered}`);
      console.log(`  - Tools failed: ${discoveryResult.toolsFailed}`);
      console.log(`  - Duration: ${discoveryResult.duration}ms`);

      if (discoveryResult.toolsFailed > 0) {
        console.error('[Server] Some tools failed to load:');
        discoveryResult.errors.forEach(err => {
          console.warn(`  - ${err.filePath}: ${err.error}`);
        });
      }

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
      console.log(`  - Total tools: ${stats.totalTools}`);
      console.log(`  - Total domains: ${stats.totalDomains}`);
      console.log('  - Tools by domain:');
      Object.entries(stats.toolsByDomain).forEach(([domain, count]) => {
        console.log(`    - ${domain}: ${count} tools`);
      });

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
