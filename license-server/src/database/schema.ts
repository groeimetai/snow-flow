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

export interface License {
  id: number;
  key: string;
  tier: 'Team' | 'Professional' | 'Enterprise';
  status: 'active' | 'expired' | 'suspended' | 'invalid';
  companyName: string;
  contactEmail: string;
  maxInstances: number;
  features: string; // JSON array of feature names
  expiresAt: number; // Unix timestamp
  createdAt: number;
  updatedAt: number;
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

    // Create licenses table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS licenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        tier TEXT NOT NULL CHECK(tier IN ('Team', 'Professional', 'Enterprise')),
        status TEXT NOT NULL CHECK(status IN ('active', 'expired', 'suspended', 'invalid')),
        company_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        max_instances INTEGER NOT NULL DEFAULT 1,
        features TEXT NOT NULL,
        expires_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
      CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
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
}
