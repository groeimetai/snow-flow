"use strict";
/**
 * Unified Authentication Store for ServiceNow
 *
 * Provides shared token storage accessible from both CLI and MCP contexts.
 * Solves the token isolation problem between different execution contexts.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.unifiedAuthStore = exports.UnifiedAuthStore = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = __importDefault(require("os"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
class UnifiedAuthStore {
    constructor() {
        this.memoryStore = null;
        // Use consistent path across all contexts
        const configDir = process.env.SNOW_FLOW_HOME || (0, path_1.join)(os_1.default.homedir(), '.snow-flow');
        this.tokenPath = (0, path_1.join)(configDir, 'auth.json');
        // Also check environment for shared tokens (from MCP bridge)
        if (process.env.SNOW_OAUTH_TOKENS) {
            try {
                this.memoryStore = JSON.parse(process.env.SNOW_OAUTH_TOKENS);
            }
            catch (e) {
                console.error('Failed to parse SNOW_OAUTH_TOKENS from environment');
            }
        }
    }
    static getInstance() {
        if (!UnifiedAuthStore.instance) {
            UnifiedAuthStore.instance = new UnifiedAuthStore();
        }
        return UnifiedAuthStore.instance;
    }
    /**
     * Get tokens from file or memory
     */
    async getTokens() {
        try {
            // First check memory store (fastest)
            if (this.memoryStore) {
                return this.memoryStore;
            }
            // Then check file system
            const data = await fs_1.promises.readFile(this.tokenPath, 'utf8');
            const tokens = JSON.parse(data);
            // Cache in memory for performance
            this.memoryStore = tokens;
            return tokens;
        }
        catch (error) {
            // Fallback to environment variables
            return this.getTokensFromEnv();
        }
    }
    /**
     * Save tokens to file and memory
     */
    async saveTokens(tokens) {
        try {
            const configDir = (0, path_1.join)(os_1.default.homedir(), '.snow-flow');
            await fs_1.promises.mkdir(configDir, { recursive: true });
            await fs_1.promises.writeFile(this.tokenPath, JSON.stringify(tokens, null, 2));
            // Update memory store
            this.memoryStore = tokens;
            // Update environment for child processes
            process.env.SNOW_OAUTH_TOKENS = JSON.stringify(tokens);
        }
        catch (error) {
            console.error('Failed to save tokens:', error);
            throw error;
        }
    }
    /**
     * Get tokens from environment variables (fallback)
     */
    getTokensFromEnv() {
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
    async isAuthenticated() {
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
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Clear all stored tokens
     */
    async clearTokens() {
        try {
            await fs_1.promises.unlink(this.tokenPath);
        }
        catch (error) {
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
    async getInstanceUrl() {
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
    async getAuthHeaders() {
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
    async bridgeToMCP() {
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
exports.UnifiedAuthStore = UnifiedAuthStore;
// Export singleton instance
exports.unifiedAuthStore = UnifiedAuthStore.getInstance();
//# sourceMappingURL=unified-auth-store.js.map