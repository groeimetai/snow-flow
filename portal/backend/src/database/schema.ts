/**
 * Database Schema for License Server
 *
 * Uses mysql2 with connection pooling for Cloud SQL (MySQL 8.4)
 * Supports both local Docker MySQL and Cloud SQL production
 */

import mysql from 'mysql2/promise';
import { Connector } from '@google-cloud/cloud-sql-connector';
import crypto from 'crypto';

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
  licenseKey: string; // SNOW-ENT-CUST-XXXX
  theme?: string; // Theme name (e.g., 'capgemini', 'ey', 'servicenow')
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
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to connect to MySQL: ${error instanceof Error ? error.message : String(error)}`);
    }
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
  // CREDENTIALS MANAGEMENT (AES-256-GCM Encryption)
  // ============================================================================

  /**
   * Get encryption key from environment variable
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
   * Encrypt credential data using AES-256-GCM
   * Returns format: iv:authTag:encryptedData (hex-encoded)
   */
  private encryptCredential(plaintext: string): string {
    const iv = crypto.randomBytes(16); // 128-bit IV
    const key = this.getEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Return iv:authTag:encrypted (all hex-encoded)
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt credential data
   * Expects format: iv:authTag:encryptedData (hex-encoded)
   */
  private decryptCredential(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format');
    }

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
    const encryptedAccessToken = data.accessToken ? this.encryptCredential(data.accessToken) : null;
    const encryptedRefreshToken = data.refreshToken ? this.encryptCredential(data.refreshToken) : null;
    const encryptedApiToken = data.apiToken ? this.encryptCredential(data.apiToken) : null;
    const encryptedPassword = data.password ? this.encryptCredential(data.password) : null;

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

    // Decrypt sensitive fields
    const credential: CustomerCredential = {
      id: row.id,
      customerId: row.customer_id,
      serviceType: row.service_type,
      credentialType: row.credential_type,
      baseUrl: row.base_url,
      accessToken: row.access_token ? this.decryptCredential(row.access_token) : undefined,
      refreshToken: row.refresh_token ? this.decryptCredential(row.refresh_token) : undefined,
      apiToken: row.api_token ? this.decryptCredential(row.api_token) : undefined,
      username: row.username || undefined,
      password: row.password ? this.decryptCredential(row.password) : undefined,
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

    const credentials: CustomerCredential[] = [];

    for (const row of rows as any[]) {
      credentials.push({
        id: row.id,
        customerId: row.customer_id,
        serviceType: row.service_type,
        credentialType: row.credential_type,
        baseUrl: row.base_url,
        accessToken: row.access_token ? this.decryptCredential(row.access_token) : undefined,
        refreshToken: row.refresh_token ? this.decryptCredential(row.refresh_token) : undefined,
        apiToken: row.api_token ? this.decryptCredential(row.api_token) : undefined,
        username: row.username || undefined,
        password: row.password ? this.decryptCredential(row.password) : undefined,
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
      });
    }

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
}
