"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authManager = exports.ServiceNowAuthManager = void 0;
exports.getAuthenticatedClient = getAuthenticatedClient;
exports.getAccessToken = getAccessToken;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
/**
 * ServiceNow OAuth Manager
 */
class ServiceNowAuthManager {
    constructor() {
        this.tokenCache = new Map();
        this.clients = new Map();
        this.tokenRefreshPromises = new Map();
        // Load cached tokens on initialization
        this.loadTokenCache().catch(err => {
            console.warn('[Auth] Failed to load token cache:', err.message);
        });
    }
    /**
     * Get authenticated Axios client for ServiceNow instance
     */
    async getAuthenticatedClient(context) {
        const cacheKey = this.getCacheKey(context.instanceUrl);
        // Return existing client if valid token exists
        if (this.clients.has(cacheKey) && this.isTokenValid(cacheKey)) {
            return this.clients.get(cacheKey);
        }
        // Get fresh access token
        const accessToken = await this.getAccessToken(context);
        // Create new authenticated client
        const client = axios_1.default.create({
            baseURL: context.instanceUrl,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            timeout: 30000 // 30 second timeout
        });
        // Add response interceptor for automatic token refresh on 401
        client.interceptors.response.use(response => response, async (error) => {
            const originalRequest = error.config;
            // If 401 and not already retrying, refresh token and retry
            if (error.response?.status === 401 && !originalRequest._retry) {
                originalRequest._retry = true;
                try {
                    // Force token refresh
                    this.invalidateToken(cacheKey);
                    const newAccessToken = await this.getAccessToken(context);
                    // Update request with new token
                    originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
                    // Retry original request
                    return client(originalRequest);
                }
                catch (refreshError) {
                    console.error('[Auth] Token refresh failed:', refreshError);
                    throw refreshError;
                }
            }
            throw error;
        });
        // Add ServiceNow helper methods
        client.getRecord = async (table, sys_id) => {
            return await client.get(`/api/now/table/${table}/${sys_id}`);
        };
        client.query = async (table, params) => {
            return await client.get(`/api/now/table/${table}`, { params });
        };
        client.updateRecord = async (table, sys_id, data) => {
            return await client.put(`/api/now/table/${table}/${sys_id}`, data);
        };
        this.clients.set(cacheKey, client);
        return client;
    }
    /**
     * Get valid access token (from cache or refresh)
     */
    async getAccessToken(context) {
        const cacheKey = this.getCacheKey(context.instanceUrl);
        // Return cached token if valid
        if (this.isTokenValid(cacheKey)) {
            return this.tokenCache.get(cacheKey).accessToken;
        }
        // Check if refresh already in progress for this instance
        if (this.tokenRefreshPromises.has(cacheKey)) {
            console.log('[Auth] Token refresh already in progress, awaiting...');
            return await this.tokenRefreshPromises.get(cacheKey);
        }
        // Start token refresh
        const refreshPromise = this.refreshAccessToken(context);
        this.tokenRefreshPromises.set(cacheKey, refreshPromise);
        try {
            const accessToken = await refreshPromise;
            return accessToken;
        }
        finally {
            this.tokenRefreshPromises.delete(cacheKey);
        }
    }
    /**
     * Refresh access token using refresh token
     */
    async refreshAccessToken(context) {
        const cacheKey = this.getCacheKey(context.instanceUrl);
        console.log('[Auth] Refreshing access token for:', context.instanceUrl);
        try {
            // Get refresh token (from cache or context)
            let refreshToken = context.refreshToken;
            const cached = this.tokenCache.get(cacheKey);
            if (!refreshToken && cached) {
                refreshToken = cached.refreshToken;
            }
            if (!refreshToken) {
                throw new Error('No refresh token available');
            }
            // OAuth token refresh request
            const tokenUrl = `${context.instanceUrl}/oauth_token.do`;
            const response = await axios_1.default.post(tokenUrl, new URLSearchParams({
                grant_type: 'refresh_token',
                client_id: context.clientId,
                client_secret: context.clientSecret,
                refresh_token: refreshToken
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });
            const tokenData = response.data;
            // Cache tokens
            const expiresAt = Date.now() + (tokenData.expires_in * 1000) - 60000; // 1 min buffer
            this.tokenCache.set(cacheKey, {
                accessToken: tokenData.access_token,
                refreshToken: tokenData.refresh_token,
                expiresAt,
                instanceUrl: context.instanceUrl
            });
            // Persist to disk
            await this.saveTokenCache();
            console.log('[Auth] Access token refreshed successfully');
            return tokenData.access_token;
        }
        catch (error) {
            console.error('[Auth] Token refresh failed:', error.message);
            if (error.response) {
                console.error('[Auth] Response status:', error.response.status);
                console.error('[Auth] Response data:', error.response.data);
            }
            throw new Error(`OAuth token refresh failed: ${error.message}`);
        }
    }
    /**
     * Check if cached token is still valid
     */
    isTokenValid(cacheKey) {
        const cached = this.tokenCache.get(cacheKey);
        if (!cached) {
            return false;
        }
        // Check if token expired (with 1 minute buffer)
        return Date.now() < cached.expiresAt;
    }
    /**
     * Invalidate cached token for instance
     */
    invalidateToken(cacheKey) {
        this.tokenCache.delete(cacheKey);
        this.clients.delete(cacheKey);
        console.log('[Auth] Invalidated token for:', cacheKey);
    }
    /**
     * Get cache key for instance URL
     */
    getCacheKey(instanceUrl) {
        // Normalize instance URL (remove trailing slash, protocol)
        return instanceUrl
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')
            .toLowerCase();
    }
    /**
     * Load token cache from disk
     */
    async loadTokenCache() {
        try {
            const cachePath = this.getTokenCachePath();
            const cacheData = await fs.readFile(cachePath, 'utf-8');
            const cached = JSON.parse(cacheData);
            // Load tokens into memory cache
            Object.entries(cached).forEach(([key, token]) => {
                // Only load if not expired
                if (token.expiresAt > Date.now()) {
                    this.tokenCache.set(key, token);
                }
            });
            console.log('[Auth] Loaded', this.tokenCache.size, 'cached tokens');
        }
        catch (error) {
            // Cache file doesn't exist or is corrupted - not critical
            if (error.code !== 'ENOENT') {
                console.warn('[Auth] Failed to load cache:', error.message);
            }
        }
    }
    /**
     * Save token cache to disk
     */
    async saveTokenCache() {
        try {
            const cachePath = this.getTokenCachePath();
            const cacheData = {};
            // Convert Map to plain object
            this.tokenCache.forEach((token, key) => {
                cacheData[key] = token;
            });
            // Ensure directory exists
            await fs.mkdir(path.dirname(cachePath), { recursive: true });
            // Write cache file
            await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
            console.log('[Auth] Token cache saved');
        }
        catch (error) {
            console.error('[Auth] Failed to save cache:', error.message);
        }
    }
    /**
     * Get token cache file path
     */
    getTokenCachePath() {
        // Store in user's home directory
        const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
        return path.join(homeDir, '.snow-flow', 'token-cache.json');
    }
    /**
     * Clear all cached tokens
     */
    clearCache() {
        this.tokenCache.clear();
        this.clients.clear();
        console.log('[Auth] Cache cleared');
    }
    /**
     * Get cache statistics
     */
    getCacheStats() {
        const stats = {
            cachedInstances: this.tokenCache.size,
            activeClients: this.clients.size,
            tokens: []
        };
        this.tokenCache.forEach((token, key) => {
            const expiresIn = Math.max(0, token.expiresAt - Date.now());
            stats.tokens.push({
                instanceUrl: token.instanceUrl,
                expiresIn,
                valid: this.isTokenValid(key)
            });
        });
        return stats;
    }
}
exports.ServiceNowAuthManager = ServiceNowAuthManager;
/**
 * Singleton instance for global use
 */
exports.authManager = new ServiceNowAuthManager();
/**
 * Convenience function to get authenticated client
 */
async function getAuthenticatedClient(context) {
    return await exports.authManager.getAuthenticatedClient(context);
}
/**
 * Convenience function to get access token
 */
async function getAccessToken(context) {
    return await exports.authManager.getAccessToken(context);
}
//# sourceMappingURL=auth.js.map