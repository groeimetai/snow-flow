#!/usr/bin/env node
/**
 * ServiceNow OAuth Authentication Utility with Code Paste Flow
 * Handles OAuth2 flow for ServiceNow integration (Claude-style)
 */
export interface ServiceNowAuthResult {
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    error?: string;
}
export interface ServiceNowCredentials {
    instance: string;
    clientId: string;
    clientSecret: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
}
export declare class ServiceNowOAuth {
    private credentials?;
    private tokenPath;
    private stateParameter?;
    private codeVerifier?;
    private codeChallenge?;
    private lastTokenRequest;
    private tokenRequestCount;
    private readonly TOKEN_REQUEST_WINDOW_MS;
    private readonly MAX_TOKEN_REQUESTS_PER_WINDOW;
    constructor();
    /**
     * 🔒 SEC-002 FIX: Check rate limiting for token requests to prevent brute force attacks
     */
    private checkTokenRequestRateLimit;
    /**
     * Generate a random state parameter for CSRF protection
     */
    private generateState;
    /**
     * Generate PKCE code verifier and challenge
     */
    private generatePKCE;
    /**
     * Check if a specific port is available
     */
    private checkPortAvailable;
    /**
     * 🔧 CRIT-002 FIX: Normalize instance URL to prevent trailing slash 400 errors
     */
    private normalizeInstanceUrl;
    /**
     * 🎯 NEW: Simplified OAuth flow with code paste (Claude-style)
     * No local server required - user manually pastes authorization code
     */
    authenticateWithCodePaste(instance: string, clientId: string, clientSecret: string): Promise<ServiceNowAuthResult>;
    /**
     * Original OAuth flow with local server (fallback)
     */
    authenticate(instance: string, clientId: string, clientSecret: string): Promise<ServiceNowAuthResult>;
    /**
     * Generate ServiceNow OAuth authorization URL
     */
    private generateAuthUrl;
    /**
     * Start local HTTP server to handle OAuth callback
     */
    private startCallbackServer;
    /**
     * Exchange authorization code for tokens
     */
    private exchangeCodeForTokens;
    /**
     * Save tokens to file
     */
    private saveTokens;
    /**
     * Load tokens from file
     */
    loadTokens(): Promise<any>;
    /**
     * Check if authenticated
     */
    isAuthenticated(): Promise<boolean>;
    /**
     * Get access token (refresh if needed)
     */
    getAccessToken(): Promise<string | null>;
    /**
     * Refresh access token
     */
    refreshAccessToken(tokens?: any): Promise<ServiceNowAuthResult>;
    /**
     * Logout - clear saved tokens
     */
    logout(): Promise<void>;
    /**
     * Get stored OAuth tokens for use in other contexts (MCP servers)
     */
    getStoredTokens(): Promise<any>;
    /**
     * Load credentials (including tokens) with .env fallback
     */
    loadCredentials(): Promise<ServiceNowCredentials | null>;
    /**
     * Validate OAuth client secret format
     * OAuth secrets are typically long random strings (32+ chars) with mixed case and alphanumeric
     * Common passwords are shorter and may contain dictionary words
     */
    validateClientSecret(clientSecret: string): {
        valid: boolean;
        reason?: string;
    };
    /**
     * Get credentials (compatibility method for MCP servers)
     */
    getCredentials(): Promise<ServiceNowCredentials | null>;
}
//# sourceMappingURL=snow-oauth.d.ts.map