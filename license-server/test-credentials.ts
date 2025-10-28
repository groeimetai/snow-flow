/**
 * Comprehensive Test Suite for Service Integrator Credentials
 *
 * Tests:
 * 1. Database connection
 * 2. Migration execution
 * 3. Encryption/Decryption
 * 4. CRUD operations
 * 5. Audit logging
 * 6. OAuth2 token expiration tracking
 */

import { LicenseDatabase, encryptCredential, decryptCredential } from './src/database/schema.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test data
const TEST_SERVICE_INTEGRATOR = {
  companyName: 'Test Company Ltd',
  contactEmail: 'test@example.com',
  billingEmail: 'billing@example.com',
  masterLicenseKey: 'TEST-SI-12345',
  whiteLabelEnabled: false,
  status: 'active' as const
};

const TEST_JIRA_CREDENTIAL = {
  serviceType: 'jira' as const,
  credentialType: 'api_token' as const,
  baseUrl: 'https://test-company.atlassian.net',
  email: 'admin@test-company.com',
  apiToken: 'test-api-token-secret-12345',
  enabled: true
};

const TEST_OAUTH_CREDENTIAL = {
  serviceType: 'azure-devops' as const,
  credentialType: 'oauth2' as const,
  baseUrl: 'https://dev.azure.com/test-organization',
  accessToken: 'test-access-token-secret-67890',
  refreshToken: 'test-refresh-token-secret-abcde',
  tokenType: 'Bearer',
  expiresAt: Date.now() + (60 * 60 * 1000), // Expires in 1 hour
  scope: 'vso.work vso.code',
  clientId: 'test-client-id-12345',
  enabled: true
};

let testResults = {
  passed: 0,
  failed: 0,
  tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL'; error?: string }>
};

function logTest(name: string, passed: boolean, error?: any) {
  const status = passed ? 'PASS' : 'FAIL';
  const emoji = passed ? '✅' : '❌';

  console.log(`${emoji} ${name}: ${status}`);

  if (!passed && error) {
    console.error(`   Error: ${error instanceof Error ? error.message : String(error)}`);
  }

  testResults.tests.push({
    name,
    status,
    error: error ? (error instanceof Error ? error.message : String(error)) : undefined
  });

  if (passed) {
    testResults.passed++;
  } else {
    testResults.failed++;
  }
}

async function runTests() {
  console.log('\n🧪 Service Integrator Credentials Test Suite\n');
  console.log('='.repeat(60));

  const db = new LicenseDatabase();
  let serviceIntegratorId: number | undefined;
  let credentialId: number | undefined;
  let oauthCredentialId: number | undefined;

  try {
    // ===== TEST 1: Database Connection =====
    console.log('\n📡 TEST 1: Database Connection');
    try {
      await db.initialize();
      logTest('Database connection', true);
    } catch (error) {
      logTest('Database connection', false, error);
      console.error('\n❌ Cannot proceed without database connection');
      process.exit(1);
    }

    // ===== TEST 2: Run Migration =====
    console.log('\n🔄 TEST 2: Run Migration');
    try {
      const migrationPath = path.join(__dirname, 'migrations', '002_add_service_integrator_credentials.sql');
      const migrationSQL = await fs.readFile(migrationPath, 'utf-8');

      const statements = migrationSQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*') && s !== 'USE licenses' && !s.startsWith('SELECT'));

      for (const statement of statements) {
        try {
          // @ts-ignore - Access private pool
          await db['pool'].execute(statement);
        } catch (error: any) {
          // Ignore "table already exists" errors
          if (!error.message?.includes('already exists') && error.code !== 'ER_TABLE_EXISTS_ERR') {
            throw error;
          }
        }
      }

      logTest('Migration execution', true);
    } catch (error) {
      logTest('Migration execution', false, error);
    }

    // ===== TEST 3: Encryption/Decryption =====
    console.log('\n🔐 TEST 3: Encryption/Decryption');

    const testString = 'This is a secret test string!';
    try {
      const encrypted = encryptCredential(testString);
      const decrypted = decryptCredential(encrypted);

      if (decrypted === testString && encrypted !== testString) {
        logTest('Encryption/Decryption works correctly', true);
      } else {
        throw new Error('Encryption/Decryption mismatch');
      }
    } catch (error) {
      logTest('Encryption/Decryption', false, error);
    }

    // Test format
    try {
      const encrypted = encryptCredential('test');
      const parts = encrypted.split(':');

      if (parts.length === 3) {
        logTest('Encrypted format (iv:authTag:encrypted)', true);
      } else {
        throw new Error(`Expected 3 parts, got ${parts.length}`);
      }
    } catch (error) {
      logTest('Encrypted format validation', false, error);
    }

    // ===== TEST 4: Create Service Integrator =====
    console.log('\n👤 TEST 4: Create Service Integrator');
    try {
      const si = await db.createServiceIntegrator(TEST_SERVICE_INTEGRATOR);
      serviceIntegratorId = si.id;
      logTest('Create service integrator', true);
      console.log(`   Service Integrator ID: ${si.id}`);
    } catch (error) {
      logTest('Create service integrator', false, error);
    }

    if (!serviceIntegratorId) {
      console.error('\n❌ Cannot proceed without service integrator');
      await db.close();
      process.exit(1);
    }

    // ===== TEST 5: Create API Token Credential (Jira) =====
    console.log('\n🔑 TEST 5: Create API Token Credential (Jira)');
    try {
      const cred = await db.createServiceIntegratorCredential({
        serviceIntegratorId,
        ...TEST_JIRA_CREDENTIAL
      });
      credentialId = cred.id;
      logTest('Create Jira API token credential', true);
      console.log(`   Credential ID: ${cred.id}`);
    } catch (error) {
      logTest('Create Jira API token credential', false, error);
    }

    // ===== TEST 6: Retrieve and Verify Encryption =====
    console.log('\n🔍 TEST 6: Retrieve and Verify Encryption');
    if (credentialId) {
      try {
        const cred = await db.getServiceIntegratorCredential(serviceIntegratorId, 'jira');

        if (!cred) {
          throw new Error('Credential not found');
        }

        if (cred.apiToken === TEST_JIRA_CREDENTIAL.apiToken) {
          logTest('Retrieve and decrypt API token', true);
        } else {
          throw new Error('Decrypted API token does not match original');
        }
      } catch (error) {
        logTest('Retrieve and decrypt', false, error);
      }
    }

    // ===== TEST 7: Create OAuth2 Credential (Azure DevOps) =====
    console.log('\n🔐 TEST 7: Create OAuth2 Credential (Azure DevOps)');
    try {
      const cred = await db.createServiceIntegratorCredential({
        serviceIntegratorId,
        ...TEST_OAUTH_CREDENTIAL
      });
      oauthCredentialId = cred.id;
      logTest('Create Azure DevOps OAuth2 credential', true);
      console.log(`   Credential ID: ${cred.id}`);
    } catch (error) {
      logTest('Create Azure DevOps OAuth2 credential', false, error);
    }

    // ===== TEST 8: List All Credentials =====
    console.log('\n📋 TEST 8: List All Credentials');
    try {
      const creds = await db.listServiceIntegratorCredentials(serviceIntegratorId);

      if (creds.length === 2) {
        logTest('List all credentials (expected 2)', true);

        // Verify tokens are encrypted in list view
        const hasEncryptedTokens = creds.every(c =>
          (c.apiToken === '[ENCRYPTED]' || !c.apiToken) &&
          (c.accessToken === '[ENCRYPTED]' || !c.accessToken)
        );

        if (hasEncryptedTokens) {
          logTest('Tokens are masked in list view', true);
        } else {
          throw new Error('Tokens are not properly masked');
        }
      } else {
        throw new Error(`Expected 2 credentials, got ${creds.length}`);
      }
    } catch (error) {
      logTest('List credentials', false, error);
    }

    // ===== TEST 9: Update Credential =====
    console.log('\n✏️  TEST 9: Update Credential');
    if (credentialId) {
      try {
        const newToken = 'updated-api-token-secret-99999';

        await db.updateServiceIntegratorCredential(credentialId, {
          apiToken: newToken,
          lastUsed: Date.now(),
          lastTestStatus: 'success',
          lastTestMessage: 'Connection test passed'
        });

        const updated = await db.getServiceIntegratorCredentialById(credentialId);

        if (updated?.apiToken === newToken) {
          logTest('Update credential', true);
        } else {
          throw new Error('Updated credential does not match');
        }
      } catch (error) {
        logTest('Update credential', false, error);
      }
    }

    // ===== TEST 10: Audit Logging =====
    console.log('\n📝 TEST 10: Audit Logging');
    if (credentialId) {
      try {
        await db.logCredentialAudit({
          credentialId,
          serviceIntegratorId,
          action: 'accessed',
          performedBy: 'test-script',
          ipAddress: '127.0.0.1',
          success: true,
          timestamp: Date.now()
        });

        const auditLog = await db.getCredentialAuditLog(credentialId);

        if (auditLog.length > 0) {
          logTest('Audit logging', true);
          console.log(`   Audit log entries: ${auditLog.length}`);
        } else {
          throw new Error('No audit log entries found');
        }
      } catch (error) {
        logTest('Audit logging', false, error);
      }
    }

    // ===== TEST 11: Expiring Credentials =====
    console.log('\n⏰ TEST 11: Expiring Credentials (OAuth2)');
    try {
      // Update OAuth2 credential to expire soon
      if (oauthCredentialId) {
        await db.updateServiceIntegratorCredential(oauthCredentialId, {
          expiresAt: Date.now() + (4 * 60 * 1000) // Expires in 4 minutes
        });

        const expiring = await db.getExpiringCredentials(5 * 60 * 1000); // Within 5 minutes

        if (expiring.length === 1 && expiring[0].serviceType === 'azure-devops') {
          logTest('Get expiring credentials', true);
        } else {
          throw new Error(`Expected 1 expiring credential, got ${expiring.length}`);
        }
      }
    } catch (error) {
      logTest('Get expiring credentials', false, error);
    }

    // ===== TEST 12: Delete Credential =====
    console.log('\n🗑️  TEST 12: Delete Credential');
    if (credentialId) {
      try {
        await db.deleteServiceIntegratorCredential(credentialId);

        const deleted = await db.getServiceIntegratorCredentialById(credentialId);

        if (!deleted) {
          logTest('Delete credential', true);
        } else {
          throw new Error('Credential still exists after deletion');
        }
      } catch (error) {
        logTest('Delete credential', false, error);
      }
    }

    // ===== TEST 13: Cleanup =====
    console.log('\n🧹 TEST 13: Cleanup');
    try {
      if (serviceIntegratorId) {
        await db.deleteServiceIntegrator(serviceIntegratorId);
        logTest('Cleanup test data', true);
      }
    } catch (error) {
      logTest('Cleanup', false, error);
    }

  } catch (error) {
    console.error('\n❌ Unexpected error:', error);
  } finally {
    await db.close();
    console.log('\n✅ Database connection closed');
  }

  // ===== TEST SUMMARY =====
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Total: ${testResults.passed + testResults.failed}`);
  console.log(`🎯 Success Rate: ${((testResults.passed / (testResults.passed + testResults.failed)) * 100).toFixed(1)}%`);

  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`   - ${t.name}`);
      if (t.error) {
        console.log(`     Error: ${t.error}`);
      }
    });
  }

  console.log('\n' + '='.repeat(60));

  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((error) => {
  console.error('\n❌ Test suite error:', error);
  process.exit(1);
});
