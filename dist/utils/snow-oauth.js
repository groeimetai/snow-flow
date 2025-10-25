#!/usr/bin/env node
"use strict";
/**
 * ServiceNow OAuth Authentication Utility with Code Paste Flow
 * Handles OAuth2 flow for ServiceNow integration (Claude-style)
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
exports.ServiceNowOAuth = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = __importDefault(require("os"));
const http_1 = require("http");
const url_1 = require("url");
const axios_1 = __importDefault(require("axios"));
const https_1 = __importDefault(require("https"));
const net_1 = __importDefault(require("net"));
const crypto_1 = __importDefault(require("crypto"));
const chalk_1 = __importDefault(require("chalk"));
const prompts = __importStar(require("@clack/prompts"));
const snow_flow_config_js_1 = require("../config/snow-flow-config.js");
const unified_auth_store_js_1 = require("./unified-auth-store.js");
const oauth_html_templates_js_1 = require("./oauth-html-templates.js");
class ServiceNowOAuth {
    constructor() {
        // 🔒 SEC-002 FIX: Add rate limiting to prevent authentication bypass attacks
        this.lastTokenRequest = 0;
        this.tokenRequestCount = 0;
        this.TOKEN_REQUEST_WINDOW_MS = 60000; // 1 minute window
        this.MAX_TOKEN_REQUESTS_PER_WINDOW = 10; // Max 10 token requests per minute
        // Store tokens in user's home directory
        const configDir = process.env.SNOW_FLOW_HOME || (0, path_1.join)(os_1.default.homedir(), '.snow-flow');
        this.tokenPath = (0, path_1.join)(configDir, 'auth.json');
    }
    /**
     * 🔒 SEC-002 FIX: Check rate limiting for token requests to prevent brute force attacks
     */
    checkTokenRequestRateLimit() {
        const now = Date.now();
        // Reset counter if window has passed
        if (now - this.lastTokenRequest > this.TOKEN_REQUEST_WINDOW_MS) {
            this.tokenRequestCount = 0;
            this.lastTokenRequest = now;
        }
        // Check if within rate limit
        if (this.tokenRequestCount >= this.MAX_TOKEN_REQUESTS_PER_WINDOW) {
            console.log(chalk_1.default.yellow('🔒 Rate limit exceeded: Too many token requests. Please wait before retrying.'));
            return false;
        }
        this.tokenRequestCount++;
        return true;
    }
    /**
     * Generate a random state parameter for CSRF protection
     */
    generateState() {
        return Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
    }
    /**
     * Generate PKCE code verifier and challenge
     */
    generatePKCE() {
        // Generate code verifier (43-128 characters)
        this.codeVerifier = crypto_1.default.randomBytes(32).toString('base64url');
        // Generate code challenge (SHA256 hash of verifier)
        const hash = crypto_1.default.createHash('sha256');
        hash.update(this.codeVerifier);
        this.codeChallenge = hash.digest('base64url');
    }
    /**
     * Check if a specific port is available
     */
    async checkPortAvailable(port) {
        return new Promise((resolve) => {
            const server = net_1.default.createServer();
            server.on('error', () => {
                resolve(false);
            });
            server.listen(port, () => {
                server.close(() => {
                    resolve(true);
                });
            });
        });
    }
    /**
     * 🔧 CRIT-002 FIX: Normalize instance URL to prevent trailing slash 400 errors
     */
    normalizeInstanceUrl(instance) {
        // Remove any trailing slashes that cause 400 errors
        let normalized = instance.replace(/\/+$/, '');
        // Add https:// if missing
        if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
            normalized = `https://${normalized}`;
        }
        // Ensure .service-now.com suffix if it's just the instance name
        if (!normalized.includes('.service-now.com') && !normalized.includes('localhost') && !normalized.includes('127.0.0.1')) {
            const instanceName = normalized.replace('https://', '').replace('http://', '');
            normalized = `https://${instanceName}.service-now.com`;
        }
        return normalized;
    }
    /**
     * 🎯 NEW: Simplified OAuth flow with code paste (Claude-style)
     * No local server required - user manually pastes authorization code
     */
    async authenticateWithCodePaste(instance, clientId, clientSecret) {
        try {
            // Normalize instance URL
            const normalizedInstance = this.normalizeInstanceUrl(instance);
            // Validate client secret
            const secretValidation = this.validateClientSecret(clientSecret);
            if (!secretValidation.valid) {
                console.log(chalk_1.default.red('❌ Invalid OAuth Client Secret:'), secretValidation.reason);
                console.log(chalk_1.default.blue('💡 To get a valid OAuth secret:'));
                console.log(chalk_1.default.gray('   1. Log into ServiceNow as admin'));
                console.log(chalk_1.default.gray('   2. Navigate to: System OAuth > Application Registry'));
                console.log(chalk_1.default.gray('   3. Create a new OAuth application'));
                console.log(chalk_1.default.gray('   4. Copy the generated Client Secret (long random string)'));
                return {
                    success: false,
                    error: secretValidation.reason
                };
            }
            // For code paste flow, we use a special redirect URI that shows the code
            const redirectUri = 'urn:ietf:wg:oauth:2.0:oob'; // Out-of-band redirect for manual code entry
            // Store credentials
            this.credentials = {
                instance: normalizedInstance.replace('https://', '').replace('http://', ''),
                clientId,
                clientSecret,
                redirectUri
            };
            console.log(chalk_1.default.blue('\n🚀 Starting ServiceNow OAuth flow...\n'));
            console.log(chalk_1.default.gray('📋 Instance:'), chalk_1.default.cyan(normalizedInstance));
            console.log(chalk_1.default.gray('🔐 Client ID:'), chalk_1.default.cyan(clientId));
            // Generate state parameter and PKCE
            this.stateParameter = this.generateState();
            this.generatePKCE();
            // Generate authorization URL
            const authUrl = this.generateAuthUrl(this.credentials.instance, clientId, redirectUri);
            console.log(chalk_1.default.blue('\n🌐 Authorization URL generated:\n'));
            console.log(chalk_1.default.cyan(authUrl));
            console.log('');
            // Ask user to open URL and paste code
            console.log(chalk_1.default.yellow('●  Go to: ') + chalk_1.default.underline.cyan(authUrl));
            console.log('');
            const authCode = await prompts.text({
                message: 'Paste the authorization code here',
                placeholder: 'Enter the code from the browser after authorizing',
                validate: (value) => {
                    if (!value || value.trim() === '')
                        return 'Authorization code is required';
                    if (value.length < 10)
                        return 'Code seems too short - please paste the full authorization code';
                }
            });
            if (prompts.isCancel(authCode)) {
                return {
                    success: false,
                    error: 'Authentication cancelled by user'
                };
            }
            // Extract code if user pasted full URL
            let code = authCode.trim();
            if (code.includes('code=')) {
                const match = code.match(/code=([^&]+)/);
                if (match) {
                    code = match[1];
                }
            }
            // Exchange code for tokens
            console.log(chalk_1.default.blue('\n🔄 Exchanging authorization code for tokens...\n'));
            const tokenResult = await this.exchangeCodeForTokens(code);
            if (tokenResult.success && tokenResult.accessToken) {
                // Save tokens
                await this.saveTokens({
                    accessToken: tokenResult.accessToken,
                    refreshToken: tokenResult.refreshToken || '',
                    expiresIn: tokenResult.expiresIn || 3600,
                    instance: this.credentials.instance,
                    clientId,
                    clientSecret
                });
                console.log(chalk_1.default.green('\n✅ Authentication successful!'));
                console.log(chalk_1.default.gray('🔐 Tokens saved securely\n'));
            }
            return tokenResult;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(chalk_1.default.red('❌ Authentication failed:'), errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Original OAuth flow with local server (fallback)
     */
    async authenticate(instance, clientId, clientSecret) {
        try {
            // 🔧 CRIT-002 FIX: Apply URL normalization
            const normalizedInstance = this.normalizeInstanceUrl(instance);
            // Validate client secret format
            const secretValidation = this.validateClientSecret(clientSecret);
            if (!secretValidation.valid) {
                console.log(chalk_1.default.red('❌ Invalid OAuth Client Secret:'), secretValidation.reason);
                console.log(chalk_1.default.blue('💡 To get a valid OAuth secret:'));
                console.log(chalk_1.default.gray('   1. Log into ServiceNow as admin'));
                console.log(chalk_1.default.gray('   2. Navigate to: System OAuth > Application Registry'));
                console.log(chalk_1.default.gray('   3. Create a new OAuth application'));
                console.log(chalk_1.default.gray('   4. Copy the generated Client Secret (long random string)'));
                return {
                    success: false,
                    error: secretValidation.reason
                };
            }
            // Get OAuth redirect configuration from environment or use defaults
            const oauthConfig = snow_flow_config_js_1.snowFlowConfig.servicenow.oauth;
            const port = oauthConfig.redirectPort;
            const host = oauthConfig.redirectHost;
            const path = oauthConfig.redirectPath;
            const redirectUri = `http://${host}:${port}${path}`;
            // Check if port is available
            const isPortAvailable = await this.checkPortAvailable(port);
            if (!isPortAvailable) {
                console.log(chalk_1.default.red(`❌ Port ${port} is already in use!`));
                console.log(chalk_1.default.yellow(`💡 Please close any application using port ${port} and try again.`));
                return {
                    success: false,
                    error: `Port ${port} is already in use. Please free up the port and try again.`
                };
            }
            // Store credentials temporarily with normalized instance
            this.credentials = {
                instance: normalizedInstance.replace('https://', '').replace('http://', ''),
                clientId,
                clientSecret,
                redirectUri
            };
            console.log(chalk_1.default.blue('\n🚀 Starting ServiceNow OAuth flow...\n'));
            console.log(chalk_1.default.gray('📋 Instance:'), chalk_1.default.cyan(normalizedInstance));
            console.log(chalk_1.default.gray('🔐 Client ID:'), chalk_1.default.cyan(clientId));
            console.log(chalk_1.default.gray('🔗 Redirect URI:'), chalk_1.default.cyan(redirectUri));
            // Generate state parameter for CSRF protection
            this.stateParameter = this.generateState();
            // Generate PKCE parameters
            this.generatePKCE();
            // Generate authorization URL
            const authUrl = this.generateAuthUrl(this.credentials.instance, clientId, redirectUri);
            console.log(chalk_1.default.blue('\n🌐 Authorization URL generated:\n'));
            console.log(chalk_1.default.cyan(authUrl));
            console.log('');
            // Start local server to handle callback
            const authResult = await this.startCallbackServer(redirectUri, port);
            if (authResult.success && authResult.accessToken) {
                // Save tokens with normalized instance
                await this.saveTokens({
                    accessToken: authResult.accessToken,
                    refreshToken: authResult.refreshToken || '',
                    expiresIn: authResult.expiresIn || 3600,
                    instance: this.credentials.instance,
                    clientId,
                    clientSecret
                });
                console.log(chalk_1.default.green('\n✅ Authentication successful!'));
                console.log(chalk_1.default.gray('🔐 Tokens saved securely\n'));
            }
            return authResult;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(chalk_1.default.red('❌ Authentication failed:'), errorMessage);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Generate ServiceNow OAuth authorization URL
     */
    generateAuthUrl(instance, clientId, redirectUri) {
        const baseUrl = `https://${instance}/oauth_auth.do`;
        const params = new URLSearchParams({
            response_type: 'code',
            client_id: clientId,
            redirect_uri: redirectUri,
            scope: 'useraccount write admin',
            state: this.stateParameter || '',
            code_challenge: this.codeChallenge || '',
            code_challenge_method: 'S256'
        });
        return `${baseUrl}?${params.toString()}`;
    }
    /**
     * Start local HTTP server to handle OAuth callback
     */
    async startCallbackServer(redirectUri, port) {
        return new Promise((resolve) => {
            const server = (0, http_1.createServer)(async (req, res) => {
                try {
                    const url = new url_1.URL(req.url, `http://${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectHost}:${port}`);
                    if (url.pathname === '/callback') {
                        const code = url.searchParams.get('code');
                        const error = url.searchParams.get('error');
                        const state = url.searchParams.get('state');
                        // Validate state parameter
                        if (state !== this.stateParameter) {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end(oauth_html_templates_js_1.OAuthTemplates.securityError);
                            server.close();
                            resolve({
                                success: false,
                                error: 'Invalid state parameter'
                            });
                            return;
                        }
                        if (error) {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end(oauth_html_templates_js_1.OAuthTemplates.error(error));
                            server.close();
                            resolve({
                                success: false,
                                error: `OAuth error: ${error}`
                            });
                            return;
                        }
                        if (!code) {
                            res.writeHead(400, { 'Content-Type': 'text/html' });
                            res.end(oauth_html_templates_js_1.OAuthTemplates.missingCode);
                            server.close();
                            resolve({
                                success: false,
                                error: 'No authorization code received'
                            });
                            return;
                        }
                        // Exchange code for tokens
                        console.log(chalk_1.default.blue('🔄 Exchanging authorization code for tokens...'));
                        const tokenResult = await this.exchangeCodeForTokens(code);
                        if (tokenResult.success) {
                            res.writeHead(200, { 'Content-Type': 'text/html' });
                            res.end(oauth_html_templates_js_1.OAuthTemplates.success);
                            server.close();
                            resolve(tokenResult);
                        }
                        else {
                            res.writeHead(500, { 'Content-Type': 'text/html' });
                            res.end(oauth_html_templates_js_1.OAuthTemplates.tokenExchangeFailed(tokenResult.error || 'Unknown error'));
                            server.close();
                            resolve(tokenResult);
                        }
                    }
                    else {
                        res.writeHead(404, { 'Content-Type': 'text/plain' });
                        res.end('Not Found');
                    }
                }
                catch (error) {
                    console.log(chalk_1.default.red('Callback server error:'), error);
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Internal Server Error');
                    server.close();
                    resolve({
                        success: false,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            });
            server.listen(port, () => {
                console.log(chalk_1.default.blue(`🌐 OAuth callback server started on`), chalk_1.default.cyan(`http://${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectHost}:${port}`));
                console.log(chalk_1.default.yellow('🚀 Please open the authorization URL in your browser...'));
                console.log(chalk_1.default.gray('⏳ Waiting for OAuth callback...'));
                // Auto-open browser if possible
                // Try to auto-open browser if not in headless environment
                const isCodespaces = process.env.CODESPACES === 'true';
                const isContainer = process.env.CONTAINER === 'true' || (0, fs_1.existsSync)('/.dockerenv');
                const isHeadless = isCodespaces || isContainer || process.env.CI === 'true';
                if (!isHeadless) {
                    try {
                        const { spawn } = require('child_process');
                        const authUrl = this.generateAuthUrl(this.credentials.instance, this.credentials.clientId, redirectUri);
                        let browserProcess;
                        // Try to open browser based on platform
                        if (process.platform === 'darwin') {
                            browserProcess = spawn('open', [authUrl], { detached: true, stdio: 'ignore' });
                        }
                        else if (process.platform === 'win32') {
                            browserProcess = spawn('cmd', ['/c', 'start', authUrl], { detached: true, stdio: 'ignore' });
                        }
                        else if (process.platform === 'linux') {
                            // Try multiple Linux browser openers
                            const openers = ['xdg-open', 'gnome-open', 'kde-open', 'sensible-browser'];
                            for (const opener of openers) {
                                try {
                                    browserProcess = spawn(opener, [authUrl], { detached: true, stdio: 'ignore' });
                                    break; // If successful, stop trying
                                }
                                catch (e) {
                                    // Try next opener
                                    continue;
                                }
                            }
                        }
                        else {
                            console.log(chalk_1.default.yellow('⚠️  Unknown OS:'), process.platform);
                        }
                        // Prevent the spawn from keeping the process alive
                        if (browserProcess && browserProcess.unref) {
                            browserProcess.unref();
                        }
                    }
                    catch (err) {
                        // Silently fail - user can manually open URL
                        console.log(chalk_1.default.yellow('\n📋 Browser auto-open failed. Please manually copy and open the URL above.'));
                    }
                }
                else {
                    console.log(chalk_1.default.yellow('\n🐳 Running in headless environment (Codespaces/Container/CI)'));
                    console.log(chalk_1.default.gray('📋 Please manually copy and open the authorization URL above in your browser.'));
                    if (isCodespaces) {
                        console.log(chalk_1.default.blue('\n💡 TIP for GitHub Codespaces:'));
                        console.log(chalk_1.default.gray('   1. Copy the authorization URL above'));
                        console.log(chalk_1.default.gray('   2. Open it in a new browser tab'));
                        console.log(chalk_1.default.gray('   3. After authorizing, you\'ll be redirected to localhost:3005'));
                        console.log(chalk_1.default.gray('   4. Copy the FULL redirect URL from your browser'));
                        console.log(chalk_1.default.gray('   5. Open a new Codespaces terminal and run:'));
                        console.log(chalk_1.default.cyan('      curl "http://localhost:3005/callback?code=YOUR_CODE&state=YOUR_STATE"'));
                        console.log(chalk_1.default.gray('   6. Or use port forwarding in Codespaces to make port 3005 accessible'));
                    }
                }
            });
        });
    }
    /**
     * Exchange authorization code for tokens
     */
    async exchangeCodeForTokens(code) {
        try {
            // 🔒 SEC-002 FIX: Apply rate limiting to prevent authentication bypass attacks
            if (!this.checkTokenRequestRateLimit()) {
                return {
                    success: false,
                    error: 'Rate limit exceeded. Too many token requests. Please wait 1 minute before retrying.'
                };
            }
            const tokenUrl = `https://${this.credentials.instance}/oauth_token.do`;
            const response = await axios_1.default.post(tokenUrl, new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                client_id: this.credentials.clientId,
                client_secret: this.credentials.clientSecret,
                redirect_uri: this.credentials.redirectUri,
                code_verifier: this.codeVerifier || ''
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000, // 🔒 SEC-002 FIX: 15 second timeout to prevent hanging requests
                // Allow self-signed certificates for dev instances
                httpsAgent: new https_1.default.Agent({
                    rejectUnauthorized: false
                })
            });
            const data = response.data;
            if (data.access_token) {
                return {
                    success: true,
                    accessToken: data.access_token,
                    refreshToken: data.refresh_token,
                    expiresIn: data.expires_in
                };
            }
            else {
                return {
                    success: false,
                    error: 'No access token received'
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(chalk_1.default.red('Token exchange error:'), errorMessage);
            if (axios_1.default.isAxiosError(error) && error.response) {
                console.log(chalk_1.default.red('Response data:'), error.response.data);
            }
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Save tokens to file
     */
    async saveTokens(tokenData) {
        try {
            const expiresAt = new Date();
            expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);
            const authData = {
                ...tokenData,
                expiresAt: expiresAt.toISOString()
            };
            // Use unified auth store
            await unified_auth_store_js_1.unifiedAuthStore.saveTokens(authData);
            // Bridge to MCP servers immediately
            await unified_auth_store_js_1.unifiedAuthStore.bridgeToMCP();
        }
        catch (error) {
            console.log(chalk_1.default.red('Failed to save tokens:'), error);
            throw error;
        }
    }
    /**
     * Load tokens from file
     */
    async loadTokens() {
        try {
            return await unified_auth_store_js_1.unifiedAuthStore.getTokens();
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Check if authenticated
     */
    async isAuthenticated() {
        try {
            const tokens = await this.loadTokens();
            if (!tokens)
                return false;
            // Check if token is expired
            const expiresAt = new Date(tokens.expiresAt);
            const now = new Date();
            return now < expiresAt;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get access token (refresh if needed)
     */
    async getAccessToken() {
        try {
            const tokens = await this.loadTokens();
            if (!tokens)
                return null;
            // Check if token is expired
            const expiresAt = new Date(tokens.expiresAt);
            const now = new Date();
            if (now >= expiresAt && tokens.refreshToken) {
                // Token expired, try to refresh
                console.log(chalk_1.default.yellow('🔄 Token expired, refreshing...'));
                const refreshResult = await this.refreshAccessToken(tokens);
                if (refreshResult.success && refreshResult.accessToken) {
                    // Update saved tokens
                    await this.saveTokens({
                        ...tokens,
                        accessToken: refreshResult.accessToken,
                        expiresIn: refreshResult.expiresIn || 3600
                    });
                    return refreshResult.accessToken;
                }
                else {
                    console.log(chalk_1.default.red('❌ Token refresh failed:'), refreshResult.error);
                    return null;
                }
            }
            return tokens.accessToken;
        }
        catch (error) {
            console.log(chalk_1.default.red('Failed to get access token:'), error);
            return null;
        }
    }
    /**
     * Refresh access token
     */
    async refreshAccessToken(tokens) {
        try {
            // 🔒 SEC-002 FIX: Apply rate limiting to prevent authentication bypass attacks
            if (!this.checkTokenRequestRateLimit()) {
                return {
                    success: false,
                    error: 'Rate limit exceeded. Too many token requests. Please wait 1 minute before retrying.'
                };
            }
            // If no tokens provided, load from file
            if (!tokens) {
                tokens = await this.loadTokens();
                if (!tokens) {
                    return {
                        success: false,
                        error: 'No tokens found to refresh'
                    };
                }
            }
            const tokenUrl = `https://${tokens.instance}/oauth_token.do`;
            const response = await axios_1.default.post(tokenUrl, new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: tokens.refreshToken,
                client_id: tokens.clientId,
                client_secret: tokens.clientSecret
            }), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 15000, // 🔒 SEC-002 FIX: 15 second timeout to prevent hanging requests
                // Allow self-signed certificates for dev instances
                httpsAgent: new https_1.default.Agent({
                    rejectUnauthorized: false
                })
            });
            const data = response.data;
            if (data.access_token) {
                // Update saved tokens
                await this.saveTokens({
                    ...tokens,
                    accessToken: data.access_token,
                    expiresIn: data.expires_in || 3600
                });
                return {
                    success: true,
                    accessToken: data.access_token,
                    expiresIn: data.expires_in
                };
            }
            else {
                return {
                    success: false,
                    error: 'No access token received'
                };
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: errorMessage
            };
        }
    }
    /**
     * Logout - clear saved tokens
     */
    async logout() {
        try {
            await fs_1.promises.unlink(this.tokenPath);
            console.log(chalk_1.default.green('✅ Logged out successfully'));
        }
        catch (error) {
            console.log(chalk_1.default.gray('No active session to logout from'));
        }
    }
    /**
     * Get stored OAuth tokens for use in other contexts (MCP servers)
     */
    async getStoredTokens() {
        return await this.loadTokens();
    }
    /**
     * Load credentials (including tokens) with .env fallback
     */
    async loadCredentials() {
        try {
            // First, try to load saved OAuth tokens
            const tokens = await this.loadTokens();
            if (tokens && tokens.accessToken) {
                // Validate client secret when loading
                if (tokens.clientSecret) {
                    const secretValidation = this.validateClientSecret(tokens.clientSecret);
                    if (!secretValidation.valid) {
                        console.log(chalk_1.default.yellow('⚠️  OAuth Configuration Issue:'), secretValidation.reason);
                        console.log(chalk_1.default.blue('💡 Your stored client secret may be incorrect. Re-authenticate with: snow-flow auth login'));
                    }
                }
                // Check if token is expired
                const expiresAt = new Date(tokens.expiresAt);
                const now = new Date();
                if (now < expiresAt) {
                    console.log(chalk_1.default.green('✅ Using saved OAuth tokens'));
                    return {
                        instance: tokens.instance,
                        clientId: tokens.clientId,
                        clientSecret: tokens.clientSecret,
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken,
                        expiresAt: tokens.expiresAt
                    };
                }
                else {
                    console.log(chalk_1.default.yellow('⏰ Saved OAuth token expired, will try refresh...'));
                }
            }
            // 🔧 NEW: Fallback to .env file if no valid tokens
            console.log(chalk_1.default.blue('🔍 No valid OAuth tokens found, checking .env file...'));
            // Load environment variables with dotenv
            try {
                require('dotenv').config();
            }
            catch (err) {
                console.log(chalk_1.default.gray('📝 dotenv not available, using process.env directly'));
            }
            const envInstance = process.env.SNOW_INSTANCE;
            const envClientId = process.env.SNOW_CLIENT_ID;
            const envClientSecret = process.env.SNOW_CLIENT_SECRET;
            if (envInstance && envClientId && envClientSecret) {
                console.log(chalk_1.default.green('✅ Found ServiceNow credentials in .env file'));
                console.log(chalk_1.default.gray(`   - Instance: ${envInstance}`));
                console.log(chalk_1.default.gray(`   - Client ID: ${envClientId}`));
                console.log(chalk_1.default.gray('   - Client Secret: ✅ Present'));
                // Validate client secret
                const secretValidation = this.validateClientSecret(envClientSecret);
                if (!secretValidation.valid) {
                    console.log(chalk_1.default.red('❌ Invalid OAuth Client Secret in .env file:'), secretValidation.reason);
                    console.log(chalk_1.default.yellow('💡 Please update SNOW_CLIENT_SECRET in .env with proper OAuth secret from ServiceNow'));
                    return null;
                }
                console.log('');
                console.log(chalk_1.default.blue('🔐 OAuth Setup Required:'));
                console.log(chalk_1.default.gray('   Your .env has OAuth credentials but no active session.'));
                console.log(chalk_1.default.cyan('   Run: snow-flow auth login'));
                console.log(chalk_1.default.gray('   This will authenticate and create persistent tokens.'));
                console.log('');
                // Return credentials without access token - this will trigger auth flow
                return {
                    instance: envInstance.replace(/\/$/, ''),
                    clientId: envClientId,
                    clientSecret: envClientSecret,
                    // No accessToken - this signals that OAuth login is needed
                };
            }
            // 🔧 Check for old username/password setup in .env
            const envUsername = process.env.SNOW_USERNAME;
            const envPassword = process.env.SNOW_PASSWORD;
            if (envInstance && envUsername && envPassword) {
                console.log(chalk_1.default.yellow('⚠️  Found username/password in .env - OAuth is recommended'));
                console.log(chalk_1.default.blue('💡 For better security, set up OAuth credentials:'));
                console.log(chalk_1.default.gray('   1. In ServiceNow: System OAuth > Application Registry > New'));
                console.log(chalk_1.default.gray('   2. Update .env with SNOW_CLIENT_ID and SNOW_CLIENT_SECRET'));
                console.log(chalk_1.default.cyan('   3. Run: snow-flow auth login'));
                // Don't return username/password - force OAuth setup
                return null;
            }
            // No credentials found anywhere
            console.log(chalk_1.default.red('❌ No ServiceNow credentials found!'));
            console.log('');
            console.log(chalk_1.default.blue('🔧 Setup Instructions:'));
            console.log(chalk_1.default.gray('   1. Create .env file with OAuth credentials:'));
            console.log(chalk_1.default.cyan('      SNOW_INSTANCE=your-instance.service-now.com'));
            console.log(chalk_1.default.cyan('      SNOW_CLIENT_ID=your_oauth_client_id'));
            console.log(chalk_1.default.cyan('      SNOW_CLIENT_SECRET=your_oauth_client_secret'));
            console.log(chalk_1.default.gray('   2. Run:'), chalk_1.default.cyan('snow-flow auth login'));
            console.log('');
            console.log(chalk_1.default.blue('💡 To get OAuth credentials:'));
            console.log(chalk_1.default.gray('   • ServiceNow: System OAuth > Application Registry > New OAuth Application'));
            console.log(chalk_1.default.gray(`   • Redirect URI: http://${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectHost}:${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectPort}${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectPath}`));
            console.log(chalk_1.default.gray('   • Scopes: useraccount write admin'));
            console.log('');
            return null;
        }
        catch (error) {
            console.log(chalk_1.default.red('❌ Error loading credentials:'), error);
            return null;
        }
    }
    /**
     * Validate OAuth client secret format
     * OAuth secrets are typically long random strings (32+ chars) with mixed case and alphanumeric
     * Common passwords are shorter and may contain dictionary words
     */
    validateClientSecret(clientSecret) {
        // Check minimum length - OAuth secrets are typically 32+ characters
        if (clientSecret.length < 20) {
            return {
                valid: false,
                reason: 'OAuth Client Secret too short. Expected 32+ character random string from ServiceNow.'
            };
        }
        // Check for common password patterns
        const commonPasswordPatterns = [
            /^password/i,
            /^admin/i,
            /^test/i,
            /^demo/i,
            /^welcome/i,
            /123456/,
            /qwerty/i,
            /^[a-z]+\d{1,4}$/i, // Simple word + numbers like "Welkom123"
            /^[A-Z][a-z]+\d{1,4}$/ // Capitalized word + numbers
        ];
        for (const pattern of commonPasswordPatterns) {
            if (pattern.test(clientSecret)) {
                return {
                    valid: false,
                    reason: `OAuth Client Secret appears to be a password. ServiceNow OAuth secrets are long random strings (e.g., "a1b2c3d4e5f6..."). Check your Application Registry in ServiceNow.`
                };
            }
        }
        // Check for sufficient entropy (mix of upper, lower, numbers)
        const hasUpper = /[A-Z]/.test(clientSecret);
        const hasLower = /[a-z]/.test(clientSecret);
        const hasNumber = /[0-9]/.test(clientSecret);
        const charTypes = [hasUpper, hasLower, hasNumber].filter(Boolean).length;
        if (charTypes < 2) {
            return {
                valid: false,
                reason: 'OAuth Client Secret lacks complexity. ServiceNow generates secrets with mixed case and numbers.'
            };
        }
        return { valid: true };
    }
    /**
     * Get credentials (compatibility method for MCP servers)
     */
    async getCredentials() {
        return await this.loadCredentials();
    }
}
exports.ServiceNowOAuth = ServiceNowOAuth;
//# sourceMappingURL=snow-oauth.js.map