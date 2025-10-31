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

import { toolRegistry } from './shared/tool-registry.js';
import { authManager } from './shared/auth.js';
import { executeWithErrorHandling, SnowFlowError, classifyError } from './shared/error-handler.js';
import { ServiceNowContext } from './shared/types.js';

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
   * Load ServiceNow context from environment variables
   * Note: Server will start even without credentials (unauthenticated mode)
   */
  private loadContext(): ServiceNowContext {
    const instanceUrl = process.env.SERVICENOW_INSTANCE_URL;
    const clientId = process.env.SERVICENOW_CLIENT_ID;
    const clientSecret = process.env.SERVICENOW_CLIENT_SECRET;
    const refreshToken = process.env.SERVICENOW_REFRESH_TOKEN;
    const username = process.env.SERVICENOW_USERNAME;
    const password = process.env.SERVICENOW_PASSWORD;

    // Check for placeholder values
    const isPlaceholder = (val?: string) => !val || val.includes('your-') || val.includes('placeholder');

    // Allow server to start without credentials OR with placeholder values (tools will fail gracefully)
    if (!instanceUrl || !clientId || !clientSecret ||
        isPlaceholder(instanceUrl) || isPlaceholder(clientId) || isPlaceholder(clientSecret)) {
      console.error('[Auth] Warning: ServiceNow credentials not configured or contain placeholder values');
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

    return {
      instanceUrl,
      clientId,
      clientSecret,
      refreshToken,
      username,
      password
    };
  }

  /**
   * Setup MCP request handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = toolRegistry.getToolDefinitions();
      console.log(`[Server] Listing ${tools.length} tools`);

      return {
        tools: tools.map(tool => ({
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

        // Execute tool with error handling
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
