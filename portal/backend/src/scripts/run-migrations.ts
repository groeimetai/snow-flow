#!/usr/bin/env tsx
/**
 * Run Database Migrations
 * Executes all SQL migration files in order
 */

import { LicenseDatabase } from '../database/schema.js';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigrations() {
  const db = new LicenseDatabase();

  try {
    console.log('🔌 Connecting to database...');
    await db.initialize();

    const migrationsDir = join(__dirname, '../../migrations');
    const migrationFiles = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Ensure order: 001, 002, 003...

    console.log(`📋 Found ${migrationFiles.length} migration(s)\n`);

    for (const file of migrationFiles) {
      console.log(`⏳ Running ${file}...`);
      const sql = readFileSync(join(migrationsDir, file), 'utf-8');

      // Split by semicolons and execute each statement
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

      for (const statement of statements) {
        try {
          await db.pool.execute(statement);
        } catch (error: any) {
          // Ignore "already exists" errors
          if (!error.message.includes('already exists') &&
              !error.message.includes('Duplicate column')) {
            throw error;
          } else {
            console.log(`   ℹ️  Skipped (already exists)`);
          }
        }
      }

      console.log(`   ✅ Completed ${file}`);
    }

    console.log('\n🎉 All migrations completed successfully!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
