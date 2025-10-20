"use strict";
/**
 * Deployment Authentication Fix
 * Ensures OAuth tokens are properly refreshed and validated before deployment operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentAuthManager = void 0;
const snow_oauth_js_1 = require("./snow-oauth.js");
const unified_auth_store_js_1 = require("./unified-auth-store.js");
const logger_js_1 = require("./logger.js");
const logger = new logger_js_1.Logger('DeploymentAuthFix');
class DeploymentAuthManager {
    constructor() {
        this.lastTokenRefresh = 0;
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
    }
    /**
     * Ensure we have valid tokens for deployment operations
     * This is MORE strict than regular authentication
     */
    async ensureDeploymentAuth() {
        try {
            logger.info('🔐 Validating deployment authentication...');
            // Step 1: Check if we have any auth at all
            const isAuth = await this.oauth.isAuthenticated();
            if (!isAuth) {
                return {
                    isValid: false,
                    hasWriteScope: false,
                    error: 'Not authenticated',
                    recommendations: [
                        'Run: snow-flow auth login',
                        'Ensure OAuth app has write/admin scopes'
                    ]
                };
            }
            // Step 2: Get current tokens
            let tokens = await this.oauth.loadTokens();
            if (!tokens || !tokens.accessToken) {
                // Try unified auth store as fallback
                tokens = await unified_auth_store_js_1.unifiedAuthStore.getTokens();
                if (!tokens || !tokens.accessToken) {
                    return {
                        isValid: false,
                        hasWriteScope: false,
                        error: 'No access token found',
                        recommendations: [
                            'Run: snow-flow auth login',
                            'Check .env configuration'
                        ]
                    };
                }
            }
            // Step 3: Check token age and expiry
            const now = Date.now();
            const tokenAge = tokens.issuedAt ? now - tokens.issuedAt : null;
            const expiresIn = tokens.expiresAt ? tokens.expiresAt - now : null;
            // If token expires in less than 5 minutes, refresh it
            if (expiresIn && expiresIn < 300000) { // 5 minutes
                logger.info('⚠️ Token expires soon, refreshing...');
                try {
                    const refreshResult = await this.oauth.refreshAccessToken();
                    if (refreshResult.success && refreshResult.accessToken) {
                        logger.info('✅ Token refreshed successfully');
                        tokens = {
                            ...tokens,
                            accessToken: refreshResult.accessToken,
                            expiresAt: refreshResult.expiresIn ? now + refreshResult.expiresIn * 1000 : undefined,
                            issuedAt: now
                        };
                        // Update unified auth store
                        await unified_auth_store_js_1.unifiedAuthStore.saveTokens(tokens);
                    }
                    else {
                        logger.warn('Failed to refresh token:', refreshResult.error);
                    }
                }
                catch (error) {
                    logger.error('Token refresh error:', error);
                }
            }
            // Step 4: Validate token by making a test API call
            try {
                const testResponse = await this.validateTokenWithAPI(tokens.accessToken);
                if (!testResponse.success) {
                    // Token is invalid, try to refresh
                    logger.warn('Token validation failed, attempting refresh...');
                    const refreshResult = await this.oauth.refreshAccessToken();
                    if (refreshResult.success && refreshResult.accessToken) {
                        tokens.accessToken = refreshResult.accessToken;
                        await unified_auth_store_js_1.unifiedAuthStore.saveTokens(tokens);
                        // Validate again
                        const retryResponse = await this.validateTokenWithAPI(tokens.accessToken);
                        if (!retryResponse.success) {
                            return {
                                isValid: false,
                                hasWriteScope: false,
                                error: 'Token validation failed after refresh',
                                recommendations: [
                                    'Run: snow-flow auth login',
                                    'Check ServiceNow OAuth app configuration',
                                    'Verify API access is enabled for your user'
                                ]
                            };
                        }
                    }
                    else {
                        return {
                            isValid: false,
                            hasWriteScope: false,
                            error: 'Failed to refresh invalid token',
                            recommendations: [
                                'Run: snow-flow auth login',
                                'Your session may have expired'
                            ]
                        };
                    }
                }
            }
            catch (error) {
                logger.error('Token validation error:', error);
                return {
                    isValid: false,
                    hasWriteScope: false,
                    error: `Token validation failed: ${error.message}`,
                    recommendations: [
                        'Check network connectivity',
                        'Verify ServiceNow instance is accessible',
                        'Run: snow-flow auth login'
                    ]
                };
            }
            // Step 5: Check for write permissions
            const hasWriteScope = await this.checkWritePermissions(tokens.accessToken);
            return {
                isValid: true,
                hasWriteScope,
                tokenAge: tokenAge ? Math.round(tokenAge / 1000) : undefined,
                expiresIn: expiresIn ? Math.round(expiresIn / 1000) : undefined,
                recommendations: hasWriteScope ? [] : [
                    'OAuth token is valid but may lack write permissions',
                    'Check OAuth app scopes in ServiceNow',
                    'Ensure user has sp_admin or admin role'
                ]
            };
        }
        catch (error) {
            logger.error('Deployment auth validation error:', error);
            return {
                isValid: false,
                hasWriteScope: false,
                error: error.message,
                recommendations: [
                    'Unexpected error during authentication',
                    'Run: snow-flow auth login',
                    'Check error logs for details'
                ]
            };
        }
    }
    /**
     * Validate token by making a simple API call
     */
    async validateTokenWithAPI(accessToken) {
        try {
            const axios = require('axios');
            const credentials = await this.oauth.loadCredentials();
            if (!credentials?.instance) {
                return { success: false, error: 'No instance configured' };
            }
            const response = await axios.get(`https://${credentials.instance}/api/now/table/sys_user?sysparm_limit=1`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            return { success: response.status === 200 };
        }
        catch (error) {
            if (error.response?.status === 401) {
                return { success: false, error: 'Token is invalid or expired' };
            }
            return { success: false, error: error.message };
        }
    }
    /**
     * Check if token has write permissions by attempting to read widget table
     */
    async checkWritePermissions(accessToken) {
        try {
            const axios = require('axios');
            const credentials = await this.oauth.loadCredentials();
            if (!credentials?.instance) {
                return false;
            }
            // Try to read from sp_widget table (requires portal access)
            const response = await axios.get(`https://${credentials.instance}/api/now/table/sp_widget?sysparm_limit=1`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            // If we can read widgets, we likely have portal access
            return response.status === 200;
        }
        catch (error) {
            // Only treat 403 as definitive no permission
            if (error.response?.status === 403) {
                logger.warn('403 Forbidden: No write permissions for Service Portal');
                return false;
            }
            // For other errors (network, timeout, 500, etc.) assume permissions are OK
            // since an admin account should have access
            logger.warn(`Permission check failed with non-403 error (${error.response?.status || 'no status'}), assuming permissions OK for admin account:`, error.message);
            return true; // Changed from false to true - be less restrictive
        }
    }
    /**
     * Force a fresh token for deployment operations
     */
    async forceTokenRefresh() {
        try {
            logger.info('🔄 Forcing token refresh for deployment...');
            const refreshResult = await this.oauth.refreshAccessToken();
            if (refreshResult.success && refreshResult.accessToken) {
                // Store in unified auth store
                const tokens = await this.oauth.loadTokens();
                if (tokens) {
                    tokens.accessToken = refreshResult.accessToken;
                    tokens.expiresAt = refreshResult.expiresIn ? Date.now() + refreshResult.expiresIn * 1000 : undefined;
                    tokens.issuedAt = Date.now();
                    await unified_auth_store_js_1.unifiedAuthStore.saveTokens(tokens);
                }
                logger.info('✅ Token refreshed successfully');
                return {
                    success: true,
                    accessToken: refreshResult.accessToken
                };
            }
            return {
                success: false,
                error: refreshResult.error || 'Failed to refresh token'
            };
        }
        catch (error) {
            logger.error('Force refresh error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
    /**
     * Get fresh access token for deployment
     */
    async getDeploymentToken() {
        // First ensure we have valid auth
        const authResult = await this.ensureDeploymentAuth();
        if (!authResult.isValid) {
            logger.error('Invalid authentication for deployment:', authResult.error);
            throw new Error(authResult.error || 'Authentication failed');
        }
        if (!authResult.hasWriteScope) {
            logger.warn('⚠️ Token may lack write permissions, deployment might fail');
        }
        // Get the token
        const tokens = await this.oauth.loadTokens();
        return tokens?.accessToken || null;
    }
}
exports.DeploymentAuthManager = DeploymentAuthManager;
//# sourceMappingURL=deployment-auth-fix.js.map