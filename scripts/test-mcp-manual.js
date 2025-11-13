#!/usr/bin/env node

/**
 * Manual MCP Server Test - Start server and test basic communication
 */

var { spawn } = require('child_process');
var path = require('path');
var os = require('os');
var fs = require('fs');

console.log('\n🧪 Manual MCP Server Test\n');
console.log('='.repeat(80));

// Load config
var configPath = path.join(os.homedir(), '.snow-code', 'snowcode.json');
var config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

var serverConfig = config.mcp['servicenow-unified'];

console.log('📋 Server Configuration:');
console.log('   Type: ' + serverConfig.type);
console.log('   Command: ' + serverConfig.command.join(' '));
console.log('   Environment variables: ' + Object.keys(serverConfig.environment || {}).length);
console.log('');

// Prepare environment
var env = Object.assign({}, process.env, serverConfig.environment || {});

// Check if credentials are set
console.log('🔐 Checking credentials:');
console.log('   SERVICENOW_INSTANCE_URL: ' + (env.SERVICENOW_INSTANCE_URL ? '✅ SET' : '❌ NOT SET'));
console.log('   SERVICENOW_CLIENT_ID: ' + (env.SERVICENOW_CLIENT_ID ? '✅ SET' : '❌ NOT SET'));
console.log('   SERVICENOW_CLIENT_SECRET: ' + (env.SERVICENOW_CLIENT_SECRET ? '✅ SET (' + env.SERVICENOW_CLIENT_SECRET.length + ' chars)' : '❌ NOT SET'));
console.log('');

if (!env.SERVICENOW_INSTANCE_URL || !env.SERVICENOW_CLIENT_ID || !env.SERVICENOW_CLIENT_SECRET) {
  console.log('❌ Missing credentials! Run: snow-flow auth login');
  process.exit(1);
}

console.log('🚀 Starting MCP server...');
console.log('   Command: ' + serverConfig.command[0] + ' ' + serverConfig.command.slice(1).join(' '));
console.log('');

// Start server
var serverProcess = spawn(serverConfig.command[0], serverConfig.command.slice(1), {
  env: env,
  stdio: ['pipe', 'pipe', 'pipe']
});

var output = '';
var errorOutput = '';
var serverStarted = false;

serverProcess.stdout.on('data', function(data) {
  var text = data.toString();
  output += text;

  // Check for successful startup messages
  if (text.includes('MCP server running') || text.includes('Server started') || text.includes('Listening')) {
    serverStarted = true;
    console.log('✅ Server started successfully!');
    console.log('');
    console.log('📊 Server Output:');
    console.log(output);

    // Kill server after success
    setTimeout(function() {
      console.log('\n✅ Test passed - MCP server can start successfully');
      console.log('');
      console.log('🔍 DIAGNOSIS:');
      console.log('   The MCP server works correctly when started manually.');
      console.log('   The issue is that SnowCode is NOT starting it automatically.');
      console.log('');
      console.log('💡 SOLUTION NEEDED:');
      console.log('   1. Check if SnowCode (OpenCode v0.15.14) supports MCP auto-start');
      console.log('   2. Verify SnowCode is reading ~/.snow-code/snowcode.json on startup');
      console.log('   3. Check SnowCode logs for MCP startup errors');
      console.log('   4. Possible SnowCode bug - MCP servers may need manual start');
      console.log('');
      console.log('📝 Temporary workaround:');
      console.log('   Start MCP server manually in background:');
      console.log('   ' + serverConfig.command.join(' ') + ' &');
      console.log('');

      serverProcess.kill();
      process.exit(0);
    }, 2000);
  }
});

serverProcess.stderr.on('data', function(data) {
  errorOutput += data.toString();
});

serverProcess.on('error', function(error) {
  console.log('❌ Failed to start server:');
  console.log(error);
  process.exit(1);
});

serverProcess.on('close', function(code) {
  if (!serverStarted) {
    console.log('❌ Server exited prematurely (code: ' + code + ')');
    console.log('');
    if (output) {
      console.log('📤 STDOUT:');
      console.log(output);
    }
    if (errorOutput) {
      console.log('📥 STDERR:');
      console.log(errorOutput);
    }
    console.log('');
    console.log('💡 Check if:');
    console.log('   1. Node.js version is compatible (requires Node 18+)');
    console.log('   2. All npm dependencies are installed');
    console.log('   3. ServiceNow credentials are valid');
    process.exit(1);
  }
});

// Timeout after 5 seconds
setTimeout(function() {
  if (!serverStarted) {
    console.log('⏱️  Server did not start within 5 seconds');
    console.log('');
    if (output) {
      console.log('📤 STDOUT so far:');
      console.log(output);
    }
    if (errorOutput) {
      console.log('📥 STDERR:');
      console.log(errorOutput);
    }
    serverProcess.kill();
    process.exit(1);
  }
}, 5000);
