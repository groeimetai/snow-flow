/**
 * Unified Authentication Store for ServiceNow
 * 
 * Provides shared token storage accessible from both CLI and MCP contexts.
 * Solves the token isolation problem between different execution contexts.
 */

import { promises as fs } from 'fs';
import { join } from 'path';
import os from 'os';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface AuthTokens {
  instance: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

export class UnifiedAuthStore {
  private static instance: UnifiedAuthStore;
  private tokenPath: string;
  private memoryStore: AuthTokens | null = null;

  constructor() {
    // Use consistent path across all contexts
    const configDir = process.env.SNOW_FLOW_HOME || join(os.homedir(), '.snow-flow');
    this.tokenPath = join(configDir, 'auth.json');
    
    // Also check environment for shared tokens (from MCP bridge)
    if (process.env.SNOW_OAUTH_TOKENS) {
      try {
        this.memoryStore = JSON.parse(process.env.SNOW_OAUTH_TOKENS);
      } catch (e) {
        console.error('Failed to parse SNOW_OAUTH_TOKENS from environment');
      }
    }
  }

  static getInstance(): UnifiedAuthStore {
    if (!UnifiedAuthStore.instance) {
      UnifiedAuthStore.instance = new UnifiedAuthStore();
    }
    return UnifiedAuthStore.instance;
  }

  /**
   * Get tokens from file or memory
   */
  async getTokens(): Promise<AuthTokens | null> {
    try {
      // First check memory store (fastest)
      if (this.memoryStore) {
        return this.memoryStore;
      }

      // Then check file system
      const data = await fs.readFile(this.tokenPath, 'utf8');
      const tokens = JSON.parse(data);
      
      // Cache in memory for performance
      this.memoryStore = tokens;
      
      return tokens;
    } catch (error) {
      // Fallback to environment variables
      return this.getTokensFromEnv();
    }
  }

  /**
   * Save tokens to file and memory
   */
  async saveTokens(tokens: AuthTokens): Promise<void> {
    try {
      const configDir = join(os.homedir(), '.snow-flow');
      await fs.mkdir(configDir, { recursive: true });
      
      await fs.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
      
      // Update memory store
      this.memoryStore = tokens;
      
      // Update environment for child processes
      process.env.SNOW_OAUTH_TOKENS = JSON.stringify(tokens);
    } catch (error) {
      console.error('Failed to save tokens:', error);
      throw error;
    }
  }

  /**
   * Get tokens from environment variables (fallback)
   */
  private getTokensFromEnv(): AuthTokens | null {
    const instance = process.env.SNOW_INSTANCE;
    const clientId = process.env.SNOW_CLIENT_ID;
    const clientSecret = process.env.SNOW_CLIENT_SECRET;
    
    if (!instance || !clientId || !clientSecret) {
      return null;
    }
    
    return {
      instance: instance.replace(/\/$/, ''),
      clientId,
      clientSecret,
      accessToken: process.env.SNOW_ACCESS_TOKEN,
      refreshToken: process.env.SNOW_REFRESH_TOKEN,
      expiresAt: process.env.SNOW_TOKEN_EXPIRES_AT
    };
  }

  /**
   * Check if tokens are valid and not expired
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = await this.getTokens();
      if (!tokens || !tokens.accessToken) {
        return false;
      }
      
      // Check expiration
      if (tokens.expiresAt) {
        const expiresAt = new Date(tokens.expiresAt);
        const now = new Date();
        return now < expiresAt;
      }
      
      // If no expiration, assume valid
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear all stored tokens
   */
  async clearTokens(): Promise<void> {
    try {
      await fs.unlink(this.tokenPath);
    } catch (error) {
      // Ignore if file doesn't exist
    }
    
    // Clear memory and environment
    this.memoryStore = null;
    delete process.env.SNOW_OAUTH_TOKENS;
    delete process.env.SNOW_ACCESS_TOKEN;
    delete process.env.SNOW_REFRESH_TOKEN;
    delete process.env.SNOW_TOKEN_EXPIRES_AT;
  }

  /**
   * Get ServiceNow instance URL
   */
  async getInstanceUrl(): Promise<string | null> {
    const tokens = await this.getTokens();
    if (!tokens) {
      return null;
    }
    
    let instance = tokens.instance;
    if (!instance.startsWith('http')) {
      instance = `https://${instance}`;
    }
    if (!instance.endsWith('.service-now.com')) {
      instance = `${instance}.service-now.com`;
    }
    
    return instance;
  }

  /**
   * Get headers for API requests
   */
  async getAuthHeaders(): Promise<Record<string, string> | null> {
    const tokens = await this.getTokens();
    if (!tokens || !tokens.accessToken) {
      return null;
    }
    
    return {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
  }

  /**
   * Bridge tokens to MCP servers via environment
   */
  async bridgeToMCP(): Promise<void> {
    const tokens = await this.getTokens();
    if (tokens) {
      process.env.SNOW_OAUTH_TOKENS = JSON.stringify(tokens);
      process.env.SNOW_INSTANCE = tokens.instance;
      process.env.SNOW_CLIENT_ID = tokens.clientId;
      process.env.SNOW_CLIENT_SECRET = tokens.clientSecret;
      
      if (tokens.accessToken) {
        process.env.SNOW_ACCESS_TOKEN = tokens.accessToken;
      }
      if (tokens.refreshToken) {
        process.env.SNOW_REFRESH_TOKEN = tokens.refreshToken;
      }
      if (tokens.expiresAt) {
        process.env.SNOW_TOKEN_EXPIRES_AT = tokens.expiresAt;
      }
    }
  }
}

// Export singleton instance
export const unifiedAuthStore = UnifiedAuthStore.getInstance();