/**
 * Unified Authentication Store for ServiceNow
 *
 * Provides shared token storage accessible from both CLI and MCP contexts.
 * Solves the token isolation problem between different execution contexts.
 */
export interface AuthTokens {
    instance: string;
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
}
export declare class UnifiedAuthStore {
    private static instance;
    private tokenPath;
    private memoryStore;
    constructor();
    static getInstance(): UnifiedAuthStore;
    /**
     * Get tokens from file or memory
     */
    getTokens(): Promise<AuthTokens | null>;
    /**
     * Save tokens to file and memory
     */
    saveTokens(tokens: AuthTokens): Promise<void>;
    /**
     * Get tokens from environment variables (fallback)
     */
    private getTokensFromEnv;
    /**
     * Check if tokens are valid and not expired
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Clear all stored tokens
     */
    clearTokens(): Promise<void>;
    /**
     * Get ServiceNow instance URL
     */
    getInstanceUrl(): Promise<string | null>;
    /**
     * Get headers for API requests
     */
    getAuthHeaders(): Promise<Record<string, string> | null>;
    /**
     * Bridge tokens to MCP servers via environment
     */
    bridgeToMCP(): Promise<void>;
}
export declare const unifiedAuthStore: UnifiedAuthStore;
//# sourceMappingURL=unified-auth-store.d.ts.map