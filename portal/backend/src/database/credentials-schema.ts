/**
 * OAuth2 Credentials Database Schema
 *
 * Secure storage for customer OAuth2 tokens and service credentials.
 * All tokens are encrypted at rest using AES-256-GCM.
 */

import Database from 'better-sqlite3';
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
  service: 'jira' | 'azure' | 'confluence' | 'servicenow';
  credentialType: 'oauth2' | 'api_token' | 'basic';

  // OAuth2 fields (encrypted)
  accessToken?: string; // Encrypted
  refreshToken?: string; // Encrypted
  tokenType?: string; // e.g., "Bearer"
  expiresAt?: number; // Unix timestamp
  scope?: string;

  // API Token fields (encrypted)
  apiToken?: string; // Encrypted

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

export interface OAuthApp {
  id: number;
  service: 'jira' | 'azure' | 'confluence' | 'servicenow';
  clientId: string;
  clientSecret: string; // Encrypted
  redirectUri: string;
  scopes: string; // JSON array of scopes
  authorizationUrl: string;
  tokenUrl: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export class CredentialsDatabase {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    // Create oauth_credentials table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_credentials (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        service TEXT NOT NULL CHECK(service IN ('jira', 'azure', 'confluence', 'servicenow')),
        credential_type TEXT NOT NULL CHECK(credential_type IN ('oauth2', 'api_token', 'basic')),

        -- OAuth2 tokens (encrypted)
        access_token TEXT,
        refresh_token TEXT,
        token_type TEXT,
        expires_at INTEGER,
        scope TEXT,

        -- API Token (encrypted)
        api_token TEXT,

        -- Service config
        base_url TEXT NOT NULL,
        email TEXT,
        username TEXT,

        -- OAuth2 app config
        client_id TEXT,

        -- Metadata
        enabled INTEGER NOT NULL DEFAULT 1,
        last_used INTEGER,
        last_refreshed INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,

        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        UNIQUE(customer_id, service)
      );

      CREATE INDEX IF NOT EXISTS idx_oauth_creds_customer ON oauth_credentials(customer_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_creds_service ON oauth_credentials(service);
      CREATE INDEX IF NOT EXISTS idx_oauth_creds_expires ON oauth_credentials(expires_at);
    `);

    // Create oauth_apps table (service integrator config)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service TEXT NOT NULL UNIQUE CHECK(service IN ('jira', 'azure', 'confluence', 'servicenow')),
        client_id TEXT NOT NULL,
        client_secret TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        scopes TEXT NOT NULL,
        authorization_url TEXT NOT NULL,
        token_url TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_oauth_apps_service ON oauth_apps(service);
    `);
  }

  // ===== OAUTH CREDENTIALS METHODS =====

  /**
   * Store OAuth2 credential (encrypts sensitive fields)
   */
  createOAuthCredential(cred: Omit<OAuthCredential, 'id' | 'createdAt' | 'updatedAt'>): OAuthCredential {
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO oauth_credentials (
        customer_id, service, credential_type, access_token, refresh_token,
        token_type, expires_at, scope, api_token, base_url, email, username,
        client_id, enabled, last_used, last_refreshed, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
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
    );

    return {
      id: info.lastInsertRowid as number,
      ...cred,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Get OAuth credential (decrypts sensitive fields)
   */
  getOAuthCredential(customerId: number, service: string): OAuthCredential | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM oauth_credentials WHERE customer_id = ? AND service = ?
    `);

    const row = stmt.get(customerId, service) as any;
    if (!row) return undefined;

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
   * Update OAuth credential
   */
  updateOAuthCredential(customerId: number, service: string, updates: Partial<OAuthCredential>): void {
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.accessToken !== undefined) {
      fields.push('access_token = ?');
      values.push(encrypt(updates.accessToken));
    }
    if (updates.refreshToken !== undefined) {
      fields.push('refresh_token = ?');
      values.push(encrypt(updates.refreshToken));
    }
    if (updates.tokenType !== undefined) {
      fields.push('token_type = ?');
      values.push(updates.tokenType);
    }
    if (updates.expiresAt !== undefined) {
      fields.push('expires_at = ?');
      values.push(updates.expiresAt);
    }
    if (updates.scope !== undefined) {
      fields.push('scope = ?');
      values.push(updates.scope);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.lastUsed !== undefined) {
      fields.push('last_used = ?');
      values.push(updates.lastUsed);
    }
    if (updates.lastRefreshed !== undefined) {
      fields.push('last_refreshed = ?');
      values.push(updates.lastRefreshed);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(customerId);
    values.push(service);

    const stmt = this.db.prepare(`
      UPDATE oauth_credentials SET ${fields.join(', ')} WHERE customer_id = ? AND service = ?
    `);
    stmt.run(...values);
  }

  /**
   * Delete OAuth credential
   */
  deleteOAuthCredential(customerId: number, service: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM oauth_credentials WHERE customer_id = ? AND service = ?
    `);
    stmt.run(customerId, service);
  }

  /**
   * List customer credentials
   */
  listCustomerCredentials(customerId: number): OAuthCredential[] {
    const stmt = this.db.prepare(`
      SELECT * FROM oauth_credentials WHERE customer_id = ? ORDER BY service ASC
    `);

    const rows = stmt.all(customerId) as any[];

    return rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      service: row.service,
      credentialType: row.credential_type,
      // Don't decrypt tokens for list view (security)
      accessToken: row.access_token ? '[ENCRYPTED]' : undefined,
      refreshToken: row.refresh_token ? '[ENCRYPTED]' : undefined,
      tokenType: row.token_type,
      expiresAt: row.expires_at,
      scope: row.scope,
      apiToken: row.api_token ? '[ENCRYPTED]' : undefined,
      baseUrl: row.base_url,
      email: row.email,
      username: row.username,
      clientId: row.client_id,
      enabled: row.enabled === 1,
      lastUsed: row.last_used,
      lastRefreshed: row.last_refreshed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as OAuthCredential));
  }

  /**
   * Get credentials expiring soon (for refresh)
   */
  getExpiringCredentials(withinMs: number = 5 * 60 * 1000): OAuthCredential[] {
    const expiresAt = Date.now() + withinMs;

    const stmt = this.db.prepare(`
      SELECT * FROM oauth_credentials
      WHERE credential_type = 'oauth2'
        AND expires_at IS NOT NULL
        AND expires_at < ?
        AND refresh_token IS NOT NULL
        AND enabled = 1
      ORDER BY expires_at ASC
    `);

    const rows = stmt.all(expiresAt) as any[];

    return rows.map((row) => ({
      id: row.id,
      customerId: row.customer_id,
      service: row.service,
      credentialType: row.credential_type,
      accessToken: row.access_token ? decrypt(row.access_token) : undefined,
      refreshToken: row.refresh_token ? decrypt(row.refresh_token) : undefined,
      tokenType: row.token_type,
      expiresAt: row.expires_at,
      scope: row.scope,
      baseUrl: row.base_url,
      email: row.email,
      username: row.username,
      clientId: row.client_id,
      enabled: row.enabled === 1,
      lastUsed: row.last_used,
      lastRefreshed: row.last_refreshed,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    } as OAuthCredential));
  }

  // ===== OAUTH APPS METHODS (Service Integrator Config) =====

  /**
   * Create OAuth app configuration
   */
  createOAuthApp(app: Omit<OAuthApp, 'id' | 'createdAt' | 'updatedAt'>): OAuthApp {
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO oauth_apps (
        service, client_id, client_secret, redirect_uri, scopes,
        authorization_url, token_url, enabled, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      app.service,
      app.clientId,
      encrypt(app.clientSecret),
      app.redirectUri,
      app.scopes,
      app.authorizationUrl,
      app.tokenUrl,
      app.enabled ? 1 : 0,
      now,
      now
    );

    return {
      id: info.lastInsertRowid as number,
      ...app,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Get OAuth app configuration (decrypts client secret)
   */
  getOAuthApp(service: string): OAuthApp | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM oauth_apps WHERE service = ?
    `);

    const row = stmt.get(service) as any;
    if (!row) return undefined;

    return {
      id: row.id,
      service: row.service,
      clientId: row.client_id,
      clientSecret: decrypt(row.client_secret),
      redirectUri: row.redirect_uri,
      scopes: row.scopes,
      authorizationUrl: row.authorization_url,
      tokenUrl: row.token_url,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Update OAuth app
   */
  updateOAuthApp(service: string, updates: Partial<OAuthApp>): void {
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.clientId !== undefined) {
      fields.push('client_id = ?');
      values.push(updates.clientId);
    }
    if (updates.clientSecret !== undefined) {
      fields.push('client_secret = ?');
      values.push(encrypt(updates.clientSecret));
    }
    if (updates.redirectUri !== undefined) {
      fields.push('redirect_uri = ?');
      values.push(updates.redirectUri);
    }
    if (updates.scopes !== undefined) {
      fields.push('scopes = ?');
      values.push(updates.scopes);
    }
    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(service);

    const stmt = this.db.prepare(`
      UPDATE oauth_apps SET ${fields.join(', ')} WHERE service = ?
    `);
    stmt.run(...values);
  }
}

export { encrypt, decrypt };
