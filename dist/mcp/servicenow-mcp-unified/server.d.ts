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
/**
 * ServiceNow Unified MCP Server
 */
export declare class ServiceNowUnifiedServer {
    private server;
    private context;
    constructor();
    /**
     * Load ServiceNow context from environment variables
     * Note: Server will start even without credentials (unauthenticated mode)
     */
    private loadContext;
    /**
     * Setup MCP request handlers
     */
    private setupHandlers;
    /**
     * Determine if operation should be retried automatically
     */
    private isRetryableOperation;
    /**
     * Initialize server (discover tools, validate, start)
     */
    initialize(): Promise<void>;
    /**
     * Start server with stdio transport
     */
    start(): Promise<void>;
    /**
     * Stop server gracefully
     */
    stop(): Promise<void>;
    /**
     * Get server instance (for testing)
     */
    getServer(): Server;
    /**
     * Get auth manager (for testing)
     */
    getAuthManager(): import("./shared/auth.js").ServiceNowAuthManager;
    /**
     * Get tool registry (for testing)
     */
    getToolRegistry(): import("./shared/tool-registry.js").ToolRegistry;
}
//# sourceMappingURL=server.d.ts.map