#!/usr/bin/env node
/**
 * Test Enterprise MCP Proxy JWT authentication
 */

// Set environment variables
process.env.SNOW_LICENSE_KEY = process.env.SNOW_LICENSE_KEY || process.env.SNOW_ENTERPRISE_LICENSE_KEY;
process.env.SNOW_ENTERPRISE_URL = process.env.SNOW_ENTERPRISE_URL || 'https://enterprise.snow-flow.dev';

// Import the proxy module
const { listEnterpriseTools } = require('./dist/mcp/enterprise-proxy/proxy.js');

async function test() {
  console.log('🧪 Testing Enterprise MCP Proxy JWT Authentication\n');

  console.log('Environment check:');
  console.log('- SNOW_LICENSE_KEY:', process.env.SNOW_LICENSE_KEY ? '✓ Set (' + process.env.SNOW_LICENSE_KEY.substring(0, 20) + '...)' : '✗ Not set');
  console.log('- SNOW_ENTERPRISE_URL:', process.env.SNOW_ENTERPRISE_URL);
  console.log('');

  if (!process.env.SNOW_LICENSE_KEY) {
    console.error('❌ SNOW_LICENSE_KEY not set!');
    console.error('Please set SNOW_LICENSE_KEY or SNOW_ENTERPRISE_LICENSE_KEY environment variable');
    process.exit(1);
  }

  try {
    console.log('📡 Step 1: Exchanging license key for JWT token...');
    console.log('📡 Step 2: Fetching enterprise tools list...');

    const startTime = Date.now();
    const tools = await listEnterpriseTools();
    const elapsed = Date.now() - startTime;

    console.log(`✅ SUCCESS! Got ${tools.length} enterprise tools in ${elapsed}ms\n`);

    if (tools.length > 0) {
      console.log('Sample tools:');
      tools.slice(0, 5).forEach(tool => {
        console.log(`  • ${tool.name}`);
        console.log(`    ${tool.description.substring(0, 80)}...`);
      });

      console.log(`\n... and ${Math.max(0, tools.length - 5)} more tools`);
    }

    console.log('\n✅ Enterprise MCP Proxy is working correctly!');
    console.log('✅ JWT token authentication is functioning!');

  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
    if (error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  }
}

test();
