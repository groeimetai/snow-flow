/**
 * Self-Service Credentials API
 *
 * REST API endpoints for customers to manage their service integrations.
 * Supports OAuth2 flows for Jira, Azure DevOps, Confluence, and ServiceNow.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { LicenseDatabase } from '../database/schema.js';
import { CredentialsDatabase, OAuthCredential } from '../database/credentials-schema.js';
import { requireSsoAuth } from '../middleware/sso-auth.js';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

/**
 * OAuth2 Configuration for each service
 */
const OAUTH_CONFIGS = {
  jira: {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user', 'offline_access']
  },
  azure: {
    authorizationUrl: 'https://app.vssps.visualstudio.com/oauth2/authorize',
    tokenUrl: 'https://app.vssps.visualstudio.com/oauth2/token',
    scopes: ['vso.code', 'vso.work', 'vso.project']
  },
  confluence: {
    authorizationUrl: 'https://auth.atlassian.com/authorize',
    tokenUrl: 'https://auth.atlassian.com/oauth/token',
    scopes: ['read:confluence-content.all', 'write:confluence-content', 'offline_access']
  },
  servicenow: {
    // ServiceNow uses instance-specific URLs
    authorizationUrl: (baseUrl: string) => `${baseUrl}/oauth_auth.do`,
    tokenUrl: (baseUrl: string) => `${baseUrl}/oauth_token.do`,
    scopes: ['useraccount']
  }
};

/**
 * Create credentials router
 */
export function createCredentialsRoutes(db: LicenseDatabase, credsDb: CredentialsDatabase): Router {
  const router = Router();

  // Apply SSO authentication to all routes
  router.use(requireSsoAuth(db));

  /**
   * GET /api/credentials
   * List all configured service integrations for authenticated customer
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;

      const credentials = credsDb.listCustomerCredentials(customerId);

      logger.info({
        action: 'list_credentials',
        customerId,
        count: credentials.length
      });

      res.json({
        credentials: credentials.map(cred => ({
          service: cred.service,
          credentialType: cred.credentialType,
          baseUrl: cred.baseUrl,
          email: cred.email,
          username: cred.username,
          enabled: cred.enabled,
          expiresAt: cred.expiresAt,
          lastUsed: cred.lastUsed,
          createdAt: cred.createdAt,
          updatedAt: cred.updatedAt
        }))
      });
    } catch (error) {
      logger.error({
        action: 'list_credentials',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to list credentials' });
    }
  });

  /**
   * GET /api/credentials/:service
   * Get specific service configuration (without secrets)
   */
  router.get('/:service', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';

      const credential = credsDb.getOAuthCredential(customerId, service);

      if (!credential) {
        return res.status(404).json({ error: 'Service not configured' });
      }

      logger.info({
        action: 'get_credential',
        customerId,
        service
      });

      res.json({
        service: credential.service,
        credentialType: credential.credentialType,
        baseUrl: credential.baseUrl,
        email: credential.email,
        username: credential.username,
        enabled: credential.enabled,
        expiresAt: credential.expiresAt,
        lastUsed: credential.lastUsed,
        createdAt: credential.createdAt,
        updatedAt: credential.updatedAt
      });
    } catch (error) {
      logger.error({
        action: 'get_credential',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to get credential' });
    }
  });

  /**
   * POST /api/credentials/:service/oauth-init
   * Initiate OAuth2 authorization flow
   *
   * Request body:
   * - baseUrl: Service base URL (e.g., https://company.atlassian.net)
   * - email: User email (optional)
   */
  router.post('/:service/oauth-init', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';
      const { baseUrl, email } = req.body;

      if (!baseUrl) {
        return res.status(400).json({ error: 'baseUrl is required' });
      }

      // Get OAuth app configuration for this service
      const oauthApp = credsDb.getOAuthApp(service);
      if (!oauthApp || !oauthApp.enabled) {
        return res.status(400).json({
          error: 'OAuth2 not configured for this service. Please contact administrator.'
        });
      }

      // Build authorization URL
      const config = OAUTH_CONFIGS[service];
      const authUrl = typeof config.authorizationUrl === 'function'
        ? config.authorizationUrl(baseUrl)
        : config.authorizationUrl;

      const state = Buffer.from(JSON.stringify({
        customerId,
        service,
        baseUrl,
        email,
        timestamp: Date.now()
      })).toString('base64');

      const params = new URLSearchParams({
        client_id: oauthApp.clientId,
        redirect_uri: oauthApp.redirectUri,
        response_type: 'code',
        state,
        scope: config.scopes.join(' '),
        ...(service === 'jira' || service === 'confluence' ? {
          audience: 'api.atlassian.com',
          prompt: 'consent'
        } : {})
      });

      const authorizationUrl = `${authUrl}?${params.toString()}`;

      logger.info({
        action: 'oauth_init',
        customerId,
        service,
        baseUrl
      });

      res.json({
        authorizationUrl,
        instructions: `Visit this URL to authorize ${service} integration. You will be redirected back after authorization.`
      });
    } catch (error) {
      logger.error({
        action: 'oauth_init',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to initiate OAuth2 flow' });
    }
  });

  /**
   * GET /api/credentials/:service/oauth-callback
   * Handle OAuth2 callback and exchange code for tokens
   *
   * Query parameters:
   * - code: Authorization code from provider
   * - state: State parameter with customer info
   */
  router.get('/:service/oauth-callback', async (req: Request, res: Response) => {
    try {
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        logger.error({
          action: 'oauth_callback',
          service,
          error: oauthError
        });
        return res.status(400).json({ error: `OAuth error: ${oauthError}` });
      }

      if (!code || !state) {
        return res.status(400).json({ error: 'Missing code or state parameter' });
      }

      // Decode state
      const stateData = JSON.parse(Buffer.from(state as string, 'base64').toString());
      const { customerId, baseUrl, email } = stateData;

      // Get OAuth app configuration
      const oauthApp = credsDb.getOAuthApp(service);
      if (!oauthApp) {
        return res.status(400).json({ error: 'OAuth2 not configured' });
      }

      // Exchange code for tokens
      const config = OAUTH_CONFIGS[service];
      const tokenUrl = typeof config.tokenUrl === 'function'
        ? config.tokenUrl(baseUrl)
        : config.tokenUrl;

      const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: oauthApp.redirectUri,
        client_id: oauthApp.clientId,
        client_secret: oauthApp.clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in, token_type, scope } = tokenResponse.data;

      // Calculate expiration
      const expiresAt = Date.now() + (expires_in * 1000);

      // Check if credential exists
      const existing = credsDb.getOAuthCredential(customerId, service);

      if (existing) {
        // Update existing credential
        credsDb.updateOAuthCredential(customerId, service, {
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenType: token_type,
          expiresAt,
          scope: scope || config.scopes.join(' '),
          lastRefreshed: Date.now()
        });
      } else {
        // Create new credential
        credsDb.createOAuthCredential({
          customerId,
          service,
          credentialType: 'oauth2',
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenType: token_type,
          expiresAt,
          scope: scope || config.scopes.join(' '),
          baseUrl,
          email,
          enabled: true
        });
      }

      logger.info({
        action: 'oauth_callback',
        customerId,
        service,
        success: true
      });

      res.json({
        success: true,
        service,
        message: `${service} integration configured successfully`,
        expiresAt
      });
    } catch (error) {
      logger.error({
        action: 'oauth_callback',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ error: 'Failed to complete OAuth2 flow' });
    }
  });

  /**
   * POST /api/credentials/:service
   * Store API token or basic auth credentials
   *
   * Request body:
   * - credentialType: 'api_token' | 'basic'
   * - baseUrl: Service base URL
   * - apiToken: API token (if credentialType = api_token)
   * - username: Username (if credentialType = basic)
   * - password: Password (if credentialType = basic)
   * - email: User email (optional)
   */
  router.post('/:service', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';
      const { credentialType, baseUrl, apiToken, username, password, email } = req.body;

      if (!credentialType || !baseUrl) {
        return res.status(400).json({ error: 'credentialType and baseUrl are required' });
      }

      if (credentialType === 'api_token' && !apiToken) {
        return res.status(400).json({ error: 'apiToken is required for api_token type' });
      }

      if (credentialType === 'basic' && (!username || !password)) {
        return res.status(400).json({ error: 'username and password are required for basic type' });
      }

      // Check if credential exists
      const existing = credsDb.getOAuthCredential(customerId, service);

      if (existing) {
        // Update existing credential
        const updates: Partial<OAuthCredential> = {
          baseUrl,
          email
        };

        if (credentialType === 'api_token') {
          updates.apiToken = apiToken;
        }

        credsDb.updateOAuthCredential(customerId, service, updates);
      } else {
        // Create new credential
        credsDb.createOAuthCredential({
          customerId,
          service,
          credentialType,
          baseUrl,
          email,
          apiToken: credentialType === 'api_token' ? apiToken : undefined,
          username: credentialType === 'basic' ? username : undefined,
          enabled: true
        });
      }

      logger.info({
        action: 'store_credential',
        customerId,
        service,
        credentialType
      });

      res.json({
        success: true,
        service,
        message: `${service} credentials stored successfully`
      });
    } catch (error) {
      logger.error({
        action: 'store_credential',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to store credentials' });
    }
  });

  /**
   * PUT /api/credentials/:service
   * Update existing credentials
   *
   * Request body:
   * - enabled: boolean (optional)
   * - apiToken: string (optional)
   * - baseUrl: string (optional)
   * - email: string (optional)
   */
  router.put('/:service', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';
      const updates = req.body;

      const existing = credsDb.getOAuthCredential(customerId, service);
      if (!existing) {
        return res.status(404).json({ error: 'Service not configured' });
      }

      credsDb.updateOAuthCredential(customerId, service, updates);

      logger.info({
        action: 'update_credential',
        customerId,
        service,
        updates: Object.keys(updates)
      });

      res.json({
        success: true,
        service,
        message: `${service} credentials updated successfully`
      });
    } catch (error) {
      logger.error({
        action: 'update_credential',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to update credentials' });
    }
  });

  /**
   * DELETE /api/credentials/:service
   * Delete service credentials
   */
  router.delete('/:service', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';

      const existing = credsDb.getOAuthCredential(customerId, service);
      if (!existing) {
        return res.status(404).json({ error: 'Service not configured' });
      }

      credsDb.deleteOAuthCredential(customerId, service);

      logger.info({
        action: 'delete_credential',
        customerId,
        service
      });

      res.json({
        success: true,
        service,
        message: `${service} credentials deleted successfully`
      });
    } catch (error) {
      logger.error({
        action: 'delete_credential',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to delete credentials' });
    }
  });

  /**
   * POST /api/credentials/:service/test
   * Test service connection with stored credentials
   */
  router.post('/:service/test', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';

      const credential = credsDb.getOAuthCredential(customerId, service);
      if (!credential) {
        return res.status(404).json({ error: 'Service not configured' });
      }

      let testResult = false;
      let message = '';

      // Test connection based on service
      switch (service) {
        case 'jira':
        case 'confluence':
          try {
            const response = await axios.get(`${credential.baseUrl}/rest/api/3/myself`, {
              headers: {
                'Authorization': credential.credentialType === 'oauth2'
                  ? `Bearer ${credential.accessToken}`
                  : `Basic ${Buffer.from(`${credential.email}:${credential.apiToken}`).toString('base64')}`,
                'Accept': 'application/json'
              }
            });
            testResult = response.status === 200;
            message = testResult ? `Connected as ${response.data.displayName}` : 'Connection failed';
          } catch (error) {
            message = 'Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error');
          }
          break;

        case 'azure':
          try {
            const response = await axios.get(`${credential.baseUrl}/_apis/connectionData`, {
              headers: {
                'Authorization': credential.credentialType === 'oauth2'
                  ? `Bearer ${credential.accessToken}`
                  : `Basic ${Buffer.from(`:${credential.apiToken}`).toString('base64')}`,
                'Accept': 'application/json'
              }
            });
            testResult = response.status === 200;
            message = testResult ? `Connected as ${response.data.authenticatedUser.providerDisplayName}` : 'Connection failed';
          } catch (error) {
            message = 'Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error');
          }
          break;

        case 'servicenow':
          try {
            const response = await axios.get(`${credential.baseUrl}/api/now/table/sys_user`, {
              params: { sysparm_limit: 1 },
              headers: {
                'Authorization': credential.credentialType === 'oauth2'
                  ? `Bearer ${credential.accessToken}`
                  : `Basic ${Buffer.from(`${credential.username}:${credential.apiToken}`).toString('base64')}`,
                'Accept': 'application/json'
              }
            });
            testResult = response.status === 200;
            message = testResult ? 'ServiceNow connection successful' : 'Connection failed';
          } catch (error) {
            message = 'Connection failed: ' + (error instanceof Error ? error.message : 'Unknown error');
          }
          break;
      }

      logger.info({
        action: 'test_credential',
        customerId,
        service,
        success: testResult
      });

      res.json({
        success: testResult,
        service,
        message
      });
    } catch (error) {
      logger.error({
        action: 'test_credential',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to test credentials' });
    }
  });

  /**
   * POST /api/credentials/:service/refresh
   * Manually trigger OAuth2 token refresh
   */
  router.post('/:service/refresh', async (req: Request, res: Response) => {
    try {
      const customerId = req.customer.id;
      const service = req.params.service as 'jira' | 'azure' | 'confluence' | 'servicenow';

      const credential = credsDb.getOAuthCredential(customerId, service);
      if (!credential) {
        return res.status(404).json({ error: 'Service not configured' });
      }

      if (credential.credentialType !== 'oauth2') {
        return res.status(400).json({ error: 'Only OAuth2 credentials can be refreshed' });
      }

      if (!credential.refreshToken) {
        return res.status(400).json({ error: 'No refresh token available' });
      }

      // Get OAuth app configuration
      const oauthApp = credsDb.getOAuthApp(service);
      if (!oauthApp) {
        return res.status(400).json({ error: 'OAuth2 not configured' });
      }

      // Refresh token
      const config = OAUTH_CONFIGS[service];
      const tokenUrl = typeof config.tokenUrl === 'function'
        ? config.tokenUrl(credential.baseUrl)
        : config.tokenUrl;

      const tokenResponse = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credential.refreshToken,
        client_id: oauthApp.clientId,
        client_secret: oauthApp.clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const { access_token, refresh_token, expires_in, token_type } = tokenResponse.data;
      const expiresAt = Date.now() + (expires_in * 1000);

      // Update credential
      credsDb.updateOAuthCredential(customerId, service, {
        accessToken: access_token,
        refreshToken: refresh_token || credential.refreshToken,
        tokenType: token_type,
        expiresAt,
        lastRefreshed: Date.now()
      });

      logger.info({
        action: 'refresh_token',
        customerId,
        service,
        success: true
      });

      res.json({
        success: true,
        service,
        message: 'Token refreshed successfully',
        expiresAt
      });
    } catch (error) {
      logger.error({
        action: 'refresh_token',
        error: error instanceof Error ? error.message : String(error)
      });
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  });

  return router;
}
