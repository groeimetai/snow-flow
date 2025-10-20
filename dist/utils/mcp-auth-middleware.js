"use strict";
/**
 * Centralized MCP Authentication Middleware
 * Handles ServiceNow OAuth authentication across all MCP servers
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.mcpAuth = exports.MCPAuthenticationMiddleware = void 0;
const snow_oauth_js_1 = require("./snow-oauth.js");
const mcp_config_manager_js_1 = require("./mcp-config-manager.js");
const logger_js_1 = require("./logger.js");
class MCPAuthenticationMiddleware {
    constructor() {
        this.lastAuthCheck = null;
        this.authCheckInterval = 5 * 60 * 1000; // 5 minutes
        this.logger = new logger_js_1.Logger('MCPAuthMiddleware');
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
    }
    static getInstance() {
        if (!MCPAuthenticationMiddleware.instance) {
            MCPAuthenticationMiddleware.instance = new MCPAuthenticationMiddleware();
        }
        return MCPAuthenticationMiddleware.instance;
    }
    /**
     * Ensure authentication is valid before MCP operations
     */
    async ensureAuthenticated() {
        try {
            // Check if we need to refresh authentication
            if (this.shouldCheckAuth()) {
                this.logger.debug('Checking authentication status...');
                const isAuthenticated = await this.oauth.isAuthenticated();
                if (!isAuthenticated) {
                    this.logger.warn('Authentication expired or invalid');
                    return {
                        success: false,
                        error: 'ServiceNow authentication expired. Please run "snow-flow auth login" again.',
                        needsReauth: true
                    };
                }
                this.lastAuthCheck = new Date();
            }
            // Get current token
            const token = await this.oauth.getAccessToken();
            if (!token) {
                return {
                    success: false,
                    error: 'No access token available. Please authenticate first.',
                    needsReauth: true
                };
            }
            return {
                success: true,
                token
            };
        }
        catch (error) {
            this.logger.error('Authentication check failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Authentication check failed',
                needsReauth: true
            };
        }
    }
    /**
     * Check if authentication status should be verified
     */
    shouldCheckAuth() {
        if (!this.lastAuthCheck)
            return true;
        const timeSinceLastCheck = Date.now() - this.lastAuthCheck.getTime();
        return timeSinceLastCheck > this.authCheckInterval;
    }
    /**
     * Handle authentication errors with automatic retry
     */
    async handleAuthError(error) {
        this.logger.warn('Handling authentication error:', error);
        // Check if this is an authentication-related error
        if (this.isAuthError(error)) {
            // Try to refresh token
            try {
                const credentials = await this.oauth.loadCredentials();
                if (credentials) {
                    const refreshResult = await this.oauth.refreshAccessToken(credentials);
                    if (refreshResult.success) {
                        this.logger.info('Token refreshed successfully');
                        return {
                            success: true,
                            token: refreshResult.accessToken
                        };
                    }
                }
            }
            catch (refreshError) {
                this.logger.error('Token refresh failed:', refreshError);
            }
            // If refresh failed, require re-authentication
            return {
                success: false,
                error: 'Authentication failed. Please run "snow-flow auth login" again.',
                needsReauth: true
            };
        }
        // Not an auth error, return original error
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
    /**
     * Check if an error is authentication-related
     */
    isAuthError(error) {
        if (!error)
            return false;
        const errorMessage = error.message || error.toString() || '';
        const errorCode = error.status || error.code || 0;
        // Check for common authentication error patterns
        const authErrorPatterns = [
            'unauthorized',
            'authentication',
            'expired',
            'invalid token',
            'access denied',
            'forbidden'
        ];
        const isAuthMessage = authErrorPatterns.some(pattern => errorMessage.toLowerCase().includes(pattern));
        const isAuthCode = [401, 403].includes(errorCode);
        return isAuthMessage || isAuthCode;
    }
    /**
     * Get ServiceNow instance information
     */
    async getInstanceInfo() {
        const config = mcp_config_manager_js_1.mcpConfig.getServiceNowConfig();
        const authenticated = await this.oauth.isAuthenticated();
        return {
            instance: config.instanceUrl || 'Not configured',
            authenticated
        };
    }
    /**
     * Wrapper for MCP operations with authentication
     */
    async withAuth(operation) {
        const authResult = await this.ensureAuthenticated();
        if (!authResult.success) {
            throw new Error(authResult.error || 'Authentication failed');
        }
        try {
            return await operation(authResult.token);
        }
        catch (error) {
            // Handle potential authentication errors during operation
            const authErrorResult = await this.handleAuthError(error);
            if (authErrorResult.needsReauth) {
                throw new Error(authErrorResult.error || 'Authentication required');
            }
            // If we successfully refreshed the token, retry the operation
            if (authErrorResult.success && authErrorResult.token) {
                return await operation(authErrorResult.token);
            }
            // Re-throw original error if not auth-related
            throw error;
        }
    }
    /**
     * Get authentication headers for HTTP requests
     */
    async getAuthHeaders() {
        const authResult = await this.ensureAuthenticated();
        if (!authResult.success) {
            throw new Error(authResult.error || 'Authentication failed');
        }
        return {
            'Authorization': `Bearer ${authResult.token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
    /**
     * Force authentication refresh
     */
    async forceRefresh() {
        this.logger.info('Forcing authentication refresh...');
        this.lastAuthCheck = null;
        try {
            const credentials = await this.oauth.loadCredentials();
            if (credentials) {
                const refreshResult = await this.oauth.refreshAccessToken(credentials);
                if (refreshResult.success) {
                    return {
                        success: true,
                        token: refreshResult.accessToken
                    };
                }
                else {
                    return {
                        success: false,
                        error: 'Token refresh failed',
                        needsReauth: true
                    };
                }
            }
            else {
                return {
                    success: false,
                    error: 'No credentials available',
                    needsReauth: true
                };
            }
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Refresh failed',
                needsReauth: true
            };
        }
    }
}
exports.MCPAuthenticationMiddleware = MCPAuthenticationMiddleware;
// Export singleton instance
exports.mcpAuth = MCPAuthenticationMiddleware.getInstance();
//# sourceMappingURL=mcp-auth-middleware.js.map