#!/usr/bin/env node

/**
 * Test Authentication Flow
 *
 * This script verifies that the MCP server can properly load credentials
 * from either environment variables or snow-code auth.json.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

console.log('🔐 Testing Snow-Flow Authentication Flow\n');

// Test 1: Check for auth.json
console.log('Test 1: Checking snow-code auth.json...');
const authPath = path.join(os.homedir(), '.local', 'share', 'snow-code', 'auth.json');

if (fs.existsSync(authPath)) {
  console.log('✅ auth.json exists at:', authPath);

  try {
    const authData = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
    const servicenowCreds = authData['servicenow'];

    if (servicenowCreds && servicenowCreds.type === 'servicenow-oauth') {
      console.log('✅ ServiceNow OAuth credentials found');
      console.log('   Instance:', servicenowCreds.instance);
      console.log('   Client ID:', servicenowCreds.clientId ? '***' + servicenowCreds.clientId.slice(-4) : 'NOT SET');
      console.log('   Client Secret:', servicenowCreds.clientSecret ? '***' + servicenowCreds.clientSecret.slice(-4) : 'NOT SET');
      console.log('   Has Refresh Token:', !!servicenowCreds.refreshToken);
    } else {
      console.log('❌ No ServiceNow OAuth credentials in auth.json');
      console.log('   Run: snow-flow auth login');
    }
  } catch (error) {
    console.log('❌ Failed to parse auth.json:', error.message);
  }
} else {
  console.log('❌ auth.json not found');
  console.log('   Expected location:', authPath);
  console.log('   Run: snow-flow auth login');
}

console.log('');

// Test 2: Check environment variables
console.log('Test 2: Checking environment variables...');
const envVars = [
  'SERVICENOW_INSTANCE_URL',
  'SERVICENOW_CLIENT_ID',
  'SERVICENOW_CLIENT_SECRET',
  'SERVICENOW_REFRESH_TOKEN',
  'SNOW_INSTANCE',
  'SNOW_CLIENT_ID',
  'SNOW_CLIENT_SECRET',
  'SNOW_REFRESH_TOKEN'
];

let hasEnvVars = false;
envVars.forEach(varName => {
  const value = process.env[varName];
  if (value && value.trim() !== '' && !value.includes('your-')) {
    console.log(`✅ ${varName}: SET`);
    hasEnvVars = true;
  }
});

if (!hasEnvVars) {
  console.log('ℹ️  No environment variables set (this is OK if using auth.json)');
}

console.log('');

// Test 3: Check .mcp.json
console.log('Test 3: Checking project .mcp.json...');
const mcpPath = path.join(process.cwd(), '.mcp.json');

if (fs.existsSync(mcpPath)) {
  console.log('✅ .mcp.json exists');

  try {
    const mcpData = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    const serversKey = mcpData.mcpServers ? 'mcpServers' : 'servers';
    const server = mcpData[serversKey]?.['servicenow-unified'];

    if (server) {
      const envKey = server.environment !== undefined ? 'environment' : 'env';
      const env = server[envKey];

      if (env && env.SERVICENOW_INSTANCE_URL) {
        console.log('✅ servicenow-unified server configured with credentials');
        console.log('   Instance:', env.SERVICENOW_INSTANCE_URL);
      } else {
        console.log('⚠️  servicenow-unified server found but no credentials in env');
      }
    } else {
      console.log('⚠️  No servicenow-unified server in .mcp.json');
    }
  } catch (error) {
    console.log('❌ Failed to parse .mcp.json:', error.message);
  }
} else {
  console.log('ℹ️  .mcp.json not found (this is OK)');
  console.log('   Run: snow-flow init (to create project config)');
}

console.log('');

// Test 4: Check token cache
console.log('Test 4: Checking token cache...');
const tokenCachePath = path.join(os.homedir(), '.snow-flow', 'token-cache.json');

if (fs.existsSync(tokenCachePath)) {
  console.log('✅ Token cache exists');

  try {
    const cacheData = JSON.parse(fs.readFileSync(tokenCachePath, 'utf-8'));
    const instances = Object.keys(cacheData);

    if (instances.length > 0) {
      console.log(`✅ ${instances.length} instance(s) cached`);
      instances.forEach(instance => {
        const token = cacheData[instance];
        const expiresIn = token.expiresAt - Date.now();
        const isExpired = expiresIn <= 0;

        console.log(`   - ${instance}: ${isExpired ? '❌ EXPIRED' : '✅ Valid'} (expires in ${Math.round(expiresIn / 1000 / 60)} min)`);
      });
    } else {
      console.log('ℹ️  Token cache empty (tokens will be fetched on first use)');
    }
  } catch (error) {
    console.log('⚠️  Failed to parse token cache:', error.message);
  }
} else {
  console.log('ℹ️  No token cache yet (will be created on first API call)');
}

console.log('');

// Summary
console.log('📊 Summary:');
console.log('═══════════════════════════════════════════════════════════');

const authJsonExists = fs.existsSync(authPath);
const hasMcpJson = fs.existsSync(mcpPath);

if (authJsonExists) {
  console.log('✅ Authentication configured via auth.json');
  console.log('   The MCP server will automatically use these credentials');
} else if (hasEnvVars) {
  console.log('✅ Authentication configured via environment variables');
  console.log('   The MCP server will use these credentials');
} else {
  console.log('❌ No authentication configured');
  console.log('');
  console.log('To fix:');
  console.log('   1. Run: snow-flow auth login');
  console.log('   2. Or set environment variables manually');
}

console.log('');
console.log('Authentication Priority:');
console.log('   1. Environment variables (SERVICENOW_* or SNOW_*)');
console.log('   2. snow-code auth.json (~/.local/share/snow-code/auth.json)');
console.log('   3. Unauthenticated mode (tools will fail with auth errors)');

console.log('');
console.log('For detailed documentation, see: AUTH-FLOW.md');
console.log('═══════════════════════════════════════════════════════════');
