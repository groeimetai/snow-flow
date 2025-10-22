/**
 * Shared OAuth 2.0 Authentication Module
 *
 * Provides a single OAuth implementation for all ServiceNow MCP tools.
 * Replaces 34 duplicate auth implementations with unified token management.
 *
 * Features:
 * - OAuth 2.0 refresh token flow
 * - Automatic token refresh on expiry
 * - Session persistence
 * - Multi-instance support
 * - Connection pooling
 */
import { AxiosInstance } from 'axios';
import { ServiceNowContext } from './types';
export interface ExtendedAxiosInstance extends AxiosInstance {
    getRecord(table: string, sys_id: string): Promise<any>;
    query(table: string, params?: any): Promise<any>;
    updateRecord(table: string, sys_id: string, data: any): Promise<any>;
}
/**
 * ServiceNow OAuth Manager
 */
export declare class ServiceNowAuthManager {
    private tokenCache;
    private clients;
    private tokenRefreshPromises;
    constructor();
    /**
     * Load and validate enterprise license (from enterprise package if available)
     */
    private loadEnterpriseLicense;
    /**
     * Get community (free) license
     */
    private getCommunityLicense;
    /**
     * Get authenticated Axios client for ServiceNow instance
     */
    getAuthenticatedClient(context: ServiceNowContext): Promise<ExtendedAxiosInstance>;
    /**
     * Get valid access token (from cache or refresh)
     */
    getAccessToken(context: ServiceNowContext): Promise<string>;
    /**
     * Refresh access token using refresh token OR username/password
     */
    private refreshAccessToken;
    /**
     * Authenticate using username and password (fallback method)
     */
    private authenticateWithPassword;
    /**
     * Check if cached token is still valid
     */
    private isTokenValid;
    /**
     * Invalidate cached token for instance
     */
    private invalidateToken;
    /**
     * Get cache key for instance URL
     */
    private getCacheKey;
    /**
     * Load token cache from disk
     */
    private loadTokenCache;
    /**
     * Save token cache to disk
     */
    private saveTokenCache;
    /**
     * Get token cache file path
     */
    private getTokenCachePath;
    /**
     * Clear all cached tokens
     */
    clearCache(): void;
    /**
     * Get cache statistics
     */
    getCacheStats(): {
        cachedInstances: number;
        activeClients: number;
        tokens: Array<{
            instanceUrl: string;
            expiresIn: number;
            valid: boolean;
        }>;
    };
}
/**
 * Singleton instance for global use
 */
export declare const authManager: ServiceNowAuthManager;
/**
 * Convenience function to get authenticated client
 */
export declare function getAuthenticatedClient(context: ServiceNowContext): Promise<ExtendedAxiosInstance>;
/**
 * Convenience function to get access token
 */
export declare function getAccessToken(context: ServiceNowContext): Promise<string>;
//# sourceMappingURL=auth.d.ts.map