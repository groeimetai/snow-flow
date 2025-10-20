#!/usr/bin/env node
"use strict";
/**
 * ServiceNow OAuth Authentication Utility with Dynamic Port
 * Handles OAuth2 flow for ServiceNow integration
 */
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
            console.warn('🔒 Rate limit exceeded: Too many token requests. Please wait before retrying.');
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
     * Initialize OAuth flow - opens browser and handles callback
     */
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
    async authenticate(instance, clientId, clientSecret) {
        try {
            // 🔧 CRIT-002 FIX: Apply URL normalization
            const normalizedInstance = this.normalizeInstanceUrl(instance);
            // Validate client secret format
            const secretValidation = this.validateClientSecret(clientSecret);
            if (!secretValidation.valid) {
                console.error('❌ Invalid OAuth Client Secret:', secretValidation.reason);
                console.error('💡 To get a valid OAuth secret:');
                console.error('   1. Log into ServiceNow as admin');
                console.error('   2. Navigate to: System OAuth > Application Registry');
                console.error('   3. Create a new OAuth application');
                console.error('   4. Copy the generated Client Secret (long random string)');
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
                console.error(`❌ Port ${port} is already in use!`);
                console.error(`💡 Please close any application using port ${port} and try again.`);
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
            console.log('🚀 Starting ServiceNow OAuth flow...');
            console.log(`📋 Instance: ${normalizedInstance}`);
            console.log(`🔐 Client ID: ${clientId}`);
            console.log(`🔗 Redirect URI: ${redirectUri}`);
            // Generate state parameter for CSRF protection
            this.stateParameter = this.generateState();
            // Generate PKCE parameters
            this.generatePKCE();
            // Generate authorization URL
            const authUrl = this.generateAuthUrl(this.credentials.instance, clientId, redirectUri);
            console.log('\n🌐 Authorization URL generated:');
            console.log(`${authUrl}\n`);
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
                console.log('\n✅ Authentication successful!');
                console.log('🔐 Tokens saved securely');
            }
            return authResult;
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ Authentication failed:', errorMessage);
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
                        console.log('🔄 Exchanging authorization code for tokens...');
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
                    console.error('Callback server error:', error);
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
                console.log(`🌐 OAuth callback server started on http://${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectHost}:${port}`);
                console.log('🚀 Please open the authorization URL in your browser...');
                console.log('⏳ Waiting for OAuth callback...');
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
                            console.log('⚠️  Unknown OS:', process.platform);
                        }
                        // Prevent the spawn from keeping the process alive
                        if (browserProcess && browserProcess.unref) {
                            browserProcess.unref();
                        }
                    }
                    catch (err) {
                        // Silently fail - user can manually open URL
                        console.log('\n📋 Browser auto-open failed. Please manually copy and open the URL above.');
                    }
                }
                else {
                    console.log('\n🐳 Running in headless environment (Codespaces/Container/CI)');
                    console.log('📋 Please manually copy and open the authorization URL above in your browser.');
                    if (isCodespaces) {
                        console.log('\n💡 TIP for GitHub Codespaces:');
                        console.log('   1. Copy the authorization URL above');
                        console.log('   2. Open it in a new browser tab');
                        console.log('   3. After authorizing, you\'ll be redirected to localhost:3005');
                        console.log('   4. Copy the FULL redirect URL from your browser');
                        console.log('   5. Open a new Codespaces terminal and run:');
                        console.log('      curl "http://localhost:3005/callback?code=YOUR_CODE&state=YOUR_STATE"');
                        console.log('   6. Or use port forwarding in Codespaces to make port 3005 accessible');
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
            console.error('Token exchange error:', errorMessage);
            if (axios_1.default.isAxiosError(error) && error.response) {
                console.error('Response data:', error.response.data);
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
            console.error('Failed to save tokens:', error);
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
                console.log('🔄 Token expired, refreshing...');
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
                    console.error('❌ Token refresh failed:', refreshResult.error);
                    return null;
                }
            }
            return tokens.accessToken;
        }
        catch (error) {
            console.error('Failed to get access token:', error);
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
            console.log('✅ Logged out successfully');
        }
        catch (error) {
            console.log('No active session to logout from');
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
                        console.warn('⚠️  OAuth Configuration Issue:', secretValidation.reason);
                        console.warn('💡 Your stored client secret may be incorrect. Re-authenticate with: snow-flow auth login');
                    }
                }
                // Check if token is expired
                const expiresAt = new Date(tokens.expiresAt);
                const now = new Date();
                if (now < expiresAt) {
                    console.log('✅ Using saved OAuth tokens');
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
                    console.log('⏰ Saved OAuth token expired, will try refresh...');
                }
            }
            // 🔧 NEW: Fallback to .env file if no valid tokens
            console.log('🔍 No valid OAuth tokens found, checking .env file...');
            // Load environment variables with dotenv
            try {
                require('dotenv').config();
            }
            catch (err) {
                console.log('📝 dotenv not available, using process.env directly');
            }
            const envInstance = process.env.SNOW_INSTANCE;
            const envClientId = process.env.SNOW_CLIENT_ID;
            const envClientSecret = process.env.SNOW_CLIENT_SECRET;
            if (envInstance && envClientId && envClientSecret) {
                console.log('✅ Found ServiceNow credentials in .env file');
                console.log(`   - Instance: ${envInstance}`);
                console.log(`   - Client ID: ${envClientId}`);
                console.log(`   - Client Secret: ✅ Present`);
                // Validate client secret
                const secretValidation = this.validateClientSecret(envClientSecret);
                if (!secretValidation.valid) {
                    console.error('❌ Invalid OAuth Client Secret in .env file:', secretValidation.reason);
                    console.error('💡 Please update SNOW_CLIENT_SECRET in .env with proper OAuth secret from ServiceNow');
                    return null;
                }
                console.log('');
                console.log('🔐 OAuth Setup Required:');
                console.log('   Your .env has OAuth credentials but no active session.');
                console.log('   Run: snow-flow auth login');
                console.log('   This will authenticate and create persistent tokens.');
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
                console.warn('⚠️  Found username/password in .env - OAuth is recommended');
                console.warn('💡 For better security, set up OAuth credentials:');
                console.warn('   1. In ServiceNow: System OAuth > Application Registry > New');
                console.warn('   2. Update .env with SNOW_CLIENT_ID and SNOW_CLIENT_SECRET');
                console.warn('   3. Run: snow-flow auth login');
                // Don't return username/password - force OAuth setup
                return null;
            }
            // No credentials found anywhere
            console.error('❌ No ServiceNow credentials found!');
            console.error('');
            console.error('🔧 Setup Instructions:');
            console.error('   1. Create .env file with OAuth credentials:');
            console.error('      SNOW_INSTANCE=your-instance.service-now.com');
            console.error('      SNOW_CLIENT_ID=your_oauth_client_id');
            console.error('      SNOW_CLIENT_SECRET=your_oauth_client_secret');
            console.error('   2. Run: snow-flow auth login');
            console.error('');
            console.error('💡 To get OAuth credentials:');
            console.error('   • ServiceNow: System OAuth > Application Registry > New OAuth Application');
            console.error(`   • Redirect URI: http://${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectHost}:${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectPort}${snow_flow_config_js_1.snowFlowConfig.servicenow.oauth.redirectPath}`);
            console.error('   • Scopes: useraccount write admin');
            console.error('');
            return null;
        }
        catch (error) {
            console.error('❌ Error loading credentials:', error);
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