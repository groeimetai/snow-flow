"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowUnifiedServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const tool_registry_js_1 = require("./shared/tool-registry.js");
const auth_js_1 = require("./shared/auth.js");
const error_handler_js_1 = require("./shared/error-handler.js");
/**
 * ServiceNow Unified MCP Server
 */
class ServiceNowUnifiedServer {
    constructor() {
        // Initialize MCP server
        this.server = new index_js_1.Server({
            name: 'servicenow-unified',
            version: '1.0.0'
        }, {
            capabilities: {
                tools: {}
            }
        });
        // Load ServiceNow context from environment
        this.context = this.loadContext();
        // Setup request handlers
        this.setupHandlers();
    }
    /**
     * Load ServiceNow context from environment variables
     * Note: Server will start even without credentials (unauthenticated mode)
     */
    loadContext() {
        const instanceUrl = process.env.SERVICENOW_INSTANCE_URL;
        const clientId = process.env.SERVICENOW_CLIENT_ID;
        const clientSecret = process.env.SERVICENOW_CLIENT_SECRET;
        const refreshToken = process.env.SERVICENOW_REFRESH_TOKEN;
        const username = process.env.SERVICENOW_USERNAME;
        const password = process.env.SERVICENOW_PASSWORD;
        // Allow server to start without credentials (tools will fail gracefully)
        if (!instanceUrl || !clientId || !clientSecret) {
            console.error('[Auth] Warning: Missing ServiceNow credentials (SERVICENOW_INSTANCE_URL, SERVICENOW_CLIENT_ID, SERVICENOW_CLIENT_SECRET)');
            console.error('[Auth] Server starting in UNAUTHENTICATED mode - tools will return authentication errors');
            console.error('[Auth] Configure credentials in .env to enable ServiceNow integration');
            // Return empty context - tools will fail with clear auth errors
            return {
                instanceUrl: instanceUrl || '',
                clientId: clientId || '',
                clientSecret: clientSecret || '',
                refreshToken,
                username,
                password
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
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            const tools = tool_registry_js_1.toolRegistry.getToolDefinitions();
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
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            console.log(`[Server] Executing tool: ${name}`);
            try {
                // Get tool from registry
                const tool = tool_registry_js_1.toolRegistry.getTool(name);
                if (!tool) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Tool not found: ${name}`);
                }
                // Execute tool with error handling
                const result = await (0, error_handler_js_1.executeWithErrorHandling)(name, async () => {
                    return await tool.executor(args, this.context);
                }, {
                    retry: this.isRetryableOperation(name),
                    context: {
                        args,
                        instanceUrl: this.context.instanceUrl
                    }
                });
                // Return result in MCP format
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                };
            }
            catch (error) {
                console.error(`[Server] Tool execution failed: ${name}`, error.message);
                if (error instanceof error_handler_js_1.SnowFlowError) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, error.message, error.toToolResult());
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, error.message || 'Unknown error');
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
    isRetryableOperation(toolName) {
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
    async initialize() {
        console.log('[Server] ServiceNow Unified MCP Server starting...');
        console.log('[Server] Instance:', this.context.instanceUrl);
        try {
            // Initialize tool registry with auto-discovery
            console.log('[Server] Discovering tools...');
            const discoveryResult = await tool_registry_js_1.toolRegistry.initialize();
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
                await auth_js_1.authManager.getAuthenticatedClient(this.context);
                console.log('[Server] Authentication successful');
            }
            catch (error) {
                console.warn('[Server] Authentication test failed:', error.message);
                console.warn('[Server] Server will start, but tool calls may fail until credentials are valid');
            }
            // Get server statistics
            const stats = tool_registry_js_1.toolRegistry.getStatistics();
            console.log('[Server] Server statistics:');
            console.log(`  - Total tools: ${stats.totalTools}`);
            console.log(`  - Total domains: ${stats.totalDomains}`);
            console.log('  - Tools by domain:');
            Object.entries(stats.toolsByDomain).forEach(([domain, count]) => {
                console.log(`    - ${domain}: ${count} tools`);
            });
            console.log('[Server] Initialization complete ✅');
        }
        catch (error) {
            console.error('[Server] Initialization failed:', error.message);
            throw error;
        }
    }
    /**
     * Start server with stdio transport
     */
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        console.log('[Server] Connected via stdio transport');
    }
    /**
     * Stop server gracefully
     */
    async stop() {
        console.log('[Server] Stopping server...');
        await this.server.close();
        auth_js_1.authManager.clearCache();
        console.log('[Server] Server stopped');
    }
    /**
     * Get server instance (for testing)
     */
    getServer() {
        return this.server;
    }
    /**
     * Get auth manager (for testing)
     */
    getAuthManager() {
        return auth_js_1.authManager;
    }
    /**
     * Get tool registry (for testing)
     */
    getToolRegistry() {
        return tool_registry_js_1.toolRegistry;
    }
}
exports.ServiceNowUnifiedServer = ServiceNowUnifiedServer;
//# sourceMappingURL=server.js.map