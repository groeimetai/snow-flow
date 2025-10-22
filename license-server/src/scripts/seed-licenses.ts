/**
 * Seed Test Licenses Script
 *
 * Creates test licenses for development and testing.
 */

import { LicenseDatabase } from '../database/schema.js';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function seedLicenses() {
  console.log('Seeding test licenses...');

  const dbPath = path.join(__dirname, '../../../data/licenses.db');
  const db = new LicenseDatabase(dbPath);

  // Create test licenses for each tier
  const licenses = [
    {
      key: `SNOW-TEAM-${uuidv4().split('-')[0].toUpperCase()}`,
      tier: 'Team' as const,
      status: 'active' as const,
      companyName: 'Test Company (Team)',
      contactEmail: 'team@test.com',
      maxInstances: 3,
      features: JSON.stringify(['jira']),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    },
    {
      key: `SNOW-PRO-${uuidv4().split('-')[0].toUpperCase()}`,
      tier: 'Professional' as const,
      status: 'active' as const,
      companyName: 'Test Company (Professional)',
      contactEmail: 'pro@test.com',
      maxInstances: 10,
      features: JSON.stringify(['jira', 'advanced-ml', 'priority-support']),
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    },
    {
      key: `SNOW-ENT-${uuidv4().split('-')[0].toUpperCase()}`,
      tier: 'Enterprise' as const,
      status: 'active' as const,
      companyName: 'Test Company (Enterprise)',
      contactEmail: 'enterprise@test.com',
      maxInstances: 999,
      features: JSON.stringify(['*']), // All features
      expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000 // 1 year
    },
    {
      key: `SNOW-EXPIRED-${uuidv4().split('-')[0].toUpperCase()}`,
      tier: 'Team' as const,
      status: 'active' as const,
      companyName: 'Test Company (Expired)',
      contactEmail: 'expired@test.com',
      maxInstances: 1,
      features: JSON.stringify(['jira']),
      expiresAt: Date.now() - 30 * 24 * 60 * 60 * 1000 // Expired 30 days ago
    }
  ];

  console.log('\nCreating test licenses:');
  console.log('------------------------');

  for (const license of licenses) {
    try {
      const created = db.createLicense(license);
      console.log(`✓ ${created.tier} License: ${created.key}`);
      console.log(`  Company: ${created.companyName}`);
      console.log(`  Email: ${created.contactEmail}`);
      console.log(`  Max Instances: ${created.maxInstances}`);
      console.log(`  Features: ${license.features}`);
      console.log(`  Expires: ${new Date(license.expiresAt).toISOString()}`);
      console.log('');
    } catch (error) {
      console.error(`✗ Failed to create ${license.tier} license:`, error);
    }
  }

  db.close();
  console.log('✓ License seeding complete');
}

seedLicenses().catch(error => {
  console.error('License seeding failed:', error);
  process.exit(1);
});
