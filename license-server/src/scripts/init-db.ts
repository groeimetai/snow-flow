/**
 * Database Initialization Script
 *
 * Creates the database schema and initial tables.
 */

import { LicenseDatabase } from '../database/schema.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initDatabase() {
  console.log('Initializing license database...');

  // Ensure data directory exists
  const dataDir = path.join(__dirname, '../../../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log('✓ Created data directory');
  }

  // Initialize database
  const dbPath = path.join(dataDir, 'licenses.db');
  const db = new LicenseDatabase(dbPath);

  console.log('✓ Database initialized at:', dbPath);
  console.log('✓ Tables created: licenses, license_instances, validation_logs');

  db.close();
  console.log('✓ Database initialization complete');
}

initDatabase().catch(error => {
  console.error('Database initialization failed:', error);
  process.exit(1);
});
