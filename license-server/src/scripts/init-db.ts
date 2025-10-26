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

  // Initialize database (MySQL - no path needed)
  const db = new LicenseDatabase();
  await db.initialize();

  console.log('✓ Database initialized (MySQL)');
  console.log('✓ Tables created: service_integrators, customers, customer_instances, etc.');

  await db.close();
  console.log('✓ Database initialization complete');
}

initDatabase().catch(error => {
  console.error('Database initialization failed:', error);
  process.exit(1);
});
