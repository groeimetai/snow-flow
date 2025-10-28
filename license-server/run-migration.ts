/**
 * Database Migration Runner
 *
 * Executes SQL migration files against the MySQL database
 */

import { LicenseDatabase } from './src/database/schema.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration(migrationFile: string) {
  console.log(`🔄 Running migration: ${migrationFile}`);

  const db = new LicenseDatabase();

  try {
    // Initialize database connection
    await db.initialize();
    console.log('✅ Database connection established');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);
    const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

    console.log(`📄 Migration file loaded: ${migrationPath}`);

    // Split SQL statements (MySQL doesn't support multi-statement by default via mysql2)
    // We need to execute each statement separately
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*') && s !== 'USE licenses');

    console.log(`📊 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (statement.startsWith('SELECT') && statement.includes('Migration')) {
        console.log(`ℹ️  ${statement.replace('SELECT ', '').replace(/['"]/g, '')}`);
        continue;
      }

      console.log(`⚙️  Executing statement ${i + 1}/${statements.length}...`);

      try {
        // @ts-ignore - Access private pool for migration
        await db['pool'].execute(statement);
        console.log(`   ✅ Statement ${i + 1} completed\n`);
      } catch (error: any) {
        // Check if error is about table already existing
        if (error.code === 'ER_TABLE_EXISTS_ERR' || error.message?.includes('already exists')) {
          console.log(`   ⚠️  Table already exists, skipping...\n`);
        } else {
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying table structure...');

    // @ts-ignore - Access private pool for verification
    const [tables] = await db['pool'].execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN ('service_integrator_credentials', 'service_integrator_credentials_audit')
    `, [process.env.DB_NAME || 'licenses']);

    console.log('\n📋 Tables found:');
    (tables as any[]).forEach(table => {
      console.log(`   ✅ ${table.TABLE_NAME}`);
    });

    // Show table structure
    console.log('\n📐 Table structure for service_integrator_credentials:');

    // @ts-ignore
    const [columns] = await db['pool'].execute(`
      DESCRIBE service_integrator_credentials
    `);

    console.table(columns);

    await db.close();
    console.log('\n✅ Database connection closed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    await db.close();
    process.exit(1);
  }
}

// Get migration file from command line or use default
const migrationFile = process.argv[2] || '002_add_service_integrator_credentials.sql';

runMigration(migrationFile)
  .then(() => {
    console.log('\n🎉 Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration error:', error);
    process.exit(1);
  });
