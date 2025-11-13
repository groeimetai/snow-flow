/**
 * Unified ServiceNow MCP Server
 *
 * Consolidates 34 separate MCP servers into a single server with:
 * - Auto-discovery of 235+ tools
 * - Shared OAuth authentication
 * - Unified error handling
 * - Dynamic tool registration
 *
 * This eliminates ~15,000 LOC of duplicate code.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import { toolRegistry } from './shared/tool-registry.js';
import { authManager } from './shared/auth.js';
import { executeWithErrorHandling, SnowFlowError, classifyError } from './shared/error-handler.js';
import { ServiceNowContext, JWTPayload } from './shared/types.js';
import { extractJWTPayload, validatePermission, validateJWTExpiry, filterToolsByRole } from './shared/permission-validator.js';

/**
 * ServiceNow Unified MCP Server
 */
export class ServiceNowUnifiedServer {
  private server: Server;
  private context: ServiceNowContext;

  constructor() {
    // Initialize MCP server
    this.server = new Server(
      {
        name: 'servicenow-unified',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

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

        console.log('[Auth] ✅ Loaded credentials from:', authPath);
        console.log('[Auth]    Instance:', instance);
        console.log('[Auth]    Client ID:', clientId ? '***' + clientId.slice(-4) : 'MISSING');
        console.log('[Auth]    Has Refresh Token:', !!servicenowCreds.refreshToken);

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
        console.warn('[Auth] Failed to load from', authPath, ':', error.message);
        continue;
      }
    }

    // No valid auth.json found
    console.warn('[Auth] No valid auth.json found in any location');
    console.warn('[Auth] Checked paths:');
    authPaths.forEach(p => console.warn('[Auth]   -', p));
    return undefined;
  }

  /**
   * Load ServiceNow context from environment variables OR auth.json fallback
   * Note: Server will start even without credentials (unauthenticated mode)
   *
   * Priority:
   * 1. Environment variables (SERVICENOW_* or SNOW_*)
   * 2. snow-code auth.json (~/.local/share/snow-code/auth.json)
   * 3. Unauthenticated mode (empty credentials)
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
      console.log('[Auth] Using credentials from environment variables');
      return {
        instanceUrl: instanceUrl!,
        clientId: clientId!,
        clientSecret: clientSecret!,
        refreshToken: normalizeCredential(refreshToken),
        username: normalizeCredential(username),
        password: normalizeCredential(password)
      };
    }

    // STEP 2: Try snow-code auth.json fallback
    const authJsonContext = this.loadFromAuthJson();
    if (authJsonContext) {
      return authJsonContext;
    }

    // STEP 3: No valid credentials found - start in unauthenticated mode
    console.error('[Auth] Warning: No ServiceNow credentials found');
    console.error('[Auth] Checked:');
    console.error('[Auth]   1. Environment variables (SERVICENOW_* or SNOW_*)');
    console.error('[Auth]   2. snow-code auth.json (~/.local/share/snow-code/auth.json)');
    console.error('[Auth] Server starting in UNAUTHENTICATED mode - tools will return authentication errors');
    console.error('[Auth] To configure credentials, run: snow-flow auth login');

    // Return empty context - tools will fail with clear auth errors
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

      console.log(
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
      console.log(`[Server] Executing tool: ${name}`);

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

    // Error handler
    this.server.onerror = (error) => {
      console.error('[Server] MCP Error:', error);
    };
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
   */
  async initialize(): Promise<void> {
    console.log('[Server] ServiceNow Unified MCP Server starting...');
    console.log('[Server] Instance:', this.context.instanceUrl);

    try {
      // Initialize tool registry with auto-discovery
      console.log('[Server] Discovering tools...');
      const discoveryResult = await toolRegistry.initialize();

      console.log('[Server] Tool discovery complete:');
      console.log(`  - Domains: ${discoveryResult.domains.length}`);
      console.log(`  - Tools found: ${discoveryResult.toolsFound}`);
      console.log(`  - Tools registered: ${discoveryResult.toolsRegistered}`);
      console.log(`  - Tools failed: ${discoveryResult.toolsFailed}`);
      console.log(`  - Duration: ${discoveryResult.duration}ms`);

      if (discoveryResult.toolsFailed > 0) {
        console.warn('[Server] Some tools failed to load:');
        discoveryResult.errors.forEach(err => {
          console.warn(`  - ${err.filePath}: ${err.error}`);
        });
      }

      // Test authentication
      console.log('[Server] Testing authentication...');
      try {
        await authManager.getAuthenticatedClient(this.context);
        console.log('[Server] Authentication successful');
      } catch (error: any) {
        console.warn('[Server] Authentication test failed:', error.message);
        console.warn('[Server] Server will start, but tool calls may fail until credentials are valid');
      }

      // Get server statistics
      const stats = toolRegistry.getStatistics();
      console.log('[Server] Server statistics:');
      console.log(`  - Total tools: ${stats.totalTools}`);
      console.log(`  - Total domains: ${stats.totalDomains}`);
      console.log('  - Tools by domain:');
      Object.entries(stats.toolsByDomain).forEach(([domain, count]) => {
        console.log(`    - ${domain}: ${count} tools`);
      });

      console.log('[Server] Initialization complete ✅');

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
    console.log('[Server] Connected via stdio transport');
  }

  /**
   * Stop server gracefully
   */
  async stop(): Promise<void> {
    console.log('[Server] Stopping server...');
    await this.server.close();
    authManager.clearCache();
    console.log('[Server] Server stopped');
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
