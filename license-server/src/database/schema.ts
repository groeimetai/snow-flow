/**
 * Database Schema for License Server
 *
 * Uses better-sqlite3 for fast, reliable license validation.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export class LicenseDatabase {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const defaultPath = path.join(__dirname, '../../data/licenses.db');
    this.db = new Database(dbPath || defaultPath);
    this.initialize();
  }

  /**
   * Initialize database schema
   */
  private initialize(): void {
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');

    // Create service_integrators table (Master accounts)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS service_integrators (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        billing_email TEXT NOT NULL,
        master_license_key TEXT UNIQUE NOT NULL,
        white_label_enabled INTEGER DEFAULT 0,
        custom_domain TEXT,
        logo_url TEXT,
        created_at INTEGER NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'churned'))
      );

      CREATE INDEX IF NOT EXISTS idx_si_master_key ON service_integrators(master_license_key);
      CREATE INDEX IF NOT EXISTS idx_si_status ON service_integrators(status);
    `);

    // Create customers table (End customers of service integrators)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        service_integrator_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        company TEXT,
        license_key TEXT UNIQUE NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended', 'churned')),
        total_api_calls INTEGER DEFAULT 0,
        last_api_call INTEGER,
        FOREIGN KEY (service_integrator_id) REFERENCES service_integrators(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_customers_license_key ON customers(license_key);
      CREATE INDEX IF NOT EXISTS idx_customers_si ON customers(service_integrator_id);
      CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
    `);

    // Create customer_instances table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS customer_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        instance_name TEXT,
        hostname TEXT,
        ip_address TEXT,
        last_seen INTEGER NOT NULL,
        version TEXT NOT NULL,
        validation_count INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        UNIQUE(customer_id, instance_id)
      );

      CREATE INDEX IF NOT EXISTS idx_ci_customer ON customer_instances(customer_id);
      CREATE INDEX IF NOT EXISTS idx_ci_instance ON customer_instances(instance_id);
    `);

    // Create mcp_usage table (track all MCP tool calls)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS mcp_usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        instance_id INTEGER NOT NULL,
        tool_name TEXT NOT NULL,
        tool_category TEXT NOT NULL CHECK(tool_category IN ('jira', 'azdo', 'confluence', 'ml', 'sso')),
        timestamp INTEGER NOT NULL,
        duration_ms INTEGER,
        success INTEGER NOT NULL,
        error_message TEXT,
        request_params TEXT,
        ip_address TEXT,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
        FOREIGN KEY (instance_id) REFERENCES customer_instances(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_mcp_usage_customer ON mcp_usage(customer_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_usage_timestamp ON mcp_usage(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mcp_usage_tool ON mcp_usage(tool_name);
      CREATE INDEX IF NOT EXISTS idx_mcp_usage_category ON mcp_usage(tool_category);
    `);

    // Create api_logs table (track all API requests)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        status_code INTEGER NOT NULL,
        duration_ms INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        license_key TEXT,
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_api_logs_timestamp ON api_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
    `);

    // Create licenses table (legacy support - will migrate to customers)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        tier TEXT NOT NULL CHECK(tier IN ('Team', 'Professional', 'Enterprise')),
        status TEXT NOT NULL CHECK(status IN ('active', 'expired', 'suspended', 'invalid')),
        company_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        customer_id INTEGER,
        max_instances INTEGER NOT NULL DEFAULT 1,
        features TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        total_api_calls INTEGER DEFAULT 0,
        last_api_call INTEGER,
        FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
      CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
      CREATE INDEX IF NOT EXISTS idx_licenses_customer ON licenses(customer_id);
    `);

    // Create license_instances table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS license_instances (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_id INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        version TEXT NOT NULL,
        last_seen INTEGER NOT NULL,
        ip_address TEXT,
        hostname TEXT,
        validation_count INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE,
        UNIQUE(license_id, instance_id)
      );

      CREATE INDEX IF NOT EXISTS idx_instances_license ON license_instances(license_id);
      CREATE INDEX IF NOT EXISTS idx_instances_instance_id ON license_instances(instance_id);
    `);

    // Create validation_logs table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS validation_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        license_id INTEGER NOT NULL,
        instance_id TEXT NOT NULL,
        version TEXT NOT NULL,
        success INTEGER NOT NULL,
        error_code TEXT,
        ip_address TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (license_id) REFERENCES licenses(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_logs_license ON validation_logs(license_id);
      CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON validation_logs(timestamp);
    `);
  }

  /**
   * Get license by key
   */
  getLicense(key: string): License | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM licenses WHERE key = ?
    `);
    return stmt.get(key) as License | undefined;
  }

  /**
   * Create new license
   */
  createLicense(license: Omit<License, 'id' | 'createdAt' | 'updatedAt'>): License {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO licenses (
        key, tier, status, company_name, contact_email,
        max_instances, features, expires_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
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
    );

    return {
      id: info.lastInsertRowid as number,
      ...license,
      createdAt: now,
      updatedAt: now
    };
  }

  /**
   * Update license
   */
  updateLicense(key: string, updates: Partial<License>): void {
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

    const stmt = this.db.prepare(`
      UPDATE licenses SET ${fields.join(', ')} WHERE key = ?
    `);
    stmt.run(...values);
  }

  /**
   * Get or create license instance (race-condition safe with UPSERT)
   */
  upsertInstance(
    licenseId: number,
    instanceId: string,
    version: string,
    ipAddress?: string,
    hostname?: string
  ): LicenseInstance {
    const now = Date.now();

    // Use INSERT ... ON CONFLICT to handle race conditions atomically
    const upsertStmt = this.db.prepare(`
      INSERT INTO license_instances (
        license_id, instance_id, version, last_seen, ip_address, hostname, validation_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(license_id, instance_id)
      DO UPDATE SET
        last_seen = excluded.last_seen,
        version = excluded.version,
        ip_address = excluded.ip_address,
        hostname = excluded.hostname,
        validation_count = validation_count + 1
    `);

    upsertStmt.run(licenseId, instanceId, version, now, ipAddress, hostname, now);

    // Fetch the final state after upsert
    const selectStmt = this.db.prepare(`
      SELECT * FROM license_instances WHERE license_id = ? AND instance_id = ?
    `);

    return selectStmt.get(licenseId, instanceId) as LicenseInstance;
  }

  /**
   * Get instance count for license
   */
  getInstanceCount(licenseId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM license_instances WHERE license_id = ?
    `);
    const result = stmt.get(licenseId) as { count: number };
    return result.count;
  }

  /**
   * Log validation attempt
   */
  logValidation(
    licenseId: number,
    instanceId: string,
    version: string,
    success: boolean,
    errorCode?: string,
    ipAddress?: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO validation_logs (
        license_id, instance_id, version, success, error_code, ip_address, timestamp
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(licenseId, instanceId, version, success ? 1 : 0, errorCode, ipAddress, Date.now());
  }

  /**
   * Get validation statistics
   */
  getValidationStats(licenseId: number, days: number = 30): {
    total: number;
    successful: number;
    failed: number;
  } {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
      FROM validation_logs
      WHERE license_id = ? AND timestamp > ?
    `);

    return stmt.get(licenseId, since) as { total: number; successful: number; failed: number };
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
  }

  // ===== SERVICE INTEGRATOR METHODS =====

  /**
   * Create service integrator (master account)
   */
  createServiceIntegrator(si: Omit<ServiceIntegrator, 'id' | 'createdAt'>): ServiceIntegrator {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO service_integrators (
        company_name, contact_email, billing_email, master_license_key,
        white_label_enabled, custom_domain, logo_url, created_at, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      si.companyName,
      si.contactEmail,
      si.billingEmail,
      si.masterLicenseKey,
      si.whiteLabelEnabled ? 1 : 0,
      si.customDomain || null,
      si.logoUrl || null,
      now,
      si.status
    );

    return {
      id: info.lastInsertRowid as number,
      ...si,
      createdAt: now
    };
  }

  /**
   * Get service integrator by master key
   */
  getServiceIntegrator(masterLicenseKey: string): ServiceIntegrator | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM service_integrators WHERE master_license_key = ?
    `);
    return stmt.get(masterLicenseKey) as ServiceIntegrator | undefined;
  }

  /**
   * List all service integrators
   */
  listServiceIntegrators(status?: 'active' | 'suspended' | 'churned'): ServiceIntegrator[] {
    const sql = status
      ? `SELECT * FROM service_integrators WHERE status = ? ORDER BY created_at DESC`
      : `SELECT * FROM service_integrators ORDER BY created_at DESC`;

    const stmt = this.db.prepare(sql);
    return (status ? stmt.all(status) : stmt.all()) as ServiceIntegrator[];
  }

  // ===== CUSTOMER METHODS =====

  /**
   * Create customer
   */
  createCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'totalApiCalls'>): Customer {
    const now = Date.now();
    const stmt = this.db.prepare(`
      INSERT INTO customers (
        service_integrator_id, name, contact_email, company, license_key,
        created_at, updated_at, status, total_api_calls, last_api_call
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)
    `);

    const info = stmt.run(
      customer.serviceIntegratorId,
      customer.name,
      customer.contactEmail,
      customer.company || null,
      customer.licenseKey,
      now,
      now,
      customer.status
    );

    return {
      id: info.lastInsertRowid as number,
      ...customer,
      createdAt: now,
      updatedAt: now,
      totalApiCalls: 0
    };
  }

  /**
   * Get customer by license key
   */
  getCustomer(licenseKey: string): Customer | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM customers WHERE license_key = ?
    `);
    return stmt.get(licenseKey) as Customer | undefined;
  }

  /**
   * Get customer by ID
   */
  getCustomerById(customerId: number): Customer | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM customers WHERE id = ?
    `);
    return stmt.get(customerId) as Customer | undefined;
  }

  /**
   * List customers for a service integrator
   */
  listCustomers(serviceIntegratorId: number, status?: 'active' | 'suspended' | 'churned'): Customer[] {
    const sql = status
      ? `SELECT * FROM customers WHERE service_integrator_id = ? AND status = ? ORDER BY created_at DESC`
      : `SELECT * FROM customers WHERE service_integrator_id = ? ORDER BY created_at DESC`;

    const stmt = this.db.prepare(sql);
    return (status ? stmt.all(serviceIntegratorId, status) : stmt.all(serviceIntegratorId)) as Customer[];
  }

  /**
   * Update customer
   */
  updateCustomer(customerId: number, updates: Partial<Customer>): void {
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
    if (updates.status) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    fields.push('updated_at = ?');
    values.push(now);
    values.push(customerId);

    const stmt = this.db.prepare(`
      UPDATE customers SET ${fields.join(', ')} WHERE id = ?
    `);
    stmt.run(...values);
  }

  /**
   * Increment customer API call counter
   */
  incrementCustomerApiCalls(customerId: number): void {
    const stmt = this.db.prepare(`
      UPDATE customers
      SET total_api_calls = total_api_calls + 1,
          last_api_call = ?
      WHERE id = ?
    `);
    stmt.run(Date.now(), customerId);
  }

  // ===== CUSTOMER INSTANCE METHODS =====

  /**
   * Upsert customer instance
   */
  upsertCustomerInstance(
    customerId: number,
    instanceId: string,
    version: string,
    ipAddress?: string,
    hostname?: string,
    instanceName?: string
  ): CustomerInstance {
    const now = Date.now();

    const upsertStmt = this.db.prepare(`
      INSERT INTO customer_instances (
        customer_id, instance_id, instance_name, hostname, ip_address,
        last_seen, version, validation_count, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      ON CONFLICT(customer_id, instance_id)
      DO UPDATE SET
        last_seen = excluded.last_seen,
        version = excluded.version,
        ip_address = excluded.ip_address,
        hostname = excluded.hostname,
        instance_name = COALESCE(excluded.instance_name, instance_name),
        validation_count = validation_count + 1
    `);

    upsertStmt.run(customerId, instanceId, instanceName, hostname, ipAddress, now, version, now);

    const selectStmt = this.db.prepare(`
      SELECT * FROM customer_instances WHERE customer_id = ? AND instance_id = ?
    `);

    return selectStmt.get(customerId, instanceId) as CustomerInstance;
  }

  /**
   * Get customer instance count
   */
  getCustomerInstanceCount(customerId: number): number {
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM customer_instances WHERE customer_id = ?
    `);
    const result = stmt.get(customerId) as { count: number };
    return result.count;
  }

  /**
   * List customer instances
   */
  listCustomerInstances(customerId: number): CustomerInstance[] {
    const stmt = this.db.prepare(`
      SELECT * FROM customer_instances WHERE customer_id = ? ORDER BY last_seen DESC
    `);
    return stmt.all(customerId) as CustomerInstance[];
  }

  // ===== MCP USAGE TRACKING =====

  /**
   * Log MCP tool usage
   */
  logMcpUsage(usage: Omit<McpUsage, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO mcp_usage (
        customer_id, instance_id, tool_name, tool_category, timestamp,
        duration_ms, success, error_message, request_params, ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      usage.customerId,
      usage.instanceId,
      usage.toolName,
      usage.toolCategory,
      usage.timestamp,
      usage.durationMs,
      usage.success ? 1 : 0,
      usage.errorMessage || null,
      usage.requestParams || null,
      usage.ipAddress || null
    );
  }

  /**
   * Get MCP usage statistics for customer
   */
  getMcpUsageStats(customerId: number, days: number = 30): {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    avgDurationMs: number;
    byCategory: Record<string, number>;
    topTools: Array<{ toolName: string; count: number }>;
  } {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Overall stats
    const overallStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_calls,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_calls,
        AVG(duration_ms) as avg_duration_ms
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?
    `);

    const overall = overallStmt.get(customerId, since) as any;

    // By category
    const categoryStmt = this.db.prepare(`
      SELECT tool_category, COUNT(*) as count
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?
      GROUP BY tool_category
    `);

    const categories = categoryStmt.all(customerId, since) as Array<{ tool_category: string; count: number }>;
    const byCategory: Record<string, number> = {};
    categories.forEach(c => {
      byCategory[c.tool_category] = c.count;
    });

    // Top tools
    const topToolsStmt = this.db.prepare(`
      SELECT tool_name, COUNT(*) as count
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 10
    `);

    const topTools = topToolsStmt.all(customerId, since) as Array<{ toolName: string; count: number }>;

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
  getMcpUsageTimeseries(customerId: number, days: number = 30, granularity: 'hour' | 'day' = 'day'): Array<{
    timestamp: number;
    count: number;
  }> {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;
    const intervalMs = granularity === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;

    const stmt = this.db.prepare(`
      SELECT
        (timestamp / ?) * ? as bucket,
        COUNT(*) as count
      FROM mcp_usage
      WHERE customer_id = ? AND timestamp > ?
      GROUP BY bucket
      ORDER BY bucket ASC
    `);

    const results = stmt.all(intervalMs, intervalMs, customerId, since) as Array<{ bucket: number; count: number }>;

    return results.map(r => ({
      timestamp: r.bucket,
      count: r.count
    }));
  }

  // ===== API LOGGING =====

  /**
   * Log API request
   */
  logApiRequest(log: Omit<ApiLog, 'id'>): void {
    const stmt = this.db.prepare(`
      INSERT INTO api_logs (
        endpoint, method, status_code, duration_ms, timestamp,
        ip_address, user_agent, license_key, error_message
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      log.endpoint,
      log.method,
      log.statusCode,
      log.durationMs,
      log.timestamp,
      log.ipAddress || null,
      log.userAgent || null,
      log.licenseKey || null,
      log.errorMessage || null
    );
  }

  /**
   * Get API statistics
   */
  getApiStats(days: number = 30): {
    totalRequests: number;
    avgDurationMs: number;
    errorRate: number;
    topEndpoints: Array<{ endpoint: string; count: number }>;
  } {
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const overallStmt = this.db.prepare(`
      SELECT
        COUNT(*) as total_requests,
        AVG(duration_ms) as avg_duration_ms,
        CAST(SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) AS REAL) / COUNT(*) as error_rate
      FROM api_logs
      WHERE timestamp > ?
    `);

    const overall = overallStmt.get(since) as any;

    const topEndpointsStmt = this.db.prepare(`
      SELECT endpoint, COUNT(*) as count
      FROM api_logs
      WHERE timestamp > ?
      GROUP BY endpoint
      ORDER BY count DESC
      LIMIT 10
    `);

    const topEndpoints = topEndpointsStmt.all(since) as Array<{ endpoint: string; count: number }>;

    return {
      totalRequests: overall.total_requests || 0,
      avgDurationMs: overall.avg_duration_ms || 0,
      errorRate: overall.error_rate || 0,
      topEndpoints
    };
  }
}
