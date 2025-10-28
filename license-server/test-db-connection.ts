/**
 * Simple database connection test
 */

import dotenv from 'dotenv';
import { LicenseDatabase } from './src/database/schema.js';

// Load environment variables
dotenv.config();

async function testConnection() {
  console.log('🔍 Testing database connection...\n');
  console.log('Environment variables:');
  console.log(`  DB_HOST: ${process.env.DB_HOST}`);
  console.log(`  DB_PORT: ${process.env.DB_PORT}`);
  console.log(`  DB_USER: ${process.env.DB_USER}`);
  console.log(`  DB_NAME: ${process.env.DB_NAME}`);
  console.log(`  DB_PASSWORD: ${process.env.DB_PASSWORD ? '[SET]' : '[NOT SET]'}`);
  console.log('');

  const db = new LicenseDatabase();

  try {
    await db.initialize();
    console.log('✅ Database connection successful!');

    // Try to query tables
    // @ts-ignore - Access private pool
    const [tables] = await db['pool'].execute(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [process.env.DB_NAME || 'licenses']);

    console.log('\n📋 Tables in database:');
    (tables as any[]).forEach(table => {
      console.log(`   - ${table.TABLE_NAME}`);
    });

    await db.close();
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error);
    await db.close();
    process.exit(1);
  }
}

testConnection();
