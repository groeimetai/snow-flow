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
import { ServiceNowContext, OAuthTokenResponse, EnterpriseLicense } from './types';
import { mcpDebug } from '../../shared/mcp-debug.js';

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
      mcpDebug('[Auth] Failed to load token cache:', err.message);
    });

    // Load enterprise license on initialization
    this.loadEnterpriseLicense();
  }

  /**
   * Load and validate enterprise license (from enterprise package if available)
   */
  private loadEnterpriseLicense(): void {
    try {
      // Try to load enterprise features (only available in enterprise edition)
      let loadLicenseFromEnv: any;

      try {
        // Attempt to import from enterprise package
        loadLicenseFromEnv = require('../../../../enterprise/src/auth/enterprise-validator').loadLicenseFromEnv;
      } catch (err) {
        // Enterprise package not installed - use community license
        mcpDebug('[Auth] Enterprise features not available, using community tier');
        (this as any)._enterpriseLicense = this.getCommunityLicense();
        return;
      }

      const license: EnterpriseLicense = loadLicenseFromEnv();

      mcpDebug('[Auth] Enterprise License:', {
        tier: license.tier,
        company: license.companyName || 'N/A',
        theme: license.theme,
        features: license.features.length,
        expiresAt: license.expiresAt?.toISOString() || 'N/A'
      });

      // Store license for context enrichment
      (this as any)._enterpriseLicense = license;
    } catch (error: any) {
      mcpDebug('[Auth] Failed to load enterprise license:', error.message);
      // Fallback to community license
      (this as any)._enterpriseLicense = this.getCommunityLicense();
    }
  }

  /**
   * Get community (free) license
   */
  private getCommunityLicense(): EnterpriseLicense {
    return {
      tier: 'community',
      features: [],
      theme: 'servicenow'
    };
  }

  /**
   * Get authenticated Axios client for ServiceNow instance
   */
  async getAuthenticatedClient(context: ServiceNowContext): Promise<ExtendedAxiosInstance> {
    // Enrich context with enterprise license if not already present
    if (!context.enterprise && (this as any)._enterpriseLicense) {
      context.enterprise = (this as any)._enterpriseLicense;
    }

    const cacheKey = this.getCacheKey(context.instanceUrl);

    // Return existing client if valid token exists
    if (this.clients.has(cacheKey) && this.isTokenValid(cacheKey)) {
      return this.clients.get(cacheKey)! as ExtendedAxiosInstance;
    }

    // Get fresh access token
    const accessToken = await this.getAccessToken(context);

    // Determine correct Authorization header format
    // Basic auth tokens already include "Basic " prefix, Bearer tokens don't
    const authHeader = accessToken.startsWith('Basic ')
      ? accessToken
      : `Bearer ${accessToken}`;

    // Create new authenticated client
    const client = axios.create({
      baseURL: context.instanceUrl,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 60000 // 60 second timeout (increased from 30s to handle slow operations)
    }) as ExtendedAxiosInstance;

    // Add response interceptor to validate ServiceNow responses
    // ServiceNow returns error responses with a different structure that doesn't have 'result'
    client.interceptors.response.use(
      response => {
        // Check if this is an error response disguised as a 200
        // ServiceNow sometimes returns 200 with error body
        if (response.data?.error) {
          const errorMsg = response.data.error.message || response.data.error.detail || 'ServiceNow API error';
          mcpDebug('[Auth] ServiceNow returned error in response body:', errorMsg);
          const err = new Error(errorMsg);
          (err as any).response = response;
          (err as any).isServiceNowError = true;
          throw err;
        }

        // Normalize response structure for consistent API handling
        // ServiceNow sometimes returns data directly without 'result' wrapper
        if (response.data && response.data.result === undefined) {
          // If response has sys_id directly or is an array, wrap it in result
          if (response.data.sys_id || Array.isArray(response.data)) {
            response.data = { result: response.data };
          } else {
            // Ensure result exists as empty object/array for safe access
            response.data.result = [];
          }
        }

        return response;
      },
      async error => {
        // Check if the error response has ServiceNow error structure
        if (error.response?.data?.error) {
          const snowError = error.response.data.error;
          const errorMsg = snowError.message || snowError.detail || 'ServiceNow API error';
          mcpDebug('[Auth] ServiceNow API error:', errorMsg);
          // Re-throw with clearer message
          const err = new Error(`ServiceNow: ${errorMsg}`);
          (err as any).response = error.response;
          (err as any).originalError = error;
          throw err;
        }
        throw error;
      }
    );

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

            // CRITICAL FIX: Clear the accessToken from context to force using refreshToken
            // Otherwise STEP 0 in refreshAccessToken will return the same invalid token!
            const invalidAccessToken = context.accessToken;
            context.accessToken = undefined;

            mcpDebug('[Auth] 401 received, clearing invalid accessToken and forcing refresh...');
            const newAccessToken = await this.getAccessToken(context);

            // Update request with new token
            // Check if it's already a full auth header (Basic auth) or just a Bearer token
            if (newAccessToken.startsWith('Basic ')) {
              originalRequest.headers['Authorization'] = newAccessToken;
            } else {
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            }

            // Retry original request
            return client(originalRequest);
          } catch (refreshError) {
            mcpDebug('[Auth] Token refresh failed:', refreshError);
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
      mcpDebug('[Auth] Token refresh already in progress, awaiting...');
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
   * Refresh access token using refresh token, OAuth client credentials, OR username/password
   */
  private async refreshAccessToken(context: ServiceNowContext): Promise<string> {
    const cacheKey = this.getCacheKey(context.instanceUrl);
    mcpDebug('[Auth] Refreshing access token for:', context.instanceUrl);

    // Check if instance URL is valid
    if (!context.instanceUrl || context.instanceUrl === '' ||
        context.instanceUrl.includes('your-instance')) {
      throw new Error('ServiceNow credentials not configured. Please run: snow-flow auth login');
    }

    // Check for valid OAuth credentials
    const hasValidOAuth = context.clientId && context.clientSecret &&
                         context.clientId !== '' && context.clientSecret !== '' &&
                         !context.clientId.includes('your-') && !context.clientSecret.includes('your-');

    // Check for valid Basic auth credentials
    const hasValidBasic = context.username && context.password &&
                         context.username.trim() !== '' && context.password.trim() !== '';

    // Must have at least one valid auth method
    if (!hasValidOAuth && !hasValidBasic) {
      throw new Error('ServiceNow credentials not configured. Please run: snow-flow auth login');
    }

    // If only Basic auth is available, skip OAuth flows and go directly to Basic auth
    if (!hasValidOAuth && hasValidBasic) {
      mcpDebug('[Auth] Using Basic auth (no OAuth credentials configured)');
      return this.authenticateWithBasicAuth(context);
    }

    // STEP 0: Use pre-loaded access token from context (from TUI OAuth flow)
    if (context.accessToken) {
      // Check if token has already expired based on tokenExpiry
      const tokenExpiry = context.tokenExpiry || 0;
      const isExpired = tokenExpiry > 0 && tokenExpiry < Date.now();

      if (isExpired) {
        mcpDebug('[Auth] Pre-loaded access token from context has EXPIRED, skipping to refresh flow...');
        // Clear the expired token to prevent reuse
        context.accessToken = undefined;
      } else {
        mcpDebug('[Auth] Using pre-loaded access token from context');

        // Cache it for future requests
        const expiresAt = tokenExpiry || (Date.now() + 3600000); // 1 hour default
        this.tokenCache.set(cacheKey, {
          accessToken: context.accessToken,
          refreshToken: context.refreshToken || '',
          expiresAt,
          instanceUrl: context.instanceUrl
        });

        // Persist to disk
        await this.saveTokenCache();

        return context.accessToken;
      }
    }

    // STEP 1: Try OAuth Refresh Token flow if refresh token is available
    let refreshToken = context.refreshToken;
    const cached = this.tokenCache.get(cacheKey);
    if (!refreshToken && cached) {
      refreshToken = cached.refreshToken;
    }

    if (refreshToken) {
      try {
        mcpDebug('[Auth] Attempting OAuth refresh token flow...');
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
          refreshToken: tokenData.refresh_token || refreshToken, // Keep old refresh token if new one not provided
          expiresAt,
          instanceUrl: context.instanceUrl
        });

        // Persist to disk
        await this.saveTokenCache();

        mcpDebug('[Auth] Access token refreshed successfully (OAuth Refresh Token)');
        return tokenData.access_token;

      } catch (error: any) {
        mcpDebug('[Auth] OAuth refresh token flow failed:', error.message);
        mcpDebug('[Auth] Will try OAuth client credentials flow...');
      }
    }

    // STEP 2: Try OAuth Client Credentials Grant (initial token acquisition)
    try {
      mcpDebug('[Auth] Attempting OAuth client credentials flow...');
      const tokenUrl = `${context.instanceUrl}/oauth_token.do`;
      const response = await axios.post<OAuthTokenResponse>(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: context.clientId,
          client_secret: context.clientSecret
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
        refreshToken: tokenData.refresh_token || '', // Store refresh token if provided
        expiresAt,
        instanceUrl: context.instanceUrl
      });

      // Persist to disk
      await this.saveTokenCache();

      mcpDebug('[Auth] Access token acquired successfully (OAuth Client Credentials)');
      return tokenData.access_token;

    } catch (error: any) {
      mcpDebug('[Auth] OAuth client credentials flow failed:', error.message);

      // Only try username/password if explicitly provided
      const hasBasicAuth = context.username && context.password &&
                          context.username.trim() !== '' && context.password.trim() !== '';

      if (hasBasicAuth) {
        mcpDebug('[Auth] Will try username/password fallback...');
        return await this.authenticateWithPassword(context);
      } else {
        mcpDebug('[Auth] No username/password credentials available for fallback');
        throw new Error(`OAuth authentication failed: ${error.message}. Please verify ServiceNow OAuth configuration.`);
      }
    }

    // This code should never be reached, but TypeScript needs it
    throw new Error('Authentication failed: All methods exhausted');
  }

  /**
   * Authenticate using username and password from context (primary Basic auth method)
   * Used when auth.json has servicenow-basic type credentials
   */
  private async authenticateWithBasicAuth(context: ServiceNowContext): Promise<string> {
    const cacheKey = this.getCacheKey(context.instanceUrl);

    try {
      // Use credentials from context (loaded from auth.json)
      const username = context.username;
      const password = context.password;

      // Check for missing OR empty strings
      if (!username || !password || username.trim() === '' || password.trim() === '') {
        throw new Error('No username/password available in context for basic authentication');
      }

      mcpDebug('[Auth] Using Basic auth from auth.json credentials');

      // Create Basic Auth token
      const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
      const accessToken = `Basic ${basicAuth}`;

      // Cache with long expiry (basic auth doesn't expire)
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      this.tokenCache.set(cacheKey, {
        accessToken,
        refreshToken: '', // No refresh token for basic auth
        expiresAt,
        instanceUrl: context.instanceUrl
      });

      // Test the credentials with a simple API call
      try {
        await axios.get(`${context.instanceUrl}/api/now/table/sys_user?sysparm_limit=1`, {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        mcpDebug('[Auth] Basic auth successful');
        return accessToken;

      } catch (testError: any) {
        throw new Error(`Basic auth failed: Invalid credentials`);
      }

    } catch (error: any) {
      mcpDebug('[Auth] Basic auth failed:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  /**
   * Authenticate using username and password from environment (fallback method)
   * Used when OAuth fails and SERVICENOW_USERNAME/PASSWORD env vars are set
   */
  private async authenticateWithPassword(context: ServiceNowContext): Promise<string> {
    const cacheKey = this.getCacheKey(context.instanceUrl);

    try {
      // First try context credentials (from auth.json), then environment variables
      let username = context.username;
      let password = context.password;

      // Fall back to environment variables if context credentials not available
      if (!username || !password || username.trim() === '' || password.trim() === '') {
        username = process.env.SERVICENOW_USERNAME;
        password = process.env.SERVICENOW_PASSWORD;
      }

      // Check for missing OR empty strings (reject empty credentials)
      if (!username || !password || username.trim() === '' || password.trim() === '') {
        throw new Error('No username/password available for basic authentication');
      }

      mcpDebug('[Auth] Using username/password authentication');

      // Create Basic Auth token
      const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');
      const accessToken = `Basic ${basicAuth}`;

      // Cache with long expiry (basic auth doesn't expire)
      const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours
      this.tokenCache.set(cacheKey, {
        accessToken,
        refreshToken: '', // No refresh token for basic auth
        expiresAt,
        instanceUrl: context.instanceUrl
      });

      // Test the credentials with a simple API call
      try {
        await axios.get(`${context.instanceUrl}/api/now/table/sys_user?sysparm_limit=1`, {
          headers: {
            'Authorization': accessToken,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        mcpDebug('[Auth] Username/password authentication successful');
        return accessToken;

      } catch (testError: any) {
        throw new Error(`Username/password authentication failed: Invalid credentials`);
      }

    } catch (error: any) {
      mcpDebug('[Auth] Username/password authentication failed:', error.message);
      throw new Error(`Authentication failed: ${error.message}`);
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
    mcpDebug('[Auth] Invalidated token for:', cacheKey);
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

      mcpDebug('[Auth] Loaded', this.tokenCache.size, 'cached tokens');
    } catch (error: any) {
      // Cache file doesn't exist or is corrupted - not critical
      if (error.code !== 'ENOENT') {
        mcpDebug('[Auth] Failed to load cache:', error.message);
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
      mcpDebug('[Auth] Token cache saved');
    } catch (error: any) {
      mcpDebug('[Auth] Failed to save cache:', error.message);
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
    mcpDebug('[Auth] Cache cleared');
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
