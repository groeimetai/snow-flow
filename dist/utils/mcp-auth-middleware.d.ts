/**
 * Centralized MCP Authentication Middleware
 * Handles ServiceNow OAuth authentication across all MCP servers
 */
export interface AuthenticationResult {
    success: boolean;
    token?: string;
    error?: string;
    needsReauth?: boolean;
}
export declare class MCPAuthenticationMiddleware {
    private static instance;
    private oauth;
    private logger;
    private lastAuthCheck;
    private authCheckInterval;
    private constructor();
    static getInstance(): MCPAuthenticationMiddleware;
    /**
     * Ensure authentication is valid before MCP operations
     */
    ensureAuthenticated(): Promise<AuthenticationResult>;
    /**
     * Check if authentication status should be verified
     */
    private shouldCheckAuth;
    /**
     * Handle authentication errors with automatic retry
     */
    handleAuthError(error: any): Promise<AuthenticationResult>;
    /**
     * Check if an error is authentication-related
     */
    private isAuthError;
    /**
     * Get ServiceNow instance information
     */
    getInstanceInfo(): Promise<{
        instance: string;
        authenticated: boolean;
    }>;
    /**
     * Wrapper for MCP operations with authentication
     */
    withAuth<T>(operation: (token: string) => Promise<T>): Promise<T>;
    /**
     * Get authentication headers for HTTP requests
     */
    getAuthHeaders(): Promise<{
        [key: string]: string;
    }>;
    /**
     * Force authentication refresh
     */
    forceRefresh(): Promise<AuthenticationResult>;
}
export declare const mcpAuth: MCPAuthenticationMiddleware;
//# sourceMappingURL=mcp-auth-middleware.d.ts.map