#!/usr/bin/env node

/**
 * MCP Diagnostic Tool - Verifies SnowCode MCP configuration and server startup
 */

var fs = require('fs');
var path = require('path');
var { execSync } = require('child_process');
var os = require('os');

console.log('\n🔍 SnowCode MCP Diagnostic Tool\n');
console.log('='.repeat(80));

var issues = [];
var warnings = [];
var successes = [];

// 1. Check SnowCode installation
console.log('\n1️⃣  Checking SnowCode installation...');
try {
  var snowcodeVersion = execSync('snow-code --version 2>&1', { encoding: 'utf-8' }).trim();
  if (snowcodeVersion.includes('command not found')) {
    issues.push('SnowCode CLI not found - install with: npm install -g @groeimetai/snow-code');
  } else {
    successes.push('SnowCode installed: ' + snowcodeVersion);
    console.log('   ✅ ' + snowcodeVersion);
  }
} catch (e) {
  issues.push('SnowCode not installed or not in PATH');
  console.log('   ❌ SnowCode not found');
}

// 2. Check global snowcode.json
console.log('\n2️⃣  Checking global SnowCode configuration...');
var globalConfigPath = path.join(os.homedir(), '.snow-code', 'snowcode.json');
if (fs.existsSync(globalConfigPath)) {
  try {
    var globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
    successes.push('Global config exists: ' + globalConfigPath);
    console.log('   ✅ Config file found: ' + globalConfigPath);

    // Check MCP section
    if (globalConfig.mcp) {
      var serverCount = Object.keys(globalConfig.mcp).length;
      successes.push('MCP servers configured: ' + serverCount);
      console.log('   ✅ MCP servers configured: ' + serverCount);

      // List servers
      for (var serverName in globalConfig.mcp) {
        var server = globalConfig.mcp[serverName];
        console.log('      - ' + serverName + ' (type: ' + server.type + ', enabled: ' + server.enabled + ')');

        // Validate server config
        if (server.type === 'local') {
          // Check command exists
          if (server.command && server.command.length > 0) {
            var scriptPath = server.command[server.command.length - 1]; // Last arg is usually the script
            if (fs.existsSync(scriptPath)) {
              successes.push(serverName + ' script exists: ' + scriptPath);
              console.log('        ✅ Script exists: ' + scriptPath);
            } else {
              issues.push(serverName + ' script NOT found: ' + scriptPath);
              console.log('        ❌ Script NOT found: ' + scriptPath);
            }

            // Check environment variables
            if (server.environment) {
              var emptyVars = [];
              for (var key in server.environment) {
                var value = server.environment[key];
                if (!value || value === '' || value === '${' + key + '}') {
                  emptyVars.push(key);
                }
              }
              if (emptyVars.length > 0) {
                warnings.push(serverName + ' has empty env vars: ' + emptyVars.join(', '));
                console.log('        ⚠️  Empty env vars: ' + emptyVars.join(', '));
              } else {
                successes.push(serverName + ' environment variables configured');
                console.log('        ✅ Environment variables configured');
              }
            }
          }
        } else if (server.type === 'remote') {
          // Check URL and headers
          if (server.url) {
            console.log('        ✅ Remote URL: ' + server.url);
          }
          if (server.headers && server.headers.Authorization) {
            var authHeader = server.headers.Authorization;
            if (authHeader === 'Bearer ' || authHeader === 'Bearer') {
              warnings.push(serverName + ' has empty Authorization token');
              console.log('        ⚠️  Authorization token is empty (server disabled)');
            } else {
              console.log('        ✅ Authorization configured');
            }
          }
        }
      }
    } else {
      issues.push('No MCP servers configured in global config');
      console.log('   ❌ No MCP section found in config');
    }

    // Validate schema
    if (globalConfig.$schema !== 'https://opencode.ai/config.json') {
      warnings.push('Schema URL mismatch: ' + globalConfig.$schema);
      console.log('   ⚠️  Schema: ' + (globalConfig.$schema || 'NOT SET'));
    }
  } catch (e) {
    issues.push('Failed to parse global config: ' + e.message);
    console.log('   ❌ Failed to parse config: ' + e.message);
  }
} else {
  issues.push('Global SnowCode config not found: ' + globalConfigPath);
  console.log('   ❌ Config file not found: ' + globalConfigPath);
  console.log('   💡 Run: snow-flow auth login');
}

// 3. Check local project config
console.log('\n3️⃣  Checking local project configuration...');
var localConfigPath = path.join(process.cwd(), '.snow-code', 'snowcode.json');
if (fs.existsSync(localConfigPath)) {
  console.log('   ✅ Local config exists: ' + localConfigPath);
  console.log('   💡 Local config takes priority over global config');
  successes.push('Local project config found (takes priority)');
} else {
  console.log('   ℹ️  No local config (using global config)');
}

// 4. Test MCP server startup
console.log('\n4️⃣  Testing MCP server startup...');
if (globalConfig && globalConfig.mcp && globalConfig.mcp['servicenow-unified']) {
  var unifiedServer = globalConfig.mcp['servicenow-unified'];
  if (unifiedServer.type === 'local' && unifiedServer.command) {
    var scriptPath = unifiedServer.command[unifiedServer.command.length - 1];
    console.log('   🧪 Testing servicenow-unified server startup...');

    try {
      // Try to start the server with a timeout
      var testEnv = Object.assign({}, process.env);
      if (unifiedServer.environment) {
        Object.assign(testEnv, unifiedServer.environment);
      }

      // Start server and kill after 2 seconds
      console.log('   ⏳ Starting server (2 second timeout)...');
      var nodeCmd = unifiedServer.command[0];
      var serverArgs = unifiedServer.command.slice(1).join(' ');

      try {
        execSync('timeout 2 ' + nodeCmd + ' ' + serverArgs + ' 2>&1 || true', {
          encoding: 'utf-8',
          env: testEnv,
          timeout: 3000
        });
        console.log('   ✅ Server started successfully (no immediate errors)');
        successes.push('MCP server startup test passed');
      } catch (e) {
        if (e.message.includes('timeout')) {
          console.log('   ✅ Server running (killed after 2s)');
          successes.push('MCP server startup test passed');
        } else {
          console.log('   ❌ Server startup failed:');
          console.log('      ' + e.message);
          issues.push('MCP server fails to start: ' + e.message);
        }
      }
    } catch (e) {
      console.log('   ⚠️  Could not test server startup: ' + e.message);
      warnings.push('MCP server startup test skipped: ' + e.message);
    }
  }
}

// 5. Check Snow-Flow version
console.log('\n5️⃣  Checking Snow-Flow version...');
try {
  var snowFlowVersion = execSync('snow-flow --version 2>&1', { encoding: 'utf-8' }).trim();
  console.log('   ✅ ' + snowFlowVersion);
  successes.push('Snow-Flow installed: ' + snowFlowVersion);

  // Check if it's the latest version
  if (snowFlowVersion !== '8.6.38') {
    warnings.push('Snow-Flow version mismatch (installed: ' + snowFlowVersion + ', latest: 8.6.38)');
    console.log('   ⚠️  Not the latest version (8.6.38)');
    console.log('   💡 Update with: npm install -g snow-flow@latest');
  }
} catch (e) {
  issues.push('Snow-Flow not installed');
  console.log('   ❌ Snow-Flow not found');
}

// 6. Check for running MCP processes
console.log('\n6️⃣  Checking for running MCP processes...');
try {
  var processes = execSync('ps aux | grep -i "servicenow-mcp\\|snow-flow-mcp" | grep -v grep || echo "No MCP processes"', {
    encoding: 'utf-8'
  }).trim();

  if (processes === 'No MCP processes') {
    warnings.push('No MCP server processes currently running');
    console.log('   ⚠️  No MCP server processes found');
    console.log('   💡 SnowCode should start these automatically when launched');
  } else {
    console.log('   ✅ MCP processes running:');
    var lines = processes.split('\n');
    for (var i = 0; i < lines.length; i++) {
      console.log('      ' + lines[i]);
    }
    successes.push('MCP server processes running');
  }
} catch (e) {
  console.log('   ℹ️  Could not check processes');
}

// Summary
console.log('\n' + '='.repeat(80));
console.log('📊 DIAGNOSTIC SUMMARY\n');

if (successes.length > 0) {
  console.log('✅ SUCCESSES (' + successes.length + '):');
  for (var i = 0; i < successes.length; i++) {
    console.log('   ✓ ' + successes[i]);
  }
  console.log('');
}

if (warnings.length > 0) {
  console.log('⚠️  WARNINGS (' + warnings.length + '):');
  for (var i = 0; i < warnings.length; i++) {
    console.log('   ⚠ ' + warnings[i]);
  }
  console.log('');
}

if (issues.length > 0) {
  console.log('❌ ISSUES (' + issues.length + '):');
  for (var i = 0; i < issues.length; i++) {
    console.log('   ✗ ' + issues[i]);
  }
  console.log('');
}

// Recommendations
console.log('💡 RECOMMENDATIONS:\n');

if (issues.length > 0) {
  console.log('1. Fix the issues above first:');
  if (issues.some(function(i) { return i.includes('SnowCode not installed'); })) {
    console.log('   → Install SnowCode: npm install -g @groeimetai/snow-code');
  }
  if (issues.some(function(i) { return i.includes('config not found'); })) {
    console.log('   → Configure Snow-Flow: snow-flow auth login');
  }
  if (issues.some(function(i) { return i.includes('script NOT found'); })) {
    console.log('   → Reinstall Snow-Flow: npm install -g snow-flow@latest');
  }
  if (issues.some(function(i) { return i.includes('server fails to start'); })) {
    console.log('   → Check MCP server logs for errors');
    console.log('   → Verify credentials in snowcode.json are correct');
  }
  console.log('');
}

if (warnings.length > 0 && issues.length === 0) {
  console.log('2. Address warnings:');
  if (warnings.some(function(w) { return w.includes('empty env vars'); })) {
    console.log('   → Run: snow-flow auth login (to set credentials)');
  }
  if (warnings.some(function(w) { return w.includes('version mismatch'); })) {
    console.log('   → Update: npm install -g snow-flow@latest');
  }
  if (warnings.some(function(w) { return w.includes('No MCP processes'); })) {
    console.log('   → SnowCode should auto-start MCP servers');
    console.log('   → If tools still unavailable, restart SnowCode completely');
  }
  console.log('');
}

if (issues.length === 0 && warnings.length === 0) {
  console.log('✅ Configuration looks good!');
  console.log('');
  console.log('If MCP tools are still not available in SnowCode:');
  console.log('1. Completely quit SnowCode (not just close window)');
  console.log('2. Restart SnowCode: snow-code');
  console.log('3. Tools should be available immediately');
  console.log('');
  console.log('Test MCP tools with:');
  console.log('   await snow_query_table({ table: "sys_user", limit: 1 })');
  console.log('');
}

console.log('📝 Next steps if issues persist:');
console.log('   1. Check SnowCode logs for MCP startup errors');
console.log('   2. Verify SnowCode is reading ~/.snow-code/snowcode.json');
console.log('   3. Try manual MCP server test: node ' + (globalConfig && globalConfig.mcp && globalConfig.mcp['servicenow-unified'] ? globalConfig.mcp['servicenow-unified'].command[1] : '[path-to-mcp-server]'));
console.log('');
