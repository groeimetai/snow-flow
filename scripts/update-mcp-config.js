#!/usr/bin/env node
/**
 * Update .mcp.json with credentials from environment variables
 *
 * This script reads ServiceNow credentials from .env file and updates
 * the .mcp.json configuration to use the actual credentials instead
 * of placeholder values.
 *
 * Usage: node scripts/update-mcp-config.js
 */

const fs = require('fs');
const path = require('path');

// Load .env file if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

// Get credentials from environment (support both SNOW_* and SERVICENOW_* prefixes)
const instanceUrl = process.env.SERVICENOW_INSTANCE_URL ||
                    (process.env.SNOW_INSTANCE ? `https://${process.env.SNOW_INSTANCE}` : null);
const clientId = process.env.SERVICENOW_CLIENT_ID || process.env.SNOW_CLIENT_ID;
const clientSecret = process.env.SERVICENOW_CLIENT_SECRET || process.env.SNOW_CLIENT_SECRET;

// Check if credentials are available
if (!instanceUrl || !clientId || !clientSecret) {
  console.log('⚠️  Warning: ServiceNow credentials not found in environment');
  console.log('   Please set SNOW_INSTANCE, SNOW_CLIENT_ID, and SNOW_CLIENT_SECRET in .env');
  process.exit(0); // Exit gracefully - not an error
}

// Read .mcp.json
const mcpJsonPath = path.join(process.cwd(), '.mcp.json');
if (!fs.existsSync(mcpJsonPath)) {
  console.log('ℹ️  No .mcp.json found - using global config instead');
  process.exit(0);
}

let config;
try {
  config = JSON.parse(fs.readFileSync(mcpJsonPath, 'utf-8'));
} catch (error) {
  console.error('❌ Failed to parse .mcp.json:', error.message);
  process.exit(1);
}

// Update servicenow-unified server configuration
if (config.mcpServers && config.mcpServers['servicenow-unified']) {
  const server = config.mcpServers['servicenow-unified'];

  // Support both "environment" (OpenCode) and "env" (Claude Desktop) keys
  const envKey = server.environment !== undefined ? 'environment' : 'env';

  if (!server[envKey]) {
    server[envKey] = {};
  }

  // Check if values are placeholders
  const envVars = server[envKey];
  const hasPlaceholders =
    !envVars.SERVICENOW_INSTANCE_URL ||
    envVars.SERVICENOW_INSTANCE_URL.includes('your-instance') ||
    envVars.SERVICENOW_CLIENT_ID === 'your-client-id' ||
    envVars.SERVICENOW_CLIENT_SECRET === 'your-client-secret';

  if (hasPlaceholders) {
    console.log('🔧 Updating .mcp.json with credentials from environment...');

    envVars.SERVICENOW_INSTANCE_URL = instanceUrl;
    envVars.SERVICENOW_CLIENT_ID = clientId;
    envVars.SERVICENOW_CLIENT_SECRET = clientSecret;

    // Write updated config
    fs.writeFileSync(mcpJsonPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log('✅ Updated .mcp.json successfully');
    console.log(`   Instance: ${instanceUrl}`);
    console.log(`   Client ID: ${clientId.substring(0, 8)}...`);
  } else {
    console.log('✅ .mcp.json already has valid credentials');
  }
} else {
  console.log('⚠️  No servicenow-unified server found in .mcp.json');
}
