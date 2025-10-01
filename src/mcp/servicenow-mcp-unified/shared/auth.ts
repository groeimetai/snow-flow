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

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ServiceNowContext, OAuthTokenResponse } from './types';

// Extended AxiosInstance with ServiceNow helper methods
export interface ExtendedAxiosInstance extends AxiosInstance {
  getRecord(table: string, sys_id: string): Promise<any>;
  query(table: string, params?: any): Promise<any>;
  updateRecord(table: string, sys_id: string, data: any): Promise<any>;
}

/**
 * Token cache for active sessions
 */
interface TokenCache {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  instanceUrl: string;
}

/**
 * ServiceNow OAuth Manager
 */
export class ServiceNowAuthManager {
  private tokenCache: Map<string, TokenCache> = new Map();
  private clients: Map<string, AxiosInstance> = new Map();
  private tokenRefreshPromises: Map<string, Promise<string>> = new Map();

  constructor() {
    // Load cached tokens on initialization
    this.loadTokenCache().catch(err => {
      console.warn('[Auth] Failed to load token cache:', err.message);
    });
  }

  /**
   * Get authenticated Axios client for ServiceNow instance
   */
  async getAuthenticatedClient(context: ServiceNowContext): Promise<ExtendedAxiosInstance> {
    const cacheKey = this.getCacheKey(context.instanceUrl);

    // Return existing client if valid token exists
    if (this.clients.has(cacheKey) && this.isTokenValid(cacheKey)) {
      return this.clients.get(cacheKey)! as ExtendedAxiosInstance;
    }

    // Get fresh access token
    const accessToken = await this.getAccessToken(context);

    // Create new authenticated client
    const client = axios.create({
      baseURL: context.instanceUrl,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000 // 30 second timeout
    }) as ExtendedAxiosInstance;

    // Add response interceptor for automatic token refresh on 401
    client.interceptors.response.use(
      response => response,
      async error => {
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
          } catch (refreshError) {
            console.error('[Auth] Token refresh failed:', refreshError);
            throw refreshError;
          }
        }

        throw error;
      }
    );

    // Add ServiceNow helper methods
    client.getRecord = async (table: string, sys_id: string) => {
      return await client.get(`/api/now/table/${table}/${sys_id}`);
    };

    client.query = async (table: string, params?: any) => {
      return await client.get(`/api/now/table/${table}`, { params });
    };

    client.updateRecord = async (table: string, sys_id: string, data: any) => {
      return await client.put(`/api/now/table/${table}/${sys_id}`, data);
    };

    this.clients.set(cacheKey, client);
    return client;
  }

  /**
   * Get valid access token (from cache or refresh)
   */
  async getAccessToken(context: ServiceNowContext): Promise<string> {
    const cacheKey = this.getCacheKey(context.instanceUrl);

    // Return cached token if valid
    if (this.isTokenValid(cacheKey)) {
      return this.tokenCache.get(cacheKey)!.accessToken;
    }

    // Check if refresh already in progress for this instance
    if (this.tokenRefreshPromises.has(cacheKey)) {
      console.log('[Auth] Token refresh already in progress, awaiting...');
      return await this.tokenRefreshPromises.get(cacheKey)!;
    }

    // Start token refresh
    const refreshPromise = this.refreshAccessToken(context);
    this.tokenRefreshPromises.set(cacheKey, refreshPromise);

    try {
      const accessToken = await refreshPromise;
      return accessToken;
    } finally {
      this.tokenRefreshPromises.delete(cacheKey);
    }
  }

  /**
   * Refresh access token using refresh token
   */
  private async refreshAccessToken(context: ServiceNowContext): Promise<string> {
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
      const response = await axios.post<OAuthTokenResponse>(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: context.clientId,
          client_secret: context.clientSecret,
          refresh_token: refreshToken
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 10000
        }
      );

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

    } catch (error: any) {
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
  private isTokenValid(cacheKey: string): boolean {
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
  private invalidateToken(cacheKey: string): void {
    this.tokenCache.delete(cacheKey);
    this.clients.delete(cacheKey);
    console.log('[Auth] Invalidated token for:', cacheKey);
  }

  /**
   * Get cache key for instance URL
   */
  private getCacheKey(instanceUrl: string): string {
    // Normalize instance URL (remove trailing slash, protocol)
    return instanceUrl
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '')
      .toLowerCase();
  }

  /**
   * Load token cache from disk
   */
  private async loadTokenCache(): Promise<void> {
    try {
      const cachePath = this.getTokenCachePath();
      const cacheData = await fs.readFile(cachePath, 'utf-8');
      const cached: Record<string, TokenCache> = JSON.parse(cacheData);

      // Load tokens into memory cache
      Object.entries(cached).forEach(([key, token]) => {
        // Only load if not expired
        if (token.expiresAt > Date.now()) {
          this.tokenCache.set(key, token);
        }
      });

      console.log('[Auth] Loaded', this.tokenCache.size, 'cached tokens');
    } catch (error: any) {
      // Cache file doesn't exist or is corrupted - not critical
      if (error.code !== 'ENOENT') {
        console.warn('[Auth] Failed to load cache:', error.message);
      }
    }
  }

  /**
   * Save token cache to disk
   */
  private async saveTokenCache(): Promise<void> {
    try {
      const cachePath = this.getTokenCachePath();
      const cacheData: Record<string, TokenCache> = {};

      // Convert Map to plain object
      this.tokenCache.forEach((token, key) => {
        cacheData[key] = token;
      });

      // Ensure directory exists
      await fs.mkdir(path.dirname(cachePath), { recursive: true });

      // Write cache file
      await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
      console.log('[Auth] Token cache saved');
    } catch (error: any) {
      console.error('[Auth] Failed to save cache:', error.message);
    }
  }

  /**
   * Get token cache file path
   */
  private getTokenCachePath(): string {
    // Store in user's home directory
    const homeDir = process.env.HOME || process.env.USERPROFILE || '/tmp';
    return path.join(homeDir, '.snow-flow', 'token-cache.json');
  }

  /**
   * Clear all cached tokens
   */
  clearCache(): void {
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
      tokens: [] as Array<{
        instanceUrl: string;
        expiresIn: number;
        valid: boolean;
      }>
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

/**
 * Singleton instance for global use
 */
export const authManager = new ServiceNowAuthManager();

/**
 * Convenience function to get authenticated client
 */
export async function getAuthenticatedClient(
  context: ServiceNowContext
): Promise<ExtendedAxiosInstance> {
  return await authManager.getAuthenticatedClient(context);
}

/**
 * Convenience function to get access token
 */
export async function getAccessToken(context: ServiceNowContext): Promise<string> {
  return await authManager.getAccessToken(context);
}
