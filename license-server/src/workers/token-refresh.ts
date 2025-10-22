/**
 * OAuth2 Token Refresh Worker
 *
 * Background job that automatically refreshes expiring OAuth2 tokens.
 * Runs every 5 minutes and refreshes tokens expiring within 1 hour.
 */

import axios from 'axios';
import winston from 'winston';
import { CredentialsDatabase, OAuthCredential } from '../database/credentials-schema.js';

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
    }),
    new winston.transports.File({ filename: 'token-refresh.log' })
  ]
});

/**
 * OAuth2 token endpoints for each service
 */
const TOKEN_URLS = {
  jira: 'https://auth.atlassian.com/oauth/token',
  azure: 'https://app.vssps.visualstudio.com/oauth2/token',
  confluence: 'https://auth.atlassian.com/oauth/token',
  servicenow: (baseUrl: string) => `${baseUrl}/oauth_token.do`
};

export class TokenRefreshWorker {
  private credsDb: CredentialsDatabase;
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(credsDb: CredentialsDatabase) {
    this.credsDb = credsDb;
  }

  /**
   * Start the token refresh worker
   * Runs every 5 minutes by default
   */
  start(intervalMs: number = 5 * 60 * 1000): void {
    if (this.isRunning) {
      logger.warn('Token refresh worker already running');
      return;
    }

    logger.info('Starting OAuth2 token refresh worker', {
      intervalMs,
      intervalMinutes: intervalMs / 60000
    });

    // Run immediately on start
    this.refreshExpiringTokens().catch(error => {
      logger.error('Initial token refresh failed', {
        error: error instanceof Error ? error.message : String(error)
      });
    });

    // Then run on interval
    this.interval = setInterval(() => {
      this.refreshExpiringTokens().catch(error => {
        logger.error('Token refresh failed', {
          error: error instanceof Error ? error.message : String(error)
        });
      });
    }, intervalMs);

    this.isRunning = true;
  }

  /**
   * Stop the token refresh worker
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    logger.info('Token refresh worker stopped');
  }

  /**
   * Refresh all tokens expiring within 1 hour
   */
  private async refreshExpiringTokens(): Promise<void> {
    try {
      // Get credentials expiring within 1 hour
      const expiringCreds = this.credsDb.getExpiringCredentials(60 * 60 * 1000);

      if (expiringCreds.length === 0) {
        logger.debug('No tokens need refreshing');
        return;
      }

      logger.info(`Found ${expiringCreds.length} tokens to refresh`);

      const results = await Promise.allSettled(
        expiringCreds.map(cred => this.refreshToken(cred))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      logger.info('Token refresh batch completed', {
        total: expiringCreds.length,
        succeeded,
        failed
      });
    } catch (error) {
      logger.error('Failed to refresh expiring tokens', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  /**
   * Refresh a single OAuth2 token
   */
  private async refreshToken(credential: OAuthCredential): Promise<void> {
    try {
      if (!credential.refreshToken) {
        throw new Error('No refresh token available');
      }

      // Get OAuth app configuration
      const oauthApp = this.credsDb.getOAuthApp(credential.service);
      if (!oauthApp || !oauthApp.enabled) {
        throw new Error(`OAuth2 not configured for ${credential.service}`);
      }

      // Determine token URL
      const tokenUrl = credential.service === 'servicenow'
        ? (TOKEN_URLS.servicenow as (baseUrl: string) => string)(credential.baseUrl)
        : TOKEN_URLS[credential.service as 'jira' | 'azure' | 'confluence'];

      // Refresh the token
      const response = await axios.post(tokenUrl, new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: credential.refreshToken,
        client_id: oauthApp.clientId,
        client_secret: oauthApp.clientSecret
      }), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000 // 30 second timeout
      });

      const { access_token, refresh_token, expires_in, token_type } = response.data;

      // Calculate new expiration
      const expiresAt = Date.now() + (expires_in * 1000);

      // Update credential in database
      this.credsDb.updateOAuthCredential(credential.customerId, credential.service, {
        accessToken: access_token,
        refreshToken: refresh_token || credential.refreshToken, // Some providers don't return new refresh token
        tokenType: token_type,
        expiresAt,
        lastRefreshed: Date.now()
      });

      logger.info('Token refreshed successfully', {
        customerId: credential.customerId,
        service: credential.service,
        expiresAt: new Date(expiresAt).toISOString()
      });
    } catch (error) {
      logger.error('Failed to refresh token', {
        customerId: credential.customerId,
        service: credential.service,
        error: error instanceof Error ? error.message : String(error)
      });

      // If refresh fails with 401/403, disable the credential
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status === 401 || status === 403) {
          this.credsDb.updateOAuthCredential(credential.customerId, credential.service, {
            enabled: false
          });

          logger.warn('Credential disabled due to refresh failure', {
            customerId: credential.customerId,
            service: credential.service,
            status
          });
        }
      }

      throw error;
    }
  }

  /**
   * Manually refresh a specific credential
   */
  async refreshCredential(customerId: number, service: string): Promise<void> {
    const credential = this.credsDb.getOAuthCredential(customerId, service);
    if (!credential) {
      throw new Error('Credential not found');
    }

    await this.refreshToken(credential);
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      running: this.isRunning,
      interval: this.interval !== null
    };
  }
}
