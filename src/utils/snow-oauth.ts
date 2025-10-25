#!/usr/bin/env node
/**
 * ServiceNow OAuth Authentication Utility with Code Paste Flow
 * Handles OAuth2 flow for ServiceNow integration (Claude-style)
 */

import { promises as fs, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { createServer } from 'http';
import { URL } from 'url';
import axios from 'axios';
import https from 'https';
import net from 'net';
import crypto from 'crypto';
import * as prompts from '@clack/prompts';
import { snowFlowConfig } from '../config/snow-flow-config.js';
import { unifiedAuthStore } from './unified-auth-store.js';
import { OAuthTemplates } from './oauth-html-templates.js';

export interface ServiceNowAuthResult {
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  error?: string;
}

export interface ServiceNowCredentials {
  instance: string;
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
}

interface OAuthCredentials {
  instance: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export class ServiceNowOAuth {
  private credentials?: OAuthCredentials;
  private tokenPath: string;
  private stateParameter?: string;
  private codeVerifier?: string;
  private codeChallenge?: string;
  
  // 🔒 SEC-002 FIX: Add rate limiting to prevent authentication bypass attacks
  private lastTokenRequest: number = 0;
  private tokenRequestCount: number = 0;
  private readonly TOKEN_REQUEST_WINDOW_MS = 60000; // 1 minute window
  private readonly MAX_TOKEN_REQUESTS_PER_WINDOW = 10; // Max 10 token requests per minute

  constructor() {
    // Store tokens in user's home directory
    const configDir = process.env.SNOW_FLOW_HOME || join(os.homedir(), '.snow-flow');
    this.tokenPath = join(configDir, 'auth.json');
  }

  /**
   * 🔒 SEC-002 FIX: Check rate limiting for token requests to prevent brute force attacks
   */
  private checkTokenRequestRateLimit(): boolean {
    const now = Date.now();
    
    // Reset counter if window has passed
    if (now - this.lastTokenRequest > this.TOKEN_REQUEST_WINDOW_MS) {
      this.tokenRequestCount = 0;
      this.lastTokenRequest = now;
    }
    
    // Check if within rate limit
    if (this.tokenRequestCount >= this.MAX_TOKEN_REQUESTS_PER_WINDOW) {
      prompts.log.warn('Rate limit exceeded: Too many token requests. Please wait before retrying.');
      return false;
    }
    
    this.tokenRequestCount++;
    return true;
  }

  /**
   * Generate a random state parameter for CSRF protection
   */
  private generateState(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Generate PKCE code verifier and challenge
   */
  private generatePKCE() {
    // Generate code verifier (43-128 characters)
    this.codeVerifier = crypto.randomBytes(32).toString('base64url');
    
    // Generate code challenge (SHA256 hash of verifier)
    const hash = crypto.createHash('sha256');
    hash.update(this.codeVerifier);
    this.codeChallenge = hash.digest('base64url');
  }

  /**
   * Check if a specific port is available
   */
  private async checkPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      
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
  private normalizeInstanceUrl(instance: string): string {
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
  async authenticateWithCodePaste(instance: string, clientId: string, clientSecret: string): Promise<ServiceNowAuthResult> {
    try {
      // Normalize instance URL
      const normalizedInstance = this.normalizeInstanceUrl(instance);

      // Validate client secret
      const secretValidation = this.validateClientSecret(clientSecret);
      if (!secretValidation.valid) {
        prompts.log.error(`Invalid OAuth Client Secret: ${secretValidation.reason}`);
        prompts.log.info('To get a valid OAuth secret:');
        prompts.log.message('   1. Log into ServiceNow as admin');
        prompts.log.message('   2. Navigate to: System OAuth > Application Registry');
        prompts.log.message('   3. Create a new OAuth application');
        prompts.log.message('   4. Copy the generated Client Secret (long random string)');
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

      prompts.log.step('Starting ServiceNow OAuth flow');
      prompts.log.info(`Instance: ${normalizedInstance}`);
      prompts.log.info(`Client ID: ${clientId}`);

      // Generate state parameter and PKCE
      this.stateParameter = this.generateState();
      this.generatePKCE();

      // Generate authorization URL
      const authUrl = this.generateAuthUrl(this.credentials.instance, clientId, redirectUri);

      prompts.log.message('');
      prompts.log.step('Authorization URL generated');
      prompts.log.message(`\n${authUrl}\n`);
      prompts.log.warn(`Go to: ${authUrl}`);
      prompts.log.message('');

      const authCode = await prompts.text({
        message: 'Paste the authorization code here',
        placeholder: 'Enter the code from the browser after authorizing',
        validate: (value) => {
          if (!value || value.trim() === '') return 'Authorization code is required';
          if (value.length < 10) return 'Code seems too short - please paste the full authorization code';
        }
      }) as string;

      if (prompts.isCancel(authCode)) {
        prompts.cancel('Authentication cancelled');
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
      const spinner = prompts.spinner();
      spinner.start('Exchanging authorization code for tokens');
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

        spinner.stop('Authentication successful');
        prompts.log.success('Tokens saved securely');
      } else {
        spinner.stop('Token exchange failed');
      }

      return tokenResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      prompts.log.error(`Authentication failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Original OAuth flow with local server (fallback)
   */
  async authenticate(instance: string, clientId: string, clientSecret: string): Promise<ServiceNowAuthResult> {
    try {
      // 🔧 CRIT-002 FIX: Apply URL normalization
      const normalizedInstance = this.normalizeInstanceUrl(instance);
      // Validate client secret format
      const secretValidation = this.validateClientSecret(clientSecret);
      if (!secretValidation.valid) {
        prompts.log.error(`Invalid OAuth Client Secret: ${secretValidation.reason}`);
        prompts.log.info('To get a valid OAuth secret:');
        prompts.log.message('   1. Log into ServiceNow as admin');
        prompts.log.message('   2. Navigate to: System OAuth > Application Registry');
        prompts.log.message('   3. Create a new OAuth application');
        prompts.log.message('   4. Copy the generated Client Secret (long random string)');
        return {
          success: false,
          error: secretValidation.reason
        };
      }

      // Get OAuth redirect configuration from environment or use defaults
      const oauthConfig = snowFlowConfig.servicenow.oauth;
      const port = oauthConfig.redirectPort;
      const host = oauthConfig.redirectHost;
      const path = oauthConfig.redirectPath;
      const redirectUri = `http://${host}:${port}${path}`;

      // Check if port is available
      const isPortAvailable = await this.checkPortAvailable(port);
      if (!isPortAvailable) {
        prompts.log.error(`Port ${port} is already in use!`);
        prompts.log.warn(`Please close any application using port ${port} and try again.`);
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

      prompts.log.step('Starting ServiceNow OAuth flow');
      prompts.log.info(`Instance: ${normalizedInstance}`);
      prompts.log.info(`Client ID: ${clientId}`);
      prompts.log.info(`Redirect URI: ${redirectUri}`);

      // Generate state parameter for CSRF protection
      this.stateParameter = this.generateState();

      // Generate PKCE parameters
      this.generatePKCE();

      // Generate authorization URL
      const authUrl = this.generateAuthUrl(this.credentials.instance, clientId, redirectUri);

      prompts.log.step('Authorization URL generated');
      prompts.log.message('');
      prompts.log.message(`\n${authUrl}\n`);
      prompts.log.message('');

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

        prompts.log.success('Authentication successful');
        prompts.log.success('Tokens saved securely');
      }

      return authResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      prompts.log.error(`Authentication failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Generate ServiceNow OAuth authorization URL
   */
  private generateAuthUrl(instance: string, clientId: string, redirectUri: string): string {
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
  private async startCallbackServer(redirectUri: string, port: number): Promise<ServiceNowAuthResult> {
    return new Promise((resolve) => {
      const server = createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, `http://${snowFlowConfig.servicenow.oauth.redirectHost}:${port}`);
          
          if (url.pathname === '/callback') {
            const code = url.searchParams.get('code');
            const error = url.searchParams.get('error');
            const state = url.searchParams.get('state');
            
            // Validate state parameter
            if (state !== this.stateParameter) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(OAuthTemplates.securityError);
              
              server.close();
              resolve({
                success: false,
                error: 'Invalid state parameter'
              });
              return;
            }
            
            if (error) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(OAuthTemplates.error(error));
              
              server.close();
              resolve({
                success: false,
                error: `OAuth error: ${error}`
              });
              return;
            }
            
            if (!code) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end(OAuthTemplates.missingCode);
              
              server.close();
              resolve({
                success: false,
                error: 'No authorization code received'
              });
              return;
            }
            
            // Exchange code for tokens
            const spinner = prompts.spinner();
            spinner.start('Exchanging authorization code for tokens');
            const tokenResult = await this.exchangeCodeForTokens(code);
            
            if (tokenResult.success) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(OAuthTemplates.success);
              
              server.close();
              resolve(tokenResult);
            } else {
              res.writeHead(500, { 'Content-Type': 'text/html' });
              res.end(OAuthTemplates.tokenExchangeFailed(tokenResult.error || 'Unknown error'));
              
              server.close();
              resolve(tokenResult);
            }
          } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
          }
        } catch (error) {
          prompts.log.error(`Callback server error: ${error}`);
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
        prompts.log.step(`OAuth callback server started on http://${snowFlowConfig.servicenow.oauth.redirectHost}:${port}`);
        prompts.log.warn('Please open the authorization URL in your browser');
        prompts.log.info('Waiting for OAuth callback...');
        
        // Auto-open browser if possible
        // Try to auto-open browser if not in headless environment
        const isCodespaces = process.env.CODESPACES === 'true';
        const isContainer = process.env.CONTAINER === 'true' || existsSync('/.dockerenv');
        const isHeadless = isCodespaces || isContainer || process.env.CI === 'true';
        
        if (!isHeadless) {
          try {
            const { spawn } = require('child_process');
            const authUrl = this.generateAuthUrl(
              this.credentials!.instance,
              this.credentials!.clientId,
              redirectUri
            );
            
            let browserProcess: any;
            
            // Try to open browser based on platform
            if (process.platform === 'darwin') {
              browserProcess = spawn('open', [authUrl], { detached: true, stdio: 'ignore' });
            } else if (process.platform === 'win32') {
              browserProcess = spawn('cmd', ['/c', 'start', authUrl], { detached: true, stdio: 'ignore' });
            } else if (process.platform === 'linux') {
              // Try multiple Linux browser openers
              const openers = ['xdg-open', 'gnome-open', 'kde-open', 'sensible-browser'];
              for (const opener of openers) {
                try {
                  browserProcess = spawn(opener, [authUrl], { detached: true, stdio: 'ignore' });
                  break; // If successful, stop trying
                } catch (e) {
                  // Try next opener
                  continue;
                }
              }
            } else {
              prompts.log.warn(`Unknown OS: ${process.platform}`);
            }
            
            // Prevent the spawn from keeping the process alive
            if (browserProcess && browserProcess.unref) {
              browserProcess.unref();
            }
          } catch (err) {
            // Silently fail - user can manually open URL
            prompts.log.warn('Browser auto-open failed. Please manually copy and open the URL above.');
          }
        } else {
          prompts.log.warn('Running in headless environment (Codespaces/Container/CI)');
          prompts.log.message('Please manually copy and open the authorization URL above in your browser.');

          if (isCodespaces) {
            prompts.log.info('TIP for GitHub Codespaces:');
            prompts.log.message('   1. Copy the authorization URL above');
            prompts.log.message('   2. Open it in a new browser tab');
            prompts.log.message('   3. After authorizing, you\'ll be redirected to localhost:3005');
            prompts.log.message('   4. Copy the FULL redirect URL from your browser');
            prompts.log.message('   5. Open a new Codespaces terminal and run:');
            prompts.log.message('      curl "http://localhost:3005/callback?code=YOUR_CODE&state=YOUR_STATE"');
            prompts.log.message('   6. Or use port forwarding in Codespaces to make port 3005 accessible');
          }
        }
      });
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<ServiceNowAuthResult> {
    try {
      // 🔒 SEC-002 FIX: Apply rate limiting to prevent authentication bypass attacks
      if (!this.checkTokenRequestRateLimit()) {
        return {
          success: false,
          error: 'Rate limit exceeded. Too many token requests. Please wait 1 minute before retrying.'
        };
      }
      
      const tokenUrl = `https://${this.credentials!.instance}/oauth_token.do`;
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.credentials!.clientId,
        client_secret: this.credentials!.clientSecret,
        redirect_uri: this.credentials!.redirectUri,
        code_verifier: this.codeVerifier || ''
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000,  // 🔒 SEC-002 FIX: 15 second timeout to prevent hanging requests
        // Allow self-signed certificates for dev instances
        httpsAgent: new https.Agent({
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
      } else {
        return {
          success: false,
          error: 'No access token received'
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      prompts.log.error(`Token exchange error: ${errorMessage}`);
      if (axios.isAxiosError(error) && error.response) {
        prompts.log.error(`Response data: ${JSON.stringify(error.response.data)}`);
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
  private async saveTokens(tokenData: any): Promise<void> {
    try {
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expiresIn);
      
      const authData = {
        ...tokenData,
        expiresAt: expiresAt.toISOString()
      };
      
      // Use unified auth store
      await unifiedAuthStore.saveTokens(authData);
      
      // Bridge to MCP servers immediately
      await unifiedAuthStore.bridgeToMCP();
    } catch (error) {
      prompts.log.error(`Failed to save tokens: ${error}`);
      throw error;
    }
  }

  /**
   * Load tokens from file
   */
  async loadTokens(): Promise<any> {
    try {
      return await unifiedAuthStore.getTokens();
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const tokens = await this.loadTokens();
      if (!tokens) return false;
      
      // Check if token is expired
      const expiresAt = new Date(tokens.expiresAt);
      const now = new Date();
      
      return now < expiresAt;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get access token (refresh if needed)
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const tokens = await this.loadTokens();
      if (!tokens) return null;
      
      // Check if token is expired
      const expiresAt = new Date(tokens.expiresAt);
      const now = new Date();
      
      if (now >= expiresAt && tokens.refreshToken) {
        // Token expired, try to refresh
        prompts.log.info('Token expired, refreshing...');
        const refreshResult = await this.refreshAccessToken(tokens);
        
        if (refreshResult.success && refreshResult.accessToken) {
          // Update saved tokens
          await this.saveTokens({
            ...tokens,
            accessToken: refreshResult.accessToken,
            expiresIn: refreshResult.expiresIn || 3600
          });
          
          return refreshResult.accessToken;
        } else {
          prompts.log.error(`Token refresh failed: ${refreshResult.error}`);
          return null;
        }
      }

      return tokens.accessToken;
    } catch (error) {
      prompts.log.error(`Failed to get access token: ${error}`);
      return null;
    }
  }

  /**
   * Refresh access token
   */
  public async refreshAccessToken(tokens?: any): Promise<ServiceNowAuthResult> {
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
      
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: tokens.clientId,
        client_secret: tokens.clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 15000,  // 🔒 SEC-002 FIX: 15 second timeout to prevent hanging requests
        // Allow self-signed certificates for dev instances
        httpsAgent: new https.Agent({
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
      } else {
        return {
          success: false,
          error: 'No access token received'
        };
      }
    } catch (error) {
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
  async logout(): Promise<void> {
    try {
      await fs.unlink(this.tokenPath);
      prompts.log.success('Logged out successfully');
    } catch (error) {
      prompts.log.info('No active session to logout from');
    }
  }

  /**
   * Get stored OAuth tokens for use in other contexts (MCP servers)
   */
  async getStoredTokens(): Promise<any> {
    return await this.loadTokens();
  }

  /**
   * Load credentials (including tokens) with .env fallback
   */
  async loadCredentials(): Promise<ServiceNowCredentials | null> {
    try {
      // First, try to load saved OAuth tokens
      const tokens = await this.loadTokens();
      
      if (tokens && tokens.accessToken) {
        // Validate client secret when loading
        if (tokens.clientSecret) {
          const secretValidation = this.validateClientSecret(tokens.clientSecret);
          if (!secretValidation.valid) {
            prompts.log.warn(`OAuth Configuration Issue: ${secretValidation.reason}`);
            prompts.log.info('Your stored client secret may be incorrect. Re-authenticate with: snow-flow auth login');
          }
        }

        // Check if token is expired
        const expiresAt = new Date(tokens.expiresAt);
        const now = new Date();

        if (now < expiresAt) {
          prompts.log.success('Using saved OAuth tokens');
          return {
            instance: tokens.instance,
            clientId: tokens.clientId,
            clientSecret: tokens.clientSecret,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAt: tokens.expiresAt
          };
        } else {
          prompts.log.warn('Saved OAuth token expired, will try refresh...');
        }
      }

      // 🔧 NEW: Fallback to .env file if no valid tokens
      prompts.log.info('No valid OAuth tokens found, checking .env file...');

      // Load environment variables with dotenv
      try {
        require('dotenv').config();
      } catch (err) {
        prompts.log.message('dotenv not available, using process.env directly');
      }
      
      const envInstance = process.env.SNOW_INSTANCE;
      const envClientId = process.env.SNOW_CLIENT_ID;
      const envClientSecret = process.env.SNOW_CLIENT_SECRET;

      if (envInstance && envClientId && envClientSecret) {
        prompts.log.success('Found ServiceNow credentials in .env file');
        prompts.log.message(`   - Instance: ${envInstance}`);
        prompts.log.message(`   - Client ID: ${envClientId}`);
        prompts.log.message('   - Client Secret: Present');

        // Validate client secret
        const secretValidation = this.validateClientSecret(envClientSecret);
        if (!secretValidation.valid) {
          prompts.log.error(`Invalid OAuth Client Secret in .env file: ${secretValidation.reason}`);
          prompts.log.warn('Please update SNOW_CLIENT_SECRET in .env with proper OAuth secret from ServiceNow');
          return null;
        }

        prompts.log.message('');
        prompts.log.info('OAuth Setup Required:');
        prompts.log.message('   Your .env has OAuth credentials but no active session.');
        prompts.log.message('   Run: snow-flow auth login');
        prompts.log.message('   This will authenticate and create persistent tokens.');
        prompts.log.message('');

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
        prompts.log.warn('Found username/password in .env - OAuth is recommended');
        prompts.log.info('For better security, set up OAuth credentials:');
        prompts.log.message('   1. In ServiceNow: System OAuth > Application Registry > New');
        prompts.log.message('   2. Update .env with SNOW_CLIENT_ID and SNOW_CLIENT_SECRET');
        prompts.log.message('   3. Run: snow-flow auth login');

        // Don't return username/password - force OAuth setup
        return null;
      }

      // No credentials found anywhere
      prompts.log.error('No ServiceNow credentials found!');
      prompts.log.message('');
      prompts.log.info('Setup Instructions:');
      prompts.log.message('   1. Create .env file with OAuth credentials:');
      prompts.log.message('      SNOW_INSTANCE=your-instance.service-now.com');
      prompts.log.message('      SNOW_CLIENT_ID=your_oauth_client_id');
      prompts.log.message('      SNOW_CLIENT_SECRET=your_oauth_client_secret');
      prompts.log.message('   2. Run: snow-flow auth login');
      prompts.log.message('');
      prompts.log.info('To get OAuth credentials:');
      prompts.log.message('   • ServiceNow: System OAuth > Application Registry > New OAuth Application');
      prompts.log.message(`   • Redirect URI: http://${snowFlowConfig.servicenow.oauth.redirectHost}:${snowFlowConfig.servicenow.oauth.redirectPort}${snowFlowConfig.servicenow.oauth.redirectPath}`);
      prompts.log.message('   • Scopes: useraccount write admin');
      prompts.log.message('');

      return null;

    } catch (error) {
      prompts.log.error(`Error loading credentials: ${error}`);
      return null;
    }
  }

  /**
   * Validate OAuth client secret format
   * OAuth secrets are typically long random strings (32+ chars) with mixed case and alphanumeric
   * Common passwords are shorter and may contain dictionary words
   */
  validateClientSecret(clientSecret: string): { valid: boolean; reason?: string } {
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
      /^[a-z]+\d{1,4}$/i,  // Simple word + numbers like "Welkom123"
      /^[A-Z][a-z]+\d{1,4}$/  // Capitalized word + numbers
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
  async getCredentials(): Promise<ServiceNowCredentials | null> {
    return await this.loadCredentials();
  }
}