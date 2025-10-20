/**
 * Base MCP Server Implementation
 *
 * Solves DRY violations by providing common functionality for all MCP servers:
 * - Unified authentication handling
 * - Consistent error handling
 * - Session management
 * - Logging and monitoring
 * - Retry logic with exponential backoff
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { ServiceNowOAuth } from '../utils/snow-oauth.js';
import { Logger } from '../utils/logger.js';
export interface MCPServerConfig {
    name: string;
    version: string;
    description?: string;
    requiresAuth?: boolean;
    capabilities?: {
        tools?: {};
        resources?: {};
        prompts?: {};
    };
}
export interface ToolResult<T = any> {
    success: boolean;
    result?: T;
    error?: string;
    retryable?: boolean;
    executionTime?: number;
}
export interface AuthResult {
    success: boolean;
    error?: string;
    token?: string;
    expiresIn?: number;
}
/**
 * Base class for all ServiceNow MCP servers
 * Provides common functionality to eliminate code duplication
 */
export declare abstract class BaseMCPServer {
    protected server: Server;
    protected client: ServiceNowClient;
    protected oauth: ServiceNowOAuth;
    protected logger: Logger;
    protected transport: StdioServerTransport;
    protected tools: Map<string, Tool>;
    protected config: MCPServerConfig;
    private sessionToken?;
    private sessionExpiry?;
    private authCheckInterval?;
    private toolMetrics;
    constructor(config: MCPServerConfig);
    /**
     * Setup common request handlers
     */
    private setupCommonHandlers;
    /**
     * Setup authentication with automatic token refresh
     */
    private setupAuthentication;
    /**
     * Validate authentication with smart caching
     */
    protected validateAuth(): Promise<AuthResult>;
    /**
     * 🔴 SNOW-003 FIX: Enhanced retry logic with intelligent backoff and circuit breaker
     * Addresses the 19% failure rate with better retry strategies and failure prevention
     */
    private executeWithRetry;
    /**
     * 🔴 SNOW-003 FIX: Calculate intelligent backoff based on error type and attempt
     */
    private calculateBackoff;
    /**
     * 🔴 SNOW-003 FIX: Calculate dynamic timeout based on tool complexity
     */
    private calculateTimeout;
    private circuitBreakers;
    private updateCircuitBreaker;
    private isCircuitBreakerOpen;
    private resetCircuitBreaker;
    /**
     * 🔴 SNOW-003 FIX: Memory usage monitoring to prevent memory exhaustion failures
     */
    private checkMemoryUsage;
    /**
     * 🔴 SNOW-003 FIX: Enhanced error message with troubleshooting guidance
     */
    private createEnhancedErrorMessage;
    /**
     * 🔴 SNOW-003 FIX: Enhanced error classification for ServiceNow specific errors
     * Addresses the 19% failure rate by properly categorizing retryable errors
     */
    private isRetryableError;
    /**
     * Setup global error handling
     */
    private setupErrorHandling;
    /**
     * Setup metrics collection
     */
    private setupMetrics;
    /**
     * Execute tool with common error handling
     */
    protected executeTool<T>(toolName: string, handler: () => Promise<T>): Promise<ToolResult<T>>;
    /**
     * Register a tool
     */
    protected registerTool(tool: Tool, handler: (args: any) => Promise<any>): void;
    /**
     * Tool handlers map
     */
    private toolHandlers;
    /**
     * Get tool handler
     */
    private getToolHandler;
    /**
     * Graceful shutdown
     */
    private gracefulShutdown;
    /**
     * Start the server
     */
    start(): Promise<void>;
    /**
     * Abstract method for child classes to implement their specific tools
     */
    /**
     * Validate ServiceNow connection
     */
    protected validateServiceNowConnection(): Promise<AuthResult>;
    protected abstract setupTools(): void;
}
//# sourceMappingURL=base-mcp-server.d.ts.map