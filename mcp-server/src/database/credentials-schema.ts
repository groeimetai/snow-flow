/**
 * OAuth2 Credentials Database Schema (MySQL)
 *
 * Secure storage for customer OAuth2 tokens and service credentials.
 * All tokens are encrypted at rest using AES-256-GCM.
 */

import mysql from 'mysql2/promise';
import { Connector } from '@google-cloud/cloud-sql-connector';
import crypto from 'crypto';

// Encryption key from environment (MUST be set in production!)
const ENCRYPTION_KEY = process.env.CREDENTIALS_ENCRYPTION_KEY || 'dev-key-change-in-production-32b';

// Ensure key is 32 bytes for AES-256
function getEncryptionKey(): Buffer {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').substring(0, 32));
  return key;
}

/**
 * Encrypt sensitive data
 */
function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(16);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted
  return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt sensitive data
 */
function decrypt(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const encrypted = parts[2];

  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

// ===== INTERFACES =====

export interface OAuthCredential {
  id: number;
  customerId: number;
  service: 'jira' | 'azure-devops' | 'confluence';
  credentialType: 'oauth2' | 'api_token' | 'basic';

  // OAuth2 fields (encrypted)
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
  scope?: string;

  // API Token fields (encrypted)
  apiToken?: string;

  // Service-specific config (encrypted)
  baseUrl: string;
  email?: string;
  username?: string;

  // OAuth2 app config (NOT encrypted - public info)
  clientId?: string;

  // Metadata
  enabled: boolean;
  lastUsed?: number;
  lastRefreshed?: number;
  createdAt: number;
  updatedAt: number;
}

export class CredentialsDatabase {
  private pool!: mysql.Pool;
  private connector?: Connector;
  private isInitialized = false;

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const useCloudSQL = process.env.USE_CLOUD_SQL === 'true';

    if (isProduction && useCloudSQL) {
      // Production: Cloud SQL with Public IP
      this.connector = new Connector();

      const clientOpts = await this.connector.getOptions({
        instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME!,
        ipType: 'PUBLIC' as any
      });

      this.pool = mysql.createPool({
        ...clientOpts,
        user: process.env.DB_USER || 'snow-flow',
        database: process.env.DB_NAME || 'licenses',
        password: process.env.DB_PASSWORD,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });
    } else {
      // Local development: Direct MySQL connection
      this.pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'snow-flow',
        password: process.env.DB_PASSWORD || 'dev-password-123',
        database: process.env.DB_NAME || 'licenses',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0
      });
    }

    // Test connection
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get credentials for customer and service
   */
  async getCredentials(customerId: number, service: string): Promise<OAuthCredential | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM oauth_credentials WHERE customer_id = ? AND service = ?',
      [customerId, service]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    const row = rowsArray[0];

    // Decrypt sensitive fields
    return {
      id: row.id,
      customerId: row.customer_id,
      service: row.service,
      credentialType: row.credential_type,
      accessToken: row.access_token ? decrypt(row.access_token) : undefined,
      refreshToken: row.refresh_token ? decrypt(row.refresh_token) : undefined,
      tokenType: row.token_type,
      expiresAt: row.expires_at,
      scope: row.scope,
      apiToken: row.api_token ? decrypt(row.api_token) : undefined,
      baseUrl: row.base_url,
      email: row.email,
      username: row.username,
      clientId: row.client_id,
      enabled: row.enabled === 1,
      lastUsed: row.last_used,
      lastRefreshed: row.last_refreshed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Store/update OAuth credential
   */
  async upsertCredential(cred: Omit<OAuthCredential, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const now = Date.now();

    await this.pool.execute(
      `INSERT INTO oauth_credentials (
        customer_id, service, credential_type, access_token, refresh_token,
        token_type, expires_at, scope, api_token, base_url, email, username,
        client_id, enabled, last_used, last_refreshed, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        access_token = VALUES(access_token),
        refresh_token = VALUES(refresh_token),
        token_type = VALUES(token_type),
        expires_at = VALUES(expires_at),
        scope = VALUES(scope),
        api_token = VALUES(api_token),
        base_url = VALUES(base_url),
        email = VALUES(email),
        username = VALUES(username),
        client_id = VALUES(client_id),
        enabled = VALUES(enabled),
        updated_at = VALUES(updated_at)`,
      [
        cred.customerId,
        cred.service,
        cred.credentialType,
        cred.accessToken ? encrypt(cred.accessToken) : null,
        cred.refreshToken ? encrypt(cred.refreshToken) : null,
        cred.tokenType || null,
        cred.expiresAt || null,
        cred.scope || null,
        cred.apiToken ? encrypt(cred.apiToken) : null,
        cred.baseUrl,
        cred.email || null,
        cred.username || null,
        cred.clientId || null,
        cred.enabled ? 1 : 0,
        cred.lastUsed || null,
        cred.lastRefreshed || null,
        now,
        now
      ]
    );
  }

  /**
   * Delete credential
   */
  async deleteCredential(customerId: number, service: string): Promise<void> {
    await this.pool.execute(
      'DELETE FROM oauth_credentials WHERE customer_id = ? AND service = ?',
      [customerId, service]
    );
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.pool.end();
    if (this.connector) {
      this.connector.close();
    }
  }
}

export { encrypt, decrypt };
