/**
 * Database Migration Runner
 *
 * Automatically runs SQL migrations on backend startup
 * Tracks executed migrations in migrations_history table
 * Safe for Cloud Run deployments (idempotent)
 */

import { LicenseDatabase } from '../database/schema.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import winston from 'winston';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

interface Migration {
  filename: string;
  sql: string;
}

export class MigrationRunner {
  private db: LicenseDatabase;
  private migrationsDir: string;

  constructor(db: LicenseDatabase) {
    this.db = db;
    // Migrations directory is relative to this file
    this.migrationsDir = path.join(__dirname, '../../migrations');
  }

  /**
   * Initialize migrations_history table
   */
  private async initMigrationsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS migrations_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at BIGINT NOT NULL,
        execution_time_ms INT NOT NULL,
        INDEX idx_filename (filename)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      COMMENT='Tracks executed database migrations';
    `;

    await this.db.pool.execute(sql);
    logger.info('✅ Migrations history table ready');
  }

  /**
   * Get list of already executed migrations
   */
  private async getExecutedMigrations(): Promise<Set<string>> {
    const [rows] = await this.db.pool.execute(
      'SELECT filename FROM migrations_history'
    );

    const executed = new Set<string>();
    for (const row of rows as any[]) {
      executed.add(row.filename);
    }

    return executed;
  }

  /**
   * Get pending migrations (sorted by filename)
   */
  private async getPendingMigrations(): Promise<Migration[]> {
    // Read all .sql files from migrations directory
    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Sort alphabetically (001_, 002_, etc.)

    const executed = await this.getExecutedMigrations();
    const pending: Migration[] = [];

    for (const filename of files) {
      if (!executed.has(filename)) {
        const filepath = path.join(this.migrationsDir, filename);
        const sql = fs.readFileSync(filepath, 'utf-8');
        pending.push({ filename, sql });
      }
    }

    return pending;
  }

  /**
   * Execute a single migration
   */
  private async executeMigration(migration: Migration): Promise<void> {
    const startTime = Date.now();

    logger.info(`🔄 Running migration: ${migration.filename}`);

    try {
      // Split SQL into individual statements (separated by semicolon)
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      // Execute each statement
      for (const statement of statements) {
        if (statement.toLowerCase().startsWith('select')) {
          // SELECT statements for verification - just log results
          const [rows] = await this.db.pool.execute(statement);
          if ((rows as any[]).length > 0) {
            logger.info(`  ℹ️  ${JSON.stringify((rows as any[])[0])}`);
          }
        } else {
          await this.db.pool.execute(statement);
        }
      }

      const executionTime = Date.now() - startTime;

      // Record successful migration
      await this.db.pool.execute(
        'INSERT INTO migrations_history (filename, executed_at, execution_time_ms) VALUES (?, ?, ?)',
        [migration.filename, Date.now(), executionTime]
      );

      logger.info(`✅ Migration completed: ${migration.filename} (${executionTime}ms)`);
    } catch (error) {
      logger.error(`❌ Migration failed: ${migration.filename}`, error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    try {
      logger.info('🔍 Checking for pending migrations...');

      // Initialize migrations table
      await this.initMigrationsTable();

      // Get pending migrations
      const pending = await this.getPendingMigrations();

      if (pending.length === 0) {
        logger.info('✅ No pending migrations - database is up to date');
        return;
      }

      logger.info(`📋 Found ${pending.length} pending migration(s)`);

      // Execute each migration in order
      for (const migration of pending) {
        await this.executeMigration(migration);
      }

      logger.info(`✅ All ${pending.length} migration(s) completed successfully`);
    } catch (error) {
      logger.error('❌ Migration runner failed:', error);
      throw error;
    }
  }

  /**
   * Get migration status (for health checks)
   */
  async getMigrationStatus(): Promise<{
    total: number;
    executed: number;
    pending: number;
    lastMigration?: { filename: string; executedAt: number };
  }> {
    await this.initMigrationsTable();

    const files = fs.readdirSync(this.migrationsDir)
      .filter(f => f.endsWith('.sql'));

    const executed = await this.getExecutedMigrations();
    const pending = await this.getPendingMigrations();

    // Get last executed migration
    const [rows] = await this.db.pool.execute(
      'SELECT filename, executed_at FROM migrations_history ORDER BY executed_at DESC LIMIT 1'
    );

    const lastMigration = (rows as any[]).length > 0
      ? { filename: (rows as any[])[0].filename, executedAt: (rows as any[])[0].executed_at }
      : undefined;

    return {
      total: files.length,
      executed: executed.size,
      pending: pending.length,
      lastMigration
    };
  }
}
