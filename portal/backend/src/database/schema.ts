/**
 * Database Schema for License Server
 *
 * Uses mysql2 with connection pooling for Cloud SQL (MySQL 8.4)
 * Supports both local Docker MySQL and Cloud SQL production
 */

import mysql from 'mysql2/promise';
import { Connector } from '@google-cloud/cloud-sql-connector';
import crypto from 'crypto';
import { KMSEncryptionService } from '../services/kms-encryption.js';
import { parseLicenseKey, ParsedLicense } from '../license/parser.js';

// TypeScript Interfaces (unchanged from SQLite version)
export interface ServiceIntegrator {
  id: number;
  companyName: string;
  contactEmail: string;
  billingEmail: string;
  masterLicenseKey: string; // SNOW-SI-XXXX
  whiteLabelEnabled: boolean;
  customDomain?: string;
  logoUrl?: string;
  createdAt: number;
  status: 'active' | 'suspended' | 'churned';
}

export interface Customer {
  id: number;
  serviceIntegratorId: number;
  name: string;
  contactEmail: string;
  company?: string;
  licenseKey: string; // SNOW-ENT-CUST-XXXX or new format: SNOW-ENT-ORG-5/1-EXPIRY-CHECKSUM
  theme?: string; // Theme name (e.g., 'capgemini', 'ey', 'servicenow')
  customThemeId?: number; // FK to service_integrator_themes
  // NEW (v2.0.0): Seat tracking for seat-based licensing
  developerSeats: number; // Total developer seats (-1 = unlimited, for legacy licenses)
  stakeholderSeats: number; // Total stakeholder seats (-1 = unlimited)
  activeDeveloperSeats: number; // Currently active developer connections
  activeStakeholderSeats: number; // Currently active stakeholder connections
  seatLimitsEnforced: boolean; // Feature flag: enable/disable seat enforcement per customer
  createdAt: number;
  updatedAt: number;
  status: 'active' | 'suspended' | 'churned';
  totalApiCalls: number;
  lastApiCall?: number;
}

export interface License {
  id: number;
  key: string;
  tier: 'Team' | 'Professional' | 'Enterprise';
  status: 'active' | 'expired' | 'suspended' | 'invalid';
  companyName: string;
  contactEmail: string;
  customerId?: number; // Link to customer
  maxInstances: number;
  features: string; // JSON array of feature names
  expiresAt: number; // Unix timestamp
  createdAt: number;
  updatedAt: number;
  totalApiCalls: number;
  lastApiCall?: number;
}

export interface CustomerInstance {
  id: number;
  customerId: number;
  instanceId: string; // Hardware fingerprint
  instanceName?: string; // "Production", "Test", "Dev"
  hostname?: string;
  ipAddress?: string;
  lastSeen: number;
  version: string;
  validationCount: number;
  createdAt: number;
}

export interface LicenseInstance {
  id: number;
  licenseId: number;
  instanceId: string;
  version: string;
  lastSeen: number; // Unix timestamp
  ipAddress?: string;
  hostname?: string;
  validationCount: number;
  createdAt: number;
}

export interface McpUsage {
  id: number;
  customerId: number;
  instanceId: number;
  toolName: string;
  toolCategory: 'jira' | 'azdo' | 'confluence' | 'ml' | 'sso';
  timestamp: number;
  durationMs: number;
  success: boolean;
  errorMessage?: string;
  requestParams?: string; // JSON (sanitized)
  ipAddress?: string;
}

export interface ApiLog {
  id: number;
  endpoint: string;
  method: string;
  statusCode: number;
  durationMs: number;
  timestamp: number;
  ipAddress?: string;
  userAgent?: string;
  licenseKey?: string;
  errorMessage?: string;
}

export interface ValidationLog {
  id: number;
  licenseId: number;
  instanceId: string;
  version: string;
  success: boolean;
  errorCode?: string;
  ipAddress?: string;
  timestamp: number;
}

export interface SsoConfig {
  id: number;
  customerId: number;
  enabled: boolean;
  provider: 'saml' | 'oauth' | 'openid';
  entryPoint: string; // IdP SSO URL
  issuer: string; // SP Entity ID
  cert: string; // IdP Certificate
  callbackUrl: string; // ACS URL
  logoutUrl?: string; // SLO URL
  nameIdFormat?: string;
  wantAssertionsSigned: boolean;
  wantAuthnResponseSigned: boolean;
  signatureAlgorithm?: string;
  attributeMapping?: string; // JSON mapping
  createdAt: number;
  updatedAt: number;
}

export interface SsoSession {
  id: number;
  customerId: number;
  userId: string; // From IdP
  email: string;
  displayName?: string;
  sessionToken: string; // JWT token
  nameId?: string; // SAML NameID
  sessionIndex?: string; // SAML SessionIndex
  attributes?: string; // JSON of SAML attributes
  ipAddress?: string;
  userAgent?: string;
  createdAt: number;
  expiresAt: number;
  lastActivity: number;
}

export interface CustomerCredential {
  id: number;
  customerId: number;
  serviceType: 'jira' | 'azure-devops' | 'confluence' | 'servicenow' | 'github' | 'gitlab';
  credentialType: 'oauth2' | 'api_token' | 'basic_auth' | 'pat';

  // OAuth2 fields (encrypted)
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
  scope?: string;

  // API Token / PAT (encrypted)
  apiToken?: string;

  // Basic Auth (encrypted)
  username?: string;
  password?: string;

  // Service configuration
  baseUrl: string;
  email?: string;
  clientId?: string;
  configJson?: string;

  // Status
  enabled: boolean;
  lastUsed?: number;
  lastRefreshed?: number;
  lastTestStatus?: 'success' | 'failed' | 'not_tested';
  lastTestMessage?: string;
  lastTestedAt?: number;

  // Timestamps
  createdAt: number;
  updatedAt: number;
}

export interface ServiceIntegratorTheme {
  id: number;
  serviceIntegratorId: number;
  themeName: string;
  displayName: string;
  description?: string;
  themeConfig: any; // JSON object containing SnowCode theme configuration
  primaryColor: string; // Hex color (e.g., '#0070AD')
  secondaryColor?: string;
  accentColor?: string;
  isActive: boolean;
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ThemeUsageLog {
  id: number;
  customerId: number;
  themeId: number;
  action: 'assigned' | 'activated' | 'deactivated' | 'removed';
  timestamp: number;
}

/**
 * Active MCP connection (v2.0.0)
 * Tracks real-time SSE connections for seat management
 */
export interface ActiveConnection {
  id: number;
  customerId: number;
  userId: string; // Hashed machine ID (SHA-256)
  role: 'developer' | 'stakeholder' | 'admin';
  connectionId: string; // Unique SSE connection ID (UUID)
  ipAddress?: string;
  userAgent?: string;
  connectedAt: number; // Timestamp in ms
  lastSeen: number; // Timestamp in ms (updated by heartbeat)
  jwtTokenHash?: string; // SHA-256 hash of JWT for correlation
}

/**
 * Connection lifecycle event (v2.0.0)
 * Audit trail for seat management and troubleshooting
 */
export interface ConnectionEvent {
  id: number;
  customerId: number;
  userId: string;
  role: 'developer' | 'stakeholder' | 'admin';
  eventType: 'connect' | 'disconnect' | 'heartbeat' | 'timeout' | 'rejected';
  timestamp: number; // Timestamp in ms
  ipAddress?: string;
  errorMessage?: string; // For rejected connections
  seatLimit?: number; // Seat limit at time of event
  activeCount?: number; // Active connections at time of event
}

/**
 * User (v2.0.0)
 * User credentials and management for enterprise licenses
 * Links users to customers or service integrators for portal access
 */
export interface User {
  id: number;
  customerId?: number; // NULL for SI admin users
  serviceIntegratorId?: number; // NULL for customer users
  userId: string; // Hashed machine ID (SHA-256) from MCP authentication
  machineIdRaw?: string; // Optional: Unhashed machine ID for display
  username?: string; // Optional display name
  email?: string; // Optional email address
  role: 'developer' | 'stakeholder' | 'admin';
  passwordHash?: string; // Optional: For future password authentication
  status: 'active' | 'inactive' | 'suspended';
  isActive: boolean; // Quick active check (TRUE = active, FALSE = inactive/suspended)
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
  lastLoginAt?: number; // Unix timestamp (ms) of last authentication
  lastSeenIp?: string; // Last IP address
  lastSeenUserAgent?: string; // Last user agent string
}

/**
 * User Activity Log (v2.0.0)
 * Audit trail for user activity and changes
 */
export interface UserActivityLog {
  id: number;
  userId: number; // References users.id
  activityType: 'login' | 'logout' | 'status_change' | 'role_change' | 'created' | 'updated';
  activityTimestamp: number; // Unix timestamp (ms)
  ipAddress?: string;
  userAgent?: string;
  oldValue?: string; // Previous value for changes
  newValue?: string; // New value for changes
  performedBy?: string; // Who performed the action (admin, system, self)
  notes?: string; // Additional context
}

/**
 * Helper to convert snake_case database rows to camelCase TypeScript objects
 */
function toCamelCase(row: any): any {
  if (!row) return row;

  const camelRow: any = {};
  for (const key in row) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    camelRow[camelKey] = row[key];
  }
  return camelRow;
}

/**
 * Helper to convert boolean fields (MySQL returns 0/1)
 */
function convertBooleans(row: any, boolFields: string[]): any {
  if (!row) return row;

  for (const field of boolFields) {
    if (row[field] !== undefined) {
      row[field] = Boolean(row[field]);
    }
  }
  return row;
}

export class LicenseDatabase {
  public pool!: mysql.Pool; // Public for migration runner access
  private connector?: Connector;
  private isInitialized = false;
  private kmsService?: KMSEncryptionService; // KMS envelope encryption service

  /**
   * Initialize database connection pool
   * Call this before using any methods
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const useCloudSQL = process.env.USE_CLOUD_SQL === 'true';

    // Debug logging
    console.log('[DB] Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      USE_CLOUD_SQL: process.env.USE_CLOUD_SQL,
      isProduction,
      useCloudSQL,
      willUseCloudSQL: isProduction && useCloudSQL
    });

    if (isProduction && useCloudSQL) {
      // Production: Cloud SQL with Public IP (no VPC connector needed)
      this.connector = new Connector();

      const clientOpts = await this.connector.getOptions({
        instanceConnectionName: process.env.INSTANCE_CONNECTION_NAME!, // e.g., 'snow-flow-ai:europe-west4:snow-flow-production-db'
        ipType: 'PUBLIC' as any // Use Public IP (no VPC connector required)
      });

      this.pool = mysql.createPool({
        ...clientOpts,
        user: process.env.DB_USER || 'snow-flow',
        database: process.env.DB_NAME || 'licenses',
        password: process.env.DB_PASSWORD, // From Secret Manager
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
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Initialize KMS encryption service (if KMS is configured)
    try {
      if (process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT) {
        this.kmsService = new KMSEncryptionService();
        console.log('✅ KMS encryption enabled for credentials');

        // Test KMS connectivity
        const kmsTest = await this.kmsService.testConnection();
        if (!kmsTest) {
          console.warn('⚠️  KMS test failed - falling back to local encryption');
          this.kmsService = undefined;
        }
      } else {
        console.log('ℹ️  KMS not configured - using local AES-256-GCM encryption');
      }
    } catch (error) {
      console.warn('⚠️  KMS initialization failed - falling back to local encryption:', error);
      this.kmsService = undefined;
    }

    this.isInitialized = true;
  }

  /**
   * Get license by key
   */
  async getLicense(key: string): Promise<License | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM licenses WHERE `key` = ?',
      [key]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    return toCamelCase(rowsArray[0]) as License;
  }

  /**
   * Create new license
   */
  async createLicense(license: Omit<License, 'id' | 'createdAt' | 'updatedAt'>): Promise<License> {
    const now = Date.now();

    const [result] = await this.pool.execute(
      `INSERT INTO licenses (
        \`key\`, tier, status, company_name, contact_email,
        max_instances, features, expires_at, created_at, updated_at,
        total_api_calls, last_api_call
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        license.key,
        license.tier,
        license.status,
        license.companyName,
        license.contactEmail,
        license.maxInstances,
        license.features,
        license.expiresAt,
        now,
        now
      ]
    );

    return {
      id: (result as any).insertId,
      ...license,
      createdAt: now,
      updatedAt: now,
      totalApiCalls: 0
    };
  }

  /**
   * Update license
   */
  async updateLicense(key: string, updates: Partial<License>): Promise<void> {
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.maxInstances !== undefined) {
      fields.push('max_instances = ?');
      values.push(updates.maxInstances);
    }
    if (updates.expiresAt !== undefined) {
      fields.push('expires_at = ?');
      values.push(updates.expiresAt);
    }
    if (updates.features) {
      fields.push('features = ?');
      values.push(updates.features);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(key);

    await this.pool.execute(
      `UPDATE licenses SET ${fields.join(', ')} WHERE \`key\` = ?`,
      values
    );
  }

  /**
   * Get or create license instance (race-condition safe with UPSERT)
   */
  async upsertInstance(
    licenseId: number,
    instanceId: string,
    version: string,
    ipAddress?: string,
    hostname?: string
  ): Promise<LicenseInstance> {
    const now = Date.now();

    // MySQL ON DUPLICATE KEY UPDATE for atomic upsert
    await this.pool.execute(
      `INSERT INTO license_instances (
        license_id, instance_id, version, last_seen, ip_address, hostname, validation_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        last_seen = VALUES(last_seen),
        version = VALUES(version),
        ip_address = VALUES(ip_address),
        hostname = VALUES(hostname),
        validation_count = validation_count + 1`,
      [licenseId, instanceId, version, now, ipAddress, hostname, now]
    );

    // Fetch the final state after upsert
    const [rows] = await this.pool.execute(
      'SELECT * FROM license_instances WHERE license_id = ? AND instance_id = ?',
      [licenseId, instanceId]
    );

    return toCamelCase((rows as any[])[0]) as LicenseInstance;
  }

  /**
   * Get instance count for license
   */
  async getInstanceCount(licenseId: number): Promise<number> {
    const [rows] = await this.pool.execute(
      'SELECT COUNT(*) as count FROM license_instances WHERE license_id = ?',
      [licenseId]
    );

    return ((rows as any[])[0]).count;
  }

  /**
   * Log validation attempt
   */
  async logValidation(
    licenseId: number,
    instanceId: string,
    version: string,
    success: boolean,
    errorCode?: string,
    ipAddress?: string
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO validation_logs (
        license_id, instance_id, version, success, error_code, ip_address, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [licenseId, instanceId, version, success, errorCode, ipAddress, Date.now()]
    );
  }

  /**
   * Get validation statistics
   */
  async getValidationStats(licenseId: number, days: number = 30): Promise<{
    total: number;
    successful: number;
    failed: number;
  }> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const [rows] = await this.pool.execute(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
      FROM validation_logs
      WHERE license_id = ? AND timestamp > ?`,
      [licenseId, since]
    );

    return (rows as any[])[0];
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

  // ===== SERVICE INTEGRATOR METHODS =====

  /**
   * Create service integrator (master account)
   */
  async createServiceIntegrator(si: Omit<ServiceIntegrator, 'id' | 'createdAt'>): Promise<ServiceIntegrator> {
    const now = Date.now();

    const [result] = await this.pool.execute(
      `INSERT INTO service_integrators (
        company_name, contact_email, billing_email, master_license_key,
        white_label_enabled, custom_domain, logo_url, created_at, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        si.companyName,
        si.contactEmail,
        si.billingEmail,
        si.masterLicenseKey,
        si.whiteLabelEnabled,
        si.customDomain || null,
        si.logoUrl || null,
        now,
        si.status
      ]
    );

    return {
      id: (result as any).insertId,
      ...si,
      createdAt: now
    };
  }

  /**
   * Get service integrator by master key
   */
  async getServiceIntegrator(masterLicenseKey: string): Promise<ServiceIntegrator | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM service_integrators WHERE master_license_key = ?',
      [masterLicenseKey]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    const row = convertBooleans(toCamelCase(rowsArray[0]), ['whiteLabelEnabled']);
    return row as ServiceIntegrator;
  }

  /**
   * Get service integrator by ID
   */
  async getServiceIntegratorById(id: number): Promise<ServiceIntegrator | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM service_integrators WHERE id = ?',
      [id]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    const row = convertBooleans(toCamelCase(rowsArray[0]), ['whiteLabelEnabled']);
    return row as ServiceIntegrator;
  }

  /**
   * List all service integrators
   */
  async listServiceIntegrators(status?: 'active' | 'suspended' | 'churned'): Promise<ServiceIntegrator[]> {
    const sql = status
      ? 'SELECT * FROM service_integrators WHERE status = ? ORDER BY created_at DESC'
      : 'SELECT * FROM service_integrators ORDER BY created_at DESC';

    const params = status ? [status] : [];
    const [rows] = await this.pool.execute(sql, params);

    return (rows as any[]).map(row =>
      convertBooleans(toCamelCase(row), ['whiteLabelEnabled']) as ServiceIntegrator
    );
  }

  /**
   * Update service integrator
   */
  async updateServiceIntegrator(id: number, updates: Partial<ServiceIntegrator>): Promise<ServiceIntegrator | undefined> {
    const fields: string[] = [];
    const values: any[] = [];

    // Build dynamic UPDATE query
    if (updates.companyName !== undefined) {
      fields.push('company_name = ?');
      values.push(updates.companyName);
    }
    if (updates.contactEmail !== undefined) {
      fields.push('contact_email = ?');
      values.push(updates.contactEmail);
    }
    if (updates.billingEmail !== undefined) {
      fields.push('billing_email = ?');
      values.push(updates.billingEmail);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.whiteLabelEnabled !== undefined) {
      fields.push('white_label_enabled = ?');
      values.push(updates.whiteLabelEnabled);
    }
    if (updates.customDomain !== undefined) {
      fields.push('custom_domain = ?');
      values.push(updates.customDomain);
    }
    if (updates.logoUrl !== undefined) {
      fields.push('logo_url = ?');
      values.push(updates.logoUrl);
    }

    if (fields.length === 0) {
      // No updates provided, return current record
      const [rows] = await this.pool.execute('SELECT * FROM service_integrators WHERE id = ?', [id]);
      const rowsArray = rows as any[];
      if (rowsArray.length === 0) return undefined;
      return convertBooleans(toCamelCase(rowsArray[0]), ['whiteLabelEnabled']) as ServiceIntegrator;
    }

    values.push(id);
    await this.pool.execute(
      `UPDATE service_integrators SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    // Return updated record
    const [rows] = await this.pool.execute('SELECT * FROM service_integrators WHERE id = ?', [id]);
    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    return convertBooleans(toCamelCase(rowsArray[0]), ['whiteLabelEnabled']) as ServiceIntegrator;
  }

  /**
   * Delete service integrator
   */
  async deleteServiceIntegrator(id: number): Promise<void> {
    await this.pool.execute('DELETE FROM service_integrators WHERE id = ?', [id]);
  }

  // ===== CUSTOMER METHODS =====

  /**
   * Create customer
   */
  async createCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalApiCalls'>): Promise<Customer> {
    const now = Date.now();

    const [result] = await this.pool.execute(
      `INSERT INTO customers (
        service_integrator_id, name, contact_email, company, license_key, theme,
        created_at, updated_at, status, total_api_calls, last_api_call
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [
        customer.serviceIntegratorId,
        customer.name,
        customer.contactEmail,
        customer.company || null,
        customer.licenseKey,
        customer.theme || null,
        now,
        now,
        customer.status
      ]
    );

    return {
      id: (result as any).insertId,
      ...customer,
      createdAt: now,
      updatedAt: now,
      totalApiCalls: 0
    };
  }

  /**
   * Get customer by license key
   */
  async getCustomer(licenseKey: string): Promise<Customer | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM customers WHERE license_key = ?',
      [licenseKey]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    return toCamelCase(rowsArray[0]) as Customer;
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(customerId: number): Promise<Customer | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM customers WHERE id = ?',
      [customerId]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    return toCamelCase(rowsArray[0]) as Customer;
  }

  /**
   * List customers for a service integrator
   */
  async listCustomers(serviceIntegratorId: number, status?: 'active' | 'suspended' | 'churned'): Promise<Customer[]> {
    const sql = status
      ? 'SELECT * FROM customers WHERE service_integrator_id = ? AND status = ? ORDER BY created_at DESC'
      : 'SELECT * FROM customers WHERE service_integrator_id = ? ORDER BY created_at DESC';

    const params = status ? [serviceIntegratorId, status] : [serviceIntegratorId];
    const [rows] = await this.pool.execute(sql, params);

    return (rows as any[]).map(row => toCamelCase(row) as Customer);
  }

  /**
   * Update customer
   */
  async updateCustomer(customerId: number, updates: Partial<Customer>): Promise<void> {
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.name) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.contactEmail) {
      fields.push('contact_email = ?');
      values.push(updates.contactEmail);
    }
    if (updates.company !== undefined) {
      fields.push('company = ?');
      values.push(updates.company);
    }
    if (updates.theme !== undefined) {
      fields.push('theme = ?');
      values.push(updates.theme);
    }
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(customerId);

    await this.pool.execute(
      `UPDATE customers SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Increment customer API call counter
   */
  async incrementCustomerApiCalls(customerId: number): Promise<void> {
    await this.pool.execute(
      `UPDATE customers
      SET total_api_calls = total_api_calls + 1,
          last_api_call = ?
      WHERE id = ?`,
      [Date.now(), customerId]
    );
  }

  // ===== CUSTOMER INSTANCE METHODS =====

  /**
   * Upsert customer instance
   */
  async upsertCustomerInstance(
    customerId: number,
    instanceId: string,
    version: string,
    ipAddress?: string,
    hostname?: string,
    instanceName?: string
  ): Promise<CustomerInstance> {
    const now = Date.now();

    await this.pool.execute(
      `INSERT INTO customer_instances (
        customer_id, instance_id, instance_name, hostname, ip_address,
        last_seen, version, validation_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON DUPLICATE KEY UPDATE
        last_seen = VALUES(last_seen),
        version = VALUES(version),
        ip_address = VALUES(ip_address),
        hostname = VALUES(hostname),
        instance_name = COALESCE(VALUES(instance_name), instance_name),
        validation_count = validation_count + 1`,
      [customerId, instanceId, instanceName, hostname, ipAddress, now, version, now]
    );

    const [rows] = await this.pool.execute(
      'SELECT * FROM customer_instances WHERE customer_id = ? AND instance_id = ?',
      [customerId, instanceId]
    );

    return toCamelCase((rows as any[])[0]) as CustomerInstance;
  }

  /**
   * Get customer instance count
   */
  async getCustomerInstanceCount(customerId: number): Promise<number> {
    const [rows] = await this.pool.execute(
      'SELECT COUNT(*) as count FROM customer_instances WHERE customer_id = ?',
      [customerId]
    );

    return ((rows as any[])[0]).count;
  }

  /**
   * List customer instances
   */
  async listCustomerInstances(customerId: number): Promise<CustomerInstance[]> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM customer_instances WHERE customer_id = ? ORDER BY last_seen DESC',
      [customerId]
    );

    return (rows as any[]).map(row => toCamelCase(row) as CustomerInstance);
  }

  // ===== MCP USAGE TRACKING =====

  /**
   * Log MCP tool usage
   */
  async logMcpUsage(usage: Omit<McpUsage, 'id'>): Promise<void> {
    await this.pool.execute(
      `INSERT INTO mcp_usage (
        customer_id, instance_id, tool_name, tool_category, timestamp,
        duration_ms, success, error_message, request_params, ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usage.customerId,
        usage.instanceId,
        usage.toolName,
        usage.toolCategory,
        usage.timestamp,
        usage.durationMs,
        usage.success,
        usage.errorMessage || null,
        usage.requestParams || null,
        usage.ipAddress || null
      ]
    );
  }

  /**
   * Get MCP usage statistics for customer
   */
  async getMcpUsageStats(customerId: number, days: number = 30): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgDurationMs: number;
    byCategory: Record<string, number>;
    topTools: Array<{ toolName: string; count: number }>;
  }> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Overall stats
    const [overallRows] = await this.pool.execute(
      `SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_calls,
        AVG(duration_ms) as avg_duration_ms
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?`,
      [customerId, since]
    );

    const overall = (overallRows as any[])[0];

    // By category
    const [categoryRows] = await this.pool.execute(
      `SELECT tool_category, COUNT(*) as count
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?
      GROUP BY tool_category`,
      [customerId, since]
    );

    const byCategory: Record<string, number> = {};
    (categoryRows as any[]).forEach(c => {
      byCategory[c.tool_category] = c.count;
    });

    // Top tools
    const [topToolsRows] = await this.pool.execute(
      `SELECT tool_name, COUNT(*) as count
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 10`,
      [customerId, since]
    );

    const topTools = (topToolsRows as any[]).map(row => ({
      toolName: row.tool_name,
      count: row.count
    }));

    return {
      totalCalls: overall.total_calls || 0,
      successfulCalls: overall.successful_calls || 0,
      failedCalls: overall.failed_calls || 0,
      avgDurationMs: overall.avg_duration_ms || 0,
      byCategory,
      topTools
    };
  }

  /**
   * Get MCP usage over time (for charts)
   */
  async getMcpUsageTimeseries(customerId: number, days: number = 30, granularity: 'hour' | 'day' = 'day'): Promise<Array<{
    timestamp: number;
    count: number;
  }>> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const intervalMs = granularity === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const [rows] = await this.pool.execute(
      `SELECT
        FLOOR(timestamp / ?) * ? as bucket,
        COUNT(*) as count
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?
      GROUP BY bucket
      ORDER BY bucket ASC`,
      [intervalMs, intervalMs, customerId, since]
    );

    return (rows as any[]).map(r => ({
      timestamp: r.bucket,
      count: r.count
    }));
  }

  // ===== API LOGGING =====

  /**
   * Log API request
   */
  async logApiRequest(log: Omit<ApiLog, 'id'>): Promise<void> {
    // Safety check - skip logging if pool not initialized yet
    if (!this.pool || !this.isInitialized) {
      console.warn('[DB] Skipping API log - database not initialized yet');
      return;
    }

    await this.pool.execute(
      `INSERT INTO api_logs (
        endpoint, method, status_code, duration_ms, timestamp,
        ip_address, user_agent, license_key, error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.endpoint,
        log.method,
        log.statusCode,
        log.durationMs,
        log.timestamp,
        log.ipAddress || null,
        log.userAgent || null,
        log.licenseKey || null,
        log.errorMessage || null
      ]
    );
  }

  /**
   * Get API statistics
   */
  async getApiStats(days: number = 30): Promise<{
    totalRequests: number;
    avgDurationMs: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  }> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const [overallRows] = await this.pool.execute(
      `SELECT
        COUNT(*) as total_requests,
        AVG(duration_ms) as avg_duration_ms,
        CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS DECIMAL(10,4)) / COUNT(*) as error_rate
      FROM api_logs
      WHERE timestamp > ?`,
      [since]
    );

    const overall = (overallRows as any[])[0];

    const [topEndpointsRows] = await this.pool.execute(
      `SELECT endpoint, COUNT(*) as count
      FROM api_logs
      WHERE timestamp > ?
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 10`,
      [since]
    );

    const topEndpoints = (topEndpointsRows as any[]);

    return {
      totalRequests: overall.total_requests || 0,
      avgDurationMs: overall.avg_duration_ms || 0,
      errorRate: overall.error_rate || 0,
      topEndpoints
    };
  }

  // ===== SSO CONFIG METHODS =====

  /**
   * Get SSO configuration for customer
   */
  async getSsoConfig(customerId: number): Promise<SsoConfig | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM sso_config WHERE customer_id = ?',
      [customerId]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    return convertBooleans(
      toCamelCase(rowsArray[0]),
      ['enabled', 'wantAssertionsSigned', 'wantAuthnResponseSigned']
    ) as SsoConfig;
  }

  /**
   * Create SSO configuration
   */
  async createSsoConfig(config: Omit<SsoConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<SsoConfig> {
    const now = Date.now();

    const [result] = await this.pool.execute(
      `INSERT INTO sso_config (
        customer_id, enabled, provider, entry_point, issuer, cert,
        callback_url, logout_url, name_id_format, want_assertions_signed,
        want_authn_response_signed, signature_algorithm, attribute_mapping,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        config.customerId,
        config.enabled,
        config.provider,
        config.entryPoint,
        config.issuer,
        config.cert,
        config.callbackUrl,
        config.logoutUrl || null,
        config.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
        config.wantAssertionsSigned,
        config.wantAuthnResponseSigned,
        config.signatureAlgorithm || 'sha256',
        config.attributeMapping || null,
        now,
        now
      ]
    );

    return {
      id: (result as any).insertId,
      ...config,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Update SSO configuration
   */
  async updateSsoConfig(customerId: number, updates: Partial<SsoConfig>): Promise<void> {
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.enabled !== undefined) {
      fields.push('enabled = ?');
      values.push(updates.enabled);
    }
    if (updates.provider) {
      fields.push('provider = ?');
      values.push(updates.provider);
    }
    if (updates.entryPoint) {
      fields.push('entry_point = ?');
      values.push(updates.entryPoint);
    }
    if (updates.issuer) {
      fields.push('issuer = ?');
      values.push(updates.issuer);
    }
    if (updates.cert) {
      fields.push('cert = ?');
      values.push(updates.cert);
    }
    if (updates.callbackUrl) {
      fields.push('callback_url = ?');
      values.push(updates.callbackUrl);
    }
    if (updates.logoutUrl !== undefined) {
      fields.push('logout_url = ?');
      values.push(updates.logoutUrl);
    }
    if (updates.nameIdFormat) {
      fields.push('name_id_format = ?');
      values.push(updates.nameIdFormat);
    }
    if (updates.wantAssertionsSigned !== undefined) {
      fields.push('want_assertions_signed = ?');
      values.push(updates.wantAssertionsSigned);
    }
    if (updates.wantAuthnResponseSigned !== undefined) {
      fields.push('want_authn_response_signed = ?');
      values.push(updates.wantAuthnResponseSigned);
    }
    if (updates.signatureAlgorithm) {
      fields.push('signature_algorithm = ?');
      values.push(updates.signatureAlgorithm);
    }
    if (updates.attributeMapping !== undefined) {
      fields.push('attribute_mapping = ?');
      values.push(updates.attributeMapping);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(customerId);

    await this.pool.execute(
      `UPDATE sso_config SET ${fields.join(', ')} WHERE customer_id = ?`,
      values
    );
  }

  /**
   * Delete SSO configuration
   */
  async deleteSsoConfig(customerId: number): Promise<void> {
    await this.pool.execute(
      'DELETE FROM sso_config WHERE customer_id = ?',
      [customerId]
    );
  }

  // ===== SSO SESSION METHODS =====

  /**
   * Create SSO session
   */
  async createSsoSession(session: Omit<SsoSession, 'id' | 'createdAt'>): Promise<SsoSession> {
    const now = Date.now();

    const [result] = await this.pool.execute(
      `INSERT INTO sso_sessions (
        customer_id, user_id, email, display_name, session_token,
        name_id, session_index, attributes, ip_address, user_agent,
        created_at, expires_at, last_activity
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.customerId,
        session.userId,
        session.email,
        session.displayName || null,
        session.sessionToken,
        session.nameId || null,
        session.sessionIndex || null,
        session.attributes || null,
        session.ipAddress || null,
        session.userAgent || null,
        now,
        session.expiresAt,
        session.lastActivity
      ]
    );

    return {
      id: (result as any).insertId,
      ...session,
      createdAt: now
    };
  }

  /**
   * Get SSO session by token
   */
  async getSsoSession(sessionToken: string): Promise<SsoSession | undefined> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM sso_sessions WHERE session_token = ?',
      [sessionToken]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    return toCamelCase(rowsArray[0]) as SsoSession;
  }

  /**
   * Get SSO session by user and customer
   */
  async getSsoSessionByUser(customerId: number, userId: string): Promise<SsoSession | undefined> {
    const [rows] = await this.pool.execute(
      `SELECT * FROM sso_sessions
      WHERE customer_id = ? AND user_id = ?
      ORDER BY created_at DESC
      LIMIT 1`,
      [customerId, userId]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return undefined;

    return toCamelCase(rowsArray[0]) as SsoSession;
  }

  /**
   * Update session last activity
   */
  async updateSessionActivity(sessionToken: string): Promise<void> {
    await this.pool.execute(
      'UPDATE sso_sessions SET last_activity = ? WHERE session_token = ?',
      [Date.now(), sessionToken]
    );
  }

  /**
   * Delete SSO session (logout)
   */
  async deleteSsoSession(sessionToken: string): Promise<void> {
    await this.pool.execute(
      'DELETE FROM sso_sessions WHERE session_token = ?',
      [sessionToken]
    );
  }

  /**
   * Delete all sessions for customer
   */
  async deleteSsoSessionsByCustomer(customerId: number): Promise<void> {
    await this.pool.execute(
      'DELETE FROM sso_sessions WHERE customer_id = ?',
      [customerId]
    );
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const now = Date.now();
    const [result] = await this.pool.execute(
      'DELETE FROM sso_sessions WHERE expires_at < ?',
      [now]
    );

    return (result as any).affectedRows;
  }

  /**
   * Get active sessions for customer
   */
  async getActiveSessions(customerId: number): Promise<SsoSession[]> {
    const now = Date.now();
    const [rows] = await this.pool.execute(
      `SELECT * FROM sso_sessions
      WHERE customer_id = ? AND expires_at > ?
      ORDER BY last_activity DESC`,
      [customerId, now]
    );

    return (rows as any[]).map(row => toCamelCase(row) as SsoSession);
  }

  /**
   * Get SSO usage statistics
   */
  async getSsoStats(customerId: number, days: number = 30): Promise<{
    totalLogins: number;
    activeUsers: number;
    avgSessionDuration: number;
  }> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const [rows] = await this.pool.execute(
      `SELECT
        COUNT(*) as total_logins,
        COUNT(DISTINCT user_id) as active_users,
        AVG(last_activity - created_at) as avg_session_duration
      FROM sso_sessions
      WHERE customer_id = ? AND created_at > ?`,
      [customerId, since]
    );

    const result = (rows as any[])[0];

    return {
      totalLogins: result.total_logins || 0,
      activeUsers: result.active_users || 0,
      avgSessionDuration: result.avg_session_duration || 0
    };
  }

  // ============================================================================
  // CREDENTIALS MANAGEMENT (KMS Envelope Encryption or AES-256-GCM)
  // ============================================================================

  /**
   * Get encryption key from environment variable (fallback when KMS not available)
   * MUST be exactly 32 bytes (256 bits) for AES-256
   */
  private getEncryptionKey(): Buffer {
    const key = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (!key) {
      throw new Error('CREDENTIALS_ENCRYPTION_KEY environment variable not set');
    }
    // Ensure exactly 32 bytes
    return Buffer.from(key.padEnd(32, '0').substring(0, 32), 'utf8');
  }

  /**
   * Encrypt credential data
   * Uses KMS envelope encryption if available, otherwise local AES-256-GCM
   */
  private async encryptCredential(plaintext: string): Promise<string> {
    if (this.kmsService) {
      // KMS envelope encryption (format: encrypted_dek:iv:authTag:encrypted_data)
      return await this.kmsService.encrypt(plaintext);
    } else {
      // Fallback: Local AES-256-GCM (format: iv:authTag:encrypted_data)
      const iv = crypto.randomBytes(16); // 128-bit IV
      const key = this.getEncryptionKey();
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
    }
  }

  /**
   * Decrypt credential data
   * Supports both KMS envelope encryption and local AES-256-GCM
   */
  private async decryptCredential(ciphertext: string): Promise<string> {
    const parts = ciphertext.split(':');

    // KMS format: encrypted_dek:iv:authTag:encrypted_data (4 parts)
    if (parts.length === 4 && this.kmsService) {
      return await this.kmsService.decrypt(ciphertext);
    }

    // Local AES-256-GCM format: iv:authTag:encrypted_data (3 parts)
    if (parts.length === 3) {
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const key = this.getEncryptionKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    }

    throw new Error('Invalid ciphertext format');
  }

  /**
   * Create new customer credential (with encryption)
   */
  async createCustomerCredential(data: {
    customerId: number;
    serviceType: string;
    credentialType: string;
    baseUrl: string;
    accessToken?: string;
    refreshToken?: string;
    apiToken?: string;
    username?: string;
    password?: string;
    email?: string;
    clientId?: string;
    tokenType?: string;
    expiresAt?: number;
    scope?: string;
    enabled?: boolean;
  }): Promise<CustomerCredential> {
    const now = Date.now();

    // Encrypt sensitive fields
    const encryptedAccessToken = data.accessToken ? await this.encryptCredential(data.accessToken) : null;
    const encryptedRefreshToken = data.refreshToken ? await this.encryptCredential(data.refreshToken) : null;
    const encryptedApiToken = data.apiToken ? await this.encryptCredential(data.apiToken) : null;
    const encryptedPassword = data.password ? await this.encryptCredential(data.password) : null;

    const [result] = await this.pool.execute(
      `INSERT INTO customer_credentials (
        customer_id, service_type, credential_type, base_url,
        access_token, refresh_token, api_token, username, password,
        email, client_id, token_type, expires_at, scope, enabled,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.customerId,
        data.serviceType,
        data.credentialType,
        data.baseUrl,
        encryptedAccessToken,
        encryptedRefreshToken,
        encryptedApiToken,
        data.username || null,
        encryptedPassword,
        data.email || null,
        data.clientId || null,
        data.tokenType || null,
        data.expiresAt || null,
        data.scope || null,
        data.enabled !== false ? 1 : 0,
        now,
        now
      ]
    );

    const insertId = (result as any).insertId;

    // Audit log
    await this.pool.execute(
      `INSERT INTO customer_credentials_audit (
        credential_id, customer_id, action, timestamp
      ) VALUES (?, ?, 'created', ?)`,
      [insertId, data.customerId, now]
    );

    // Return created credential (with decrypted values)
    const created = await this.getCustomerCredential(data.customerId, data.serviceType as any);
    if (!created) {
      throw new Error('Failed to retrieve created credential');
    }
    return created;
  }

  /**
   * Get customer credential by service type (with decryption)
   */
  async getCustomerCredential(
    customerId: number,
    serviceType: 'jira' | 'azure-devops' | 'confluence' | 'servicenow' | 'github' | 'gitlab'
  ): Promise<CustomerCredential | null> {
    const [rows] = await this.pool.execute(
      `SELECT * FROM customer_credentials WHERE customer_id = ? AND service_type = ?`,
      [customerId, serviceType]
    );

    if ((rows as any[]).length === 0) {
      return null;
    }

    const row = (rows as any[])[0];
    const now = Date.now();

    // Update last_used
    await this.pool.execute(
      `UPDATE customer_credentials SET last_used = ? WHERE id = ?`,
      [now, row.id]
    );

    // Audit log
    await this.pool.execute(
      `INSERT INTO customer_credentials_audit (
        credential_id, customer_id, action, timestamp
      ) VALUES (?, ?, 'accessed', ?)`,
      [row.id, customerId, now]
    );

    // Decrypt sensitive fields (parallel for performance)
    const [accessToken, refreshToken, apiToken, password] = await Promise.all([
      row.access_token ? this.decryptCredential(row.access_token) : Promise.resolve(undefined),
      row.refresh_token ? this.decryptCredential(row.refresh_token) : Promise.resolve(undefined),
      row.api_token ? this.decryptCredential(row.api_token) : Promise.resolve(undefined),
      row.password ? this.decryptCredential(row.password) : Promise.resolve(undefined)
    ]);

    const credential: CustomerCredential = {
      id: row.id,
      customerId: row.customer_id,
      serviceType: row.service_type,
      credentialType: row.credential_type,
      baseUrl: row.base_url,
      accessToken,
      refreshToken,
      apiToken,
      username: row.username || undefined,
      password,
      email: row.email || undefined,
      clientId: row.client_id || undefined,
      tokenType: row.token_type || undefined,
      expiresAt: row.expires_at || undefined,
      scope: row.scope || undefined,
      configJson: row.config_json || undefined,
      enabled: !!row.enabled,
      lastUsed: row.last_used || undefined,
      lastRefreshed: row.last_refreshed || undefined,
      lastTestStatus: row.last_test_status || undefined,
      lastTestMessage: row.last_test_message || undefined,
      lastTestedAt: row.last_tested_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    return credential;
  }

  /**
   * List all credentials for customer
   */
  async listCustomerCredentials(customerId: number): Promise<CustomerCredential[]> {
    const [rows] = await this.pool.execute(
      `SELECT * FROM customer_credentials WHERE customer_id = ? ORDER BY service_type`,
      [customerId]
    );

    // Decrypt all credentials in parallel for performance
    const credentials: CustomerCredential[] = await Promise.all(
      (rows as any[]).map(async (row) => {
        const [accessToken, refreshToken, apiToken, password] = await Promise.all([
          row.access_token ? this.decryptCredential(row.access_token) : Promise.resolve(undefined),
          row.refresh_token ? this.decryptCredential(row.refresh_token) : Promise.resolve(undefined),
          row.api_token ? this.decryptCredential(row.api_token) : Promise.resolve(undefined),
          row.password ? this.decryptCredential(row.password) : Promise.resolve(undefined)
        ]);

        return {
          id: row.id,
          customerId: row.customer_id,
          serviceType: row.service_type,
          credentialType: row.credential_type,
          baseUrl: row.base_url,
          accessToken,
          refreshToken,
          apiToken,
          username: row.username || undefined,
          password,
          email: row.email || undefined,
          clientId: row.client_id || undefined,
          tokenType: row.token_type || undefined,
          expiresAt: row.expires_at || undefined,
          scope: row.scope || undefined,
          configJson: row.config_json || undefined,
          enabled: !!row.enabled,
          lastUsed: row.last_used || undefined,
          lastRefreshed: row.last_refreshed || undefined,
          lastTestStatus: row.last_test_status || undefined,
          lastTestMessage: row.last_test_message || undefined,
          lastTestedAt: row.last_tested_at || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
      })
    );

    return credentials;
  }

  /**
   * Update customer credential
   */
  async updateCustomerCredential(
    customerId: number,
    serviceType: string,
    updates: Partial<{
      accessToken: string;
      refreshToken: string;
      apiToken: string;
      password: string;
      baseUrl: string;
      email: string;
      enabled: boolean;
      expiresAt: number;
      lastTestStatus: string;
      lastTestMessage: string;
    }>
  ): Promise<void> {
    const now = Date.now();
    const setParts: string[] = [];
    const values: any[] = [];

    // Encrypt sensitive fields before update
    if (updates.accessToken !== undefined) {
      setParts.push('access_token = ?');
      values.push(this.encryptCredential(updates.accessToken));
    }
    if (updates.refreshToken !== undefined) {
      setParts.push('refresh_token = ?');
      values.push(this.encryptCredential(updates.refreshToken));
    }
    if (updates.apiToken !== undefined) {
      setParts.push('api_token = ?');
      values.push(this.encryptCredential(updates.apiToken));
    }
    if (updates.password !== undefined) {
      setParts.push('password = ?');
      values.push(this.encryptCredential(updates.password));
    }
    if (updates.baseUrl !== undefined) {
      setParts.push('base_url = ?');
      values.push(updates.baseUrl);
    }
    if (updates.email !== undefined) {
      setParts.push('email = ?');
      values.push(updates.email);
    }
    if (updates.enabled !== undefined) {
      setParts.push('enabled = ?');
      values.push(updates.enabled ? 1 : 0);
    }
    if (updates.expiresAt !== undefined) {
      setParts.push('expires_at = ?');
      values.push(updates.expiresAt);
    }
    if (updates.lastTestStatus !== undefined) {
      setParts.push('last_test_status = ?');
      values.push(updates.lastTestStatus);
    }
    if (updates.lastTestMessage !== undefined) {
      setParts.push('last_test_message = ?');
      values.push(updates.lastTestMessage);
    }

    setParts.push('updated_at = ?');
    values.push(now);

    values.push(customerId, serviceType);

    await this.pool.execute(
      `UPDATE customer_credentials SET ${setParts.join(', ')} WHERE customer_id = ? AND service_type = ?`,
      values
    );

    // Audit log
    const [credRows] = await this.pool.execute(
      `SELECT id FROM customer_credentials WHERE customer_id = ? AND service_type = ?`,
      [customerId, serviceType]
    );

    if ((credRows as any[]).length > 0) {
      const credId = (credRows as any[])[0].id;
      await this.pool.execute(
        `INSERT INTO customer_credentials_audit (
          credential_id, customer_id, action, timestamp
        ) VALUES (?, ?, 'updated', ?)`,
        [credId, customerId, now]
      );
    }
  }

  /**
   * Delete customer credential
   */
  async deleteCustomerCredential(customerId: number, serviceType: string): Promise<void> {
    const now = Date.now();

    // Get credential ID for audit
    const [credRows] = await this.pool.execute(
      `SELECT id FROM customer_credentials WHERE customer_id = ? AND service_type = ?`,
      [customerId, serviceType]
    );

    if ((credRows as any[]).length > 0) {
      const credId = (credRows as any[])[0].id;

      // Audit log (before delete due to CASCADE)
      await this.pool.execute(
        `INSERT INTO customer_credentials_audit (
          credential_id, customer_id, action, timestamp
        ) VALUES (?, ?, 'deleted', ?)`,
        [credId, customerId, now]
      );
    }

    // Delete credential (audit records will CASCADE)
    await this.pool.execute(
      `DELETE FROM customer_credentials WHERE customer_id = ? AND service_type = ?`,
      [customerId, serviceType]
    );
  }

  /**
   * Test credential and update test status
   */
  async updateCredentialTestStatus(
    customerId: number,
    serviceType: string,
    status: 'success' | 'failed',
    message?: string
  ): Promise<void> {
    const now = Date.now();

    await this.pool.execute(
      `UPDATE customer_credentials
       SET last_test_status = ?, last_test_message = ?, last_tested_at = ?, updated_at = ?
       WHERE customer_id = ? AND service_type = ?`,
      [status, message || null, now, now, customerId, serviceType]
    );

    // Audit log
    const [credRows] = await this.pool.execute(
      `SELECT id FROM customer_credentials WHERE customer_id = ? AND service_type = ?`,
      [customerId, serviceType]
    );

    if ((credRows as any[]).length > 0) {
      const credId = (credRows as any[])[0].id;
      await this.pool.execute(
        `INSERT INTO customer_credentials_audit (
          credential_id, customer_id, action, success, error_message, timestamp
        ) VALUES (?, ?, 'tested', ?, ?, ?)`,
        [credId, customerId, status === 'success' ? 1 : 0, message || null, now]
      );
    }
  }

  // ============================================================================
  // CUSTOM THEMES MANAGEMENT (Service Integrator Feature)
  // ============================================================================

  /**
   * Create custom theme for service integrator
   */
  async createSITheme(theme: Omit<ServiceIntegratorTheme, 'id' | 'createdAt' | 'updatedAt'>): Promise<ServiceIntegratorTheme> {
    const now = Date.now();

    const [result] = await this.pool.execute(
      `INSERT INTO service_integrator_themes (
        service_integrator_id, theme_name, display_name, description,
        theme_config, primary_color, secondary_color, accent_color,
        is_active, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        theme.serviceIntegratorId,
        theme.themeName,
        theme.displayName,
        theme.description || null,
        JSON.stringify(theme.themeConfig),
        theme.primaryColor,
        theme.secondaryColor || null,
        theme.accentColor || null,
        theme.isActive !== false ? 1 : 0,
        theme.isDefault || false ? 1 : 0,
        now,
        now
      ]
    );

    return {
      id: (result as any).insertId,
      ...theme,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Get custom theme by ID
   */
  async getSITheme(themeId: number): Promise<ServiceIntegratorTheme | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM service_integrator_themes WHERE id = ?',
      [themeId]
    );

    if ((rows as any[]).length === 0) return null;

    const row = (rows as any[])[0];
    return {
      id: row.id,
      serviceIntegratorId: row.service_integrator_id,
      themeName: row.theme_name,
      displayName: row.display_name,
      description: row.description,
      themeConfig: typeof row.theme_config === 'string' ? JSON.parse(row.theme_config) : row.theme_config,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Get custom theme by name for a service integrator
   */
  async getSIThemeByName(siId: number, themeName: string): Promise<ServiceIntegratorTheme | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM service_integrator_themes WHERE service_integrator_id = ? AND theme_name = ?',
      [siId, themeName]
    );

    if ((rows as any[]).length === 0) return null;

    const row = (rows as any[])[0];
    return {
      id: row.id,
      serviceIntegratorId: row.service_integrator_id,
      themeName: row.theme_name,
      displayName: row.display_name,
      description: row.description,
      themeConfig: typeof row.theme_config === 'string' ? JSON.parse(row.theme_config) : row.theme_config,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * List all themes for a service integrator
   */
  async listSIThemes(siId: number, activeOnly = false): Promise<ServiceIntegratorTheme[]> {
    const sql = activeOnly
      ? 'SELECT * FROM service_integrator_themes WHERE service_integrator_id = ? AND is_active = 1 ORDER BY is_default DESC, display_name ASC'
      : 'SELECT * FROM service_integrator_themes WHERE service_integrator_id = ? ORDER BY is_default DESC, display_name ASC';

    const [rows] = await this.pool.execute(sql, [siId]);

    return (rows as any[]).map(row => ({
      id: row.id,
      serviceIntegratorId: row.service_integrator_id,
      themeName: row.theme_name,
      displayName: row.display_name,
      description: row.description,
      themeConfig: typeof row.theme_config === 'string' ? JSON.parse(row.theme_config) : row.theme_config,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  /**
   * Update custom theme
   */
  async updateSITheme(themeId: number, updates: Partial<ServiceIntegratorTheme>): Promise<void> {
    const now = Date.now();
    const fields: string[] = [];
    const values: any[] = [];

    if (updates.themeName !== undefined) {
      fields.push('theme_name = ?');
      values.push(updates.themeName);
    }
    if (updates.displayName !== undefined) {
      fields.push('display_name = ?');
      values.push(updates.displayName);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.themeConfig !== undefined) {
      fields.push('theme_config = ?');
      values.push(JSON.stringify(updates.themeConfig));
    }
    if (updates.primaryColor !== undefined) {
      fields.push('primary_color = ?');
      values.push(updates.primaryColor);
    }
    if (updates.secondaryColor !== undefined) {
      fields.push('secondary_color = ?');
      values.push(updates.secondaryColor);
    }
    if (updates.accentColor !== undefined) {
      fields.push('accent_color = ?');
      values.push(updates.accentColor);
    }
    if (updates.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.isActive ? 1 : 0);
    }
    if (updates.isDefault !== undefined) {
      fields.push('is_default = ?');
      values.push(updates.isDefault ? 1 : 0);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    values.push(now);
    values.push(themeId);

    await this.pool.execute(
      `UPDATE service_integrator_themes SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
  }

  /**
   * Delete custom theme
   */
  async deleteSITheme(themeId: number): Promise<void> {
    await this.pool.execute(
      'DELETE FROM service_integrator_themes WHERE id = ?',
      [themeId]
    );
  }

  /**
   * Set default theme for service integrator
   */
  async setSIDefaultTheme(siId: number, themeId: number): Promise<void> {
    // Remove default flag from all themes for this SI
    await this.pool.execute(
      'UPDATE service_integrator_themes SET is_default = 0 WHERE service_integrator_id = ?',
      [siId]
    );

    // Set new default
    await this.pool.execute(
      'UPDATE service_integrator_themes SET is_default = 1, updated_at = ? WHERE id = ?',
      [Date.now(), themeId]
    );
  }

  /**
   * Get default theme for service integrator
   */
  async getSIDefaultTheme(siId: number): Promise<ServiceIntegratorTheme | null> {
    const [rows] = await this.pool.execute(
      'SELECT * FROM service_integrator_themes WHERE service_integrator_id = ? AND is_default = 1 LIMIT 1',
      [siId]
    );

    if ((rows as any[]).length === 0) return null;

    const row = (rows as any[])[0];
    return {
      id: row.id,
      serviceIntegratorId: row.service_integrator_id,
      themeName: row.theme_name,
      displayName: row.display_name,
      description: row.description,
      themeConfig: typeof row.theme_config === 'string' ? JSON.parse(row.theme_config) : row.theme_config,
      primaryColor: row.primary_color,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      isActive: Boolean(row.is_active),
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Log theme usage (when assigned to customer)
   */
  async logThemeUsage(customerId: number, themeId: number, action: ThemeUsageLog['action']): Promise<void> {
    await this.pool.execute(
      'INSERT INTO theme_usage_logs (customer_id, theme_id, action, timestamp) VALUES (?, ?, ?, ?)',
      [customerId, themeId, action, Date.now()]
    );
  }

  /**
   * Get theme usage statistics
   */
  async getThemeUsageStats(themeId: number, days: number = 30): Promise<{
    totalAssignments: number;
    activeCustomers: number;
    recentActivity: Array<{ customerId: number; action: string; timestamp: number }>;
  }> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Total assignments
    const [assignRows] = await this.pool.execute(
      `SELECT COUNT(DISTINCT customer_id) as total FROM theme_usage_logs
       WHERE theme_id = ? AND action = 'assigned' AND timestamp > ?`,
      [themeId, since]
    );

    // Active customers (currently using this theme)
    const [activeRows] = await this.pool.execute(
      `SELECT COUNT(*) as active FROM customers WHERE custom_theme_id = ?`,
      [themeId]
    );

    // Recent activity
    const [activityRows] = await this.pool.execute(
      `SELECT customer_id, action, timestamp FROM theme_usage_logs
       WHERE theme_id = ? AND timestamp > ?
       ORDER BY timestamp DESC LIMIT 10`,
      [themeId, since]
    );

    return {
      totalAssignments: (assignRows as any[])[0].total || 0,
      activeCustomers: (activeRows as any[])[0].active || 0,
      recentActivity: (activityRows as any[]).map(row => ({
        customerId: row.customer_id,
        action: row.action,
        timestamp: row.timestamp
      }))
    };
  }

  // ============================================================================
  // CONNECTION TRACKING METHODS (v2.0.0 - Seat Management)
  // ============================================================================

  /**
   * Track new active connection or update existing one
   * Uses ON DUPLICATE KEY UPDATE for atomic upsert (race-condition safe)
   *
   * @param customerId Customer ID
   * @param userId Hashed machine ID (SHA-256)
   * @param role User role (developer, stakeholder, admin)
   * @param connectionId Unique SSE connection ID (UUID)
   * @param ipAddress Optional client IP address
   * @param userAgent Optional user agent string
   * @param jwtTokenHash Optional JWT token hash for correlation
   * @returns The active connection record
   */
  async trackConnection(
    customerId: number,
    userId: string,
    role: 'developer' | 'stakeholder' | 'admin',
    connectionId: string,
    ipAddress?: string,
    userAgent?: string,
    jwtTokenHash?: string
  ): Promise<ActiveConnection> {
    const now = Date.now();

    // Atomic upsert - if (customer_id, user_id, role) exists, update it; otherwise insert
    await this.pool.execute(
      `INSERT INTO active_connections (
        customer_id, user_id, role, connection_id, ip_address, user_agent,
        connected_at, last_seen, jwt_token_hash
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        connection_id = VALUES(connection_id),
        ip_address = VALUES(ip_address),
        user_agent = VALUES(user_agent),
        last_seen = VALUES(last_seen),
        jwt_token_hash = VALUES(jwt_token_hash)`,
      [
        customerId,
        userId,
        role,
        connectionId,
        ipAddress || null,
        userAgent || null,
        now,
        now,
        jwtTokenHash || null
      ]
    );

    // Fetch the final state after upsert
    const [rows] = await this.pool.execute(
      `SELECT * FROM active_connections
       WHERE customer_id = ? AND user_id = ? AND role = ?`,
      [customerId, userId, role]
    );

    return toCamelCase((rows as any[])[0]) as ActiveConnection;
  }

  /**
   * Update connection heartbeat (last_seen timestamp)
   * Called every 30 seconds by MCP clients to maintain connection status
   *
   * @param customerId Customer ID
   * @param userId Hashed machine ID
   * @param role User role
   * @returns True if connection exists and was updated
   */
  async updateConnectionHeartbeat(
    customerId: number,
    userId: string,
    role: 'developer' | 'stakeholder' | 'admin'
  ): Promise<boolean> {
    const now = Date.now();

    const [result] = await this.pool.execute(
      `UPDATE active_connections
       SET last_seen = ?
       WHERE customer_id = ? AND user_id = ? AND role = ?`,
      [now, customerId, userId, role]
    );

    return (result as any).affectedRows > 0;
  }

  /**
   * Remove active connection (graceful disconnect)
   *
   * @param customerId Customer ID
   * @param userId Hashed machine ID
   * @param role User role
   */
  async removeConnection(
    customerId: number,
    userId: string,
    role: 'developer' | 'stakeholder' | 'admin'
  ): Promise<void> {
    await this.pool.execute(
      `DELETE FROM active_connections
       WHERE customer_id = ? AND user_id = ? AND role = ?`,
      [customerId, userId, role]
    );
  }

  /**
   * Get active connection count for a customer by role
   *
   * @param customerId Customer ID
   * @param role User role (developer, stakeholder, admin)
   * @returns Number of active connections for this role
   */
  async getActiveConnectionCount(
    customerId: number,
    role: 'developer' | 'stakeholder' | 'admin'
  ): Promise<number> {
    const [rows] = await this.pool.execute(
      `SELECT COUNT(*) as count
       FROM active_connections
       WHERE customer_id = ? AND role = ?`,
      [customerId, role]
    );

    return ((rows as any[])[0]).count;
  }

  /**
   * Check for recent connection from same user (grace period logic)
   * Used to prevent rejecting legitimate reconnections after network blips
   *
   * @param customerId Customer ID
   * @param userId Hashed machine ID
   * @param gracePeriodMs Grace period in milliseconds (default: 5 minutes)
   * @returns Active connection if found within grace period, null otherwise
   */
  async getRecentConnection(
    customerId: number,
    userId: string,
    gracePeriodMs: number = 5 * 60 * 1000
  ): Promise<ActiveConnection | null> {
    const cutoff = Date.now() - gracePeriodMs;

    const [rows] = await this.pool.execute(
      `SELECT * FROM active_connections
       WHERE customer_id = ? AND user_id = ? AND last_seen > ?
       ORDER BY last_seen DESC
       LIMIT 1`,
      [customerId, userId, cutoff]
    );

    const rowsArray = rows as any[];
    if (rowsArray.length === 0) return null;

    return toCamelCase(rowsArray[0]) as ActiveConnection;
  }

  /**
   * Cleanup stale connections (no heartbeat for timeoutMs)
   * Should be called periodically by cleanup worker (every 60 seconds)
   *
   * @param timeoutMs Timeout threshold in milliseconds (default: 2 minutes)
   * @returns Number of connections removed
   */
  async cleanupStaleConnections(timeoutMs: number = 2 * 60 * 1000): Promise<number> {
    const cutoff = Date.now() - timeoutMs;

    const [result] = await this.pool.execute(
      `DELETE FROM active_connections WHERE last_seen < ?`,
      [cutoff]
    );

    return (result as any).affectedRows;
  }

  /**
   * Update active seat counts in customers table
   * Called after connection changes to keep customers.active_*_seats in sync
   *
   * @param customerId Customer ID
   * @param activeDeveloperSeats New active developer seat count
   * @param activeStakeholderSeats New active stakeholder seat count
   */
  async updateActiveSeats(
    customerId: number,
    activeDeveloperSeats: number,
    activeStakeholderSeats: number
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE customers
       SET active_developer_seats = ?,
           active_stakeholder_seats = ?,
           updated_at = ?
       WHERE id = ?`,
      [activeDeveloperSeats, activeStakeholderSeats, Date.now(), customerId]
    );
  }

  /**
   * Recalculate active seat counts from active_connections table
   * Used to ensure data consistency (e.g., after cleanup operations)
   *
   * @param customerId Customer ID
   */
  async recalculateActiveSeats(customerId: number): Promise<void> {
    const [rows] = await this.pool.execute(
      `SELECT
         SUM(CASE WHEN role = 'developer' THEN 1 ELSE 0 END) as dev_count,
         SUM(CASE WHEN role = 'stakeholder' THEN 1 ELSE 0 END) as stakeholder_count
       FROM active_connections
       WHERE customer_id = ?`,
      [customerId]
    );

    const result = (rows as any[])[0];
    const devCount = result.dev_count || 0;
    const stakeholderCount = result.stakeholder_count || 0;

    await this.updateActiveSeats(customerId, devCount, stakeholderCount);
  }

  /**
   * Log connection lifecycle event for audit trail and troubleshooting
   *
   * @param customerId Customer ID
   * @param userId Hashed machine ID
   * @param role User role
   * @param eventType Event type (connect, disconnect, heartbeat, timeout, rejected)
   * @param ipAddress Optional client IP address
   * @param errorMessage Optional error message (for rejected events)
   * @param seatLimit Optional seat limit at time of event
   * @param activeCount Optional active connection count at time of event
   */
  async logConnectionEvent(
    customerId: number,
    userId: string,
    role: 'developer' | 'stakeholder' | 'admin',
    eventType: 'connect' | 'disconnect' | 'heartbeat' | 'timeout' | 'rejected',
    ipAddress?: string,
    errorMessage?: string,
    seatLimit?: number,
    activeCount?: number
  ): Promise<void> {
    await this.pool.execute(
      `INSERT INTO connection_events (
        customer_id, user_id, role, event_type, timestamp,
        ip_address, error_message, seat_limit, active_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        userId,
        role,
        eventType,
        Date.now(),
        ipAddress || null,
        errorMessage || null,
        seatLimit || null,
        activeCount || null
      ]
    );
  }

  /**
   * Update customer seat limits when license changes
   * Parses license key and updates total seat counts
   *
   * @param customerId Customer ID
   * @param licenseKey New license key to parse
   * @returns Parsed license information
   */
  async updateCustomerSeatsFromLicense(customerId: number, licenseKey: string): Promise<ParsedLicense> {
    const parsed = parseLicenseKey(licenseKey);

    await this.pool.execute(
      `UPDATE customers
       SET developer_seats = ?,
           stakeholder_seats = ?,
           license_key = ?,
           updated_at = ?
       WHERE id = ?`,
      [
        parsed.developerSeats,
        parsed.stakeholderSeats,
        licenseKey,
        Date.now(),
        customerId
      ]
    );

    return parsed;
  }

  /**
   * Get connection events for customer (audit trail)
   *
   * @param customerId Customer ID
   * @param limit Maximum number of events to return
   * @param eventType Optional filter by event type
   * @returns Array of connection events
   */
  async getConnectionEvents(
    customerId: number,
    limit: number = 100,
    eventType?: 'connect' | 'disconnect' | 'heartbeat' | 'timeout' | 'rejected'
  ): Promise<ConnectionEvent[]> {
    const sql = eventType
      ? `SELECT * FROM connection_events
         WHERE customer_id = ? AND event_type = ?
         ORDER BY timestamp DESC LIMIT ?`
      : `SELECT * FROM connection_events
         WHERE customer_id = ?
         ORDER BY timestamp DESC LIMIT ?`;

    const params = eventType ? [customerId, eventType, limit] : [customerId, limit];
    const [rows] = await this.pool.execute(sql, params);

    return (rows as any[]).map(row => toCamelCase(row) as ConnectionEvent);
  }

  /**
   * Get connection statistics for customer
   *
   * @param customerId Customer ID
   * @param days Number of days to look back
   * @returns Connection statistics
   */
  async getConnectionStats(customerId: number, days: number = 30): Promise<{
    totalConnections: number;
    totalDisconnects: number;
    totalRejections: number;
    avgConnectionsPerDay: number;
    rejectionRate: number;
    byRole: Record<string, number>;
  }> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Overall stats
    const [overallRows] = await this.pool.execute(
      `SELECT
        SUM(CASE WHEN event_type = 'connect' THEN 1 ELSE 0 END) as total_connections,
        SUM(CASE WHEN event_type = 'disconnect' THEN 1 ELSE 0 END) as total_disconnects,
        SUM(CASE WHEN event_type = 'rejected' THEN 1 ELSE 0 END) as total_rejections,
        COUNT(*) as total_events
      FROM connection_events
      WHERE customer_id = ? AND timestamp > ?`,
      [customerId, since]
    );

    const overall = (overallRows as any[])[0];

    // By role
    const [roleRows] = await this.pool.execute(
      `SELECT role, COUNT(*) as count
      FROM connection_events
      WHERE customer_id = ? AND timestamp > ? AND event_type = 'connect'
      GROUP BY role`,
      [customerId, since]
    );

    const byRole: Record<string, number> = {};
    (roleRows as any[]).forEach(r => {
      byRole[r.role] = r.count;
    });

    const totalConnections = overall.total_connections || 0;
    const totalRejections = overall.total_rejections || 0;
    const rejectionRate = totalConnections > 0
      ? totalRejections / (totalConnections + totalRejections)
      : 0;

    return {
      totalConnections,
      totalDisconnects: overall.total_disconnects || 0,
      totalRejections,
      avgConnectionsPerDay: totalConnections / days,
      rejectionRate,
      byRole
    };
  }

  // =====================================================================
  // User Management (v2.0.0)
  // =====================================================================

  /**
   * Create or update user record (upsert)
   * Called during MCP authentication to track users
   *
   * @param user User data
   * @returns Created or updated user
   */
  async createOrUpdateUser(user: {
    customerId?: number;
    serviceIntegratorId?: number;
    userId: string;
    machineIdRaw?: string;
    username?: string;
    email?: string;
    role: 'developer' | 'stakeholder' | 'admin';
    ipAddress?: string;
    userAgent?: string;
  }): Promise<User> {
    const now = Date.now();

    await this.pool.execute(
      `INSERT INTO users (
        customer_id, service_integrator_id, user_id, machine_id_raw,
        username, email, role, status, is_active,
        created_at, updated_at, last_login_at, last_seen_ip, last_seen_user_agent
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active', TRUE, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        username = COALESCE(VALUES(username), username),
        email = COALESCE(VALUES(email), email),
        updated_at = VALUES(updated_at),
        last_login_at = VALUES(last_login_at),
        last_seen_ip = VALUES(last_seen_ip),
        last_seen_user_agent = VALUES(last_seen_user_agent)`,
      [
        user.customerId || null,
        user.serviceIntegratorId || null,
        user.userId,
        user.machineIdRaw || null,
        user.username || null,
        user.email || null,
        user.role,
        now,
        now,
        now,
        user.ipAddress || null,
        user.userAgent || null
      ]
    );

    // Fetch the created/updated user
    const [rows] = await this.pool.execute(
      `SELECT * FROM users WHERE user_id = ? AND (customer_id = ? OR service_integrator_id = ?)`,
      [user.userId, user.customerId || null, user.serviceIntegratorId || null]
    );

    const userData = (rows as any[])[0];
    return convertBooleans(toCamelCase(userData), ['isActive']) as User;
  }

  /**
   * Get user by internal ID
   *
   * @param id User ID
   * @returns User or null
   */
  async getUserById(id: number): Promise<User | null> {
    const [rows] = await this.pool.execute(
      `SELECT * FROM users WHERE id = ?`,
      [id]
    );

    const userData = (rows as any[])[0];
    if (!userData) return null;

    return convertBooleans(toCamelCase(userData), ['isActive']) as User;
  }

  /**
   * Get user by userId (hashed machine ID) and customer/SI
   *
   * @param userId Hashed machine ID
   * @param customerId Optional customer ID
   * @param serviceIntegratorId Optional SI ID
   * @returns User or null
   */
  async getUserByUserId(
    userId: string,
    customerId?: number,
    serviceIntegratorId?: number
  ): Promise<User | null> {
    var sql = 'SELECT * FROM users WHERE user_id = ?';
    var params: any[] = [userId];

    if (customerId) {
      sql += ' AND customer_id = ?';
      params.push(customerId);
    } else if (serviceIntegratorId) {
      sql += ' AND service_integrator_id = ?';
      params.push(serviceIntegratorId);
    }

    const [rows] = await this.pool.execute(sql, params);

    const userData = (rows as any[])[0];
    if (!userData) return null;

    return convertBooleans(toCamelCase(userData), ['isActive']) as User;
  }

  /**
   * List users for a customer or service integrator
   *
   * @param options Query options
   * @returns Array of users
   */
  async listUsers(options: {
    customerId?: number;
    serviceIntegratorId?: number;
    status?: 'active' | 'inactive' | 'suspended';
    role?: 'developer' | 'stakeholder' | 'admin';
    limit?: number;
    offset?: number;
  }): Promise<User[]> {
    var sql = 'SELECT * FROM users WHERE 1=1';
    var params: any[] = [];

    if (options.customerId) {
      sql += ' AND customer_id = ?';
      params.push(options.customerId);
    }

    if (options.serviceIntegratorId) {
      sql += ' AND service_integrator_id = ?';
      params.push(options.serviceIntegratorId);
    }

    if (options.status) {
      sql += ' AND status = ?';
      params.push(options.status);
    }

    if (options.role) {
      sql += ' AND role = ?';
      params.push(options.role);
    }

    sql += ' ORDER BY last_login_at DESC';

    if (options.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);

      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }

    const [rows] = await this.pool.execute(sql, params);

    return (rows as any[]).map(row =>
      convertBooleans(toCamelCase(row), ['isActive']) as User
    );
  }

  /**
   * Update user details
   *
   * @param id User ID
   * @param updates Fields to update
   * @returns Updated user
   */
  async updateUser(
    id: number,
    updates: {
      username?: string;
      email?: string;
      role?: 'developer' | 'stakeholder' | 'admin';
      machineIdRaw?: string;
    }
  ): Promise<User | null> {
    var setClauses: string[] = [];
    var params: any[] = [];

    if (updates.username !== undefined) {
      setClauses.push('username = ?');
      params.push(updates.username);
    }

    if (updates.email !== undefined) {
      setClauses.push('email = ?');
      params.push(updates.email);
    }

    if (updates.role !== undefined) {
      setClauses.push('role = ?');
      params.push(updates.role);
    }

    if (updates.machineIdRaw !== undefined) {
      setClauses.push('machine_id_raw = ?');
      params.push(updates.machineIdRaw);
    }

    if (setClauses.length === 0) {
      return this.getUserById(id);
    }

    setClauses.push('updated_at = ?');
    params.push(Date.now());

    params.push(id);

    await this.pool.execute(
      'UPDATE users SET ' + setClauses.join(', ') + ' WHERE id = ?',
      params
    );

    return this.getUserById(id);
  }

  /**
   * Set user status (activate/deactivate/suspend)
   *
   * @param id User ID
   * @param status New status
   * @param performedBy Who performed the action
   * @param notes Optional notes
   * @returns Updated user
   */
  async setUserStatus(
    id: number,
    status: 'active' | 'inactive' | 'suspended',
    performedBy?: string,
    notes?: string
  ): Promise<User | null> {
    var isActive = status === 'active';

    var oldUser = await this.getUserById(id);
    if (!oldUser) return null;

    await this.pool.execute(
      `UPDATE users SET status = ?, is_active = ?, updated_at = ? WHERE id = ?`,
      [status, isActive, Date.now(), id]
    );

    // Log activity
    await this.logUserActivity({
      userId: id,
      activityType: 'status_change',
      oldValue: oldUser.status,
      newValue: status,
      performedBy: performedBy || 'system',
      notes: notes
    });

    return this.getUserById(id);
  }

  /**
   * Delete user
   *
   * @param id User ID
   */
  async deleteUser(id: number): Promise<void> {
    await this.pool.execute(`DELETE FROM users WHERE id = ?`, [id]);
  }

  /**
   * Log user activity
   *
   * @param activity Activity data
   */
  async logUserActivity(activity: {
    userId: number;
    activityType: 'login' | 'logout' | 'status_change' | 'role_change' | 'created' | 'updated';
    ipAddress?: string;
    userAgent?: string;
    oldValue?: string;
    newValue?: string;
    performedBy?: string;
    notes?: string;
  }): Promise<void> {
    await this.pool.execute(
      `INSERT INTO user_activity_log (
        user_id, activity_type, activity_timestamp,
        ip_address, user_agent, old_value, new_value, performed_by, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        activity.userId,
        activity.activityType,
        Date.now(),
        activity.ipAddress || null,
        activity.userAgent || null,
        activity.oldValue || null,
        activity.newValue || null,
        activity.performedBy || null,
        activity.notes || null
      ]
    );
  }

  /**
   * Get user activity log
   *
   * @param userId User ID
   * @param limit Maximum number of entries
   * @param activityType Optional filter by type
   * @returns Array of activity log entries
   */
  async getUserActivity(
    userId: number,
    limit: number = 100,
    activityType?: 'login' | 'logout' | 'status_change' | 'role_change' | 'created' | 'updated'
  ): Promise<UserActivityLog[]> {
    var sql = activityType
      ? `SELECT * FROM user_activity_log
         WHERE user_id = ? AND activity_type = ?
         ORDER BY activity_timestamp DESC LIMIT ?`
      : `SELECT * FROM user_activity_log
         WHERE user_id = ?
         ORDER BY activity_timestamp DESC LIMIT ?`;

    var params = activityType ? [userId, activityType, limit] : [userId, limit];
    const [rows] = await this.pool.execute(sql, params);

    return (rows as any[]).map(row => toCamelCase(row) as UserActivityLog);
  }

  /**
   * Get users with connection details (enriched view)
   * Joins users with their current active connections
   *
   * @param customerId Customer ID
   * @returns Array of users with connection info
   */
  async getUsersWithConnections(customerId: number): Promise<Array<User & {
    isConnected: boolean;
    connectionId?: string;
    connectedAt?: number;
    lastSeen?: number;
  }>> {
    const [rows] = await this.pool.execute(
      `SELECT
        u.*,
        ac.connection_id,
        ac.connected_at,
        ac.last_seen
      FROM users u
      LEFT JOIN active_connections ac
        ON u.customer_id = ac.customer_id
        AND u.user_id = ac.user_id
        AND u.role = ac.role
      WHERE u.customer_id = ?
      ORDER BY u.last_login_at DESC`,
      [customerId]
    );

    return (rows as any[]).map(row => {
      var user = convertBooleans(toCamelCase(row), ['isActive']) as any;
      user.isConnected = Boolean(row.connection_id);
      return user;
    });
  }
}
