# SnowCode MCP Auto-Start Fix (v8.6.38+)

## 🚨 Problem Discovered

**Issue:** SnowCode v0.15.14 (OpenCode) does NOT automatically start MCP servers, even when correctly configured in `~/.snowcode/snowcode.json`.

**Symptoms:**
- MCP tools not available in SnowCode sessions
- `snow_create_update_set` and other tools show "not defined" errors
- No MCP server processes running (`ps aux | grep mcp` shows nothing)

**Root Cause:**
SnowCode reads the config file correctly, but doesn't launch the MCP server processes automatically. This appears to be a limitation or bug in OpenCode v0.15.14.

## ✅ Verification

Your configuration is **CORRECT** if:
- ✅ `~/.snowcode/snowcode.json` exists
- ✅ MCP servers are configured with real credential values (not `${VAR}` placeholders)
- ✅ Server scripts exist at the correct paths
- ✅ MCP server can start manually: `node ~/.nvm/versions/node/v20.19.5/lib/node_modules/snow-flow/dist/mcp/servicenow-mcp-unified/index.js`

Run diagnostics to verify:
```bash
node ~/.nvm/versions/node/v20.19.5/lib/node_modules/snow-flow/scripts/diagnose-mcp.js
```

## 🔧 Solution: Use `snowcode-with-mcp` Launcher

### Installation

```bash
# Install/update Snow-Flow (includes the launcher)
npm install -g snow-flow@latest

# Verify installation
snowcode-with-mcp --version
```

### Usage

**Instead of:**
```bash
snowcode
```

**Use:**
```bash
snowcode-with-mcp
```

### What It Does

1. ✅ Reads `~/.snowcode/snowcode.json`
2. ✅ Starts all enabled local MCP servers in background
3. ✅ Waits 2 seconds for servers to initialize
4. ✅ Launches SnowCode with MCP tools immediately available
5. ✅ Automatically stops MCP servers when you quit SnowCode

### Example Output

```
🚀 SnowCode + MCP Auto-Start Launcher

📡 Starting MCP servers...

🔧 Starting: servicenow-unified
   ✅ Started (PID: 12345)
🔧 Starting: snow-flow-orchestration
   ✅ Started (PID: 12346)
⏭️  Skipping remote server: snow-flow-enterprise

✅ Started 2 MCP server(s):
   - servicenow-unified
   - snow-flow-orchestration

⏳ Waiting for servers to initialize (2 seconds)...

🎯 Launching SnowCode...

================================================================================
```

## 🧪 Testing MCP Tools

Once SnowCode launches with `snowcode-with-mcp`, test that tools are available:

```javascript
// In SnowCode, try:
await snow_query_table({
  table: "sys_user",
  limit: 1
});

// Should return user data, NOT "snow_query_table is not defined"
```

## 📊 Available Commands

### Diagnostic Tools

```bash
# Full MCP diagnostic
node ~/.nvm/versions/node/v20.19.5/lib/node_modules/snow-flow/scripts/diagnose-mcp.js

# Manual MCP server test
node ~/.nvm/versions/node/v20.19.5/lib/node_modules/snow-flow/scripts/test-mcp-manual.js
```

### MCP Server Management

```bash
# Start MCP servers + SnowCode
snowcode-with-mcp

# Check running MCP processes
ps aux | grep -i "servicenow-mcp\|snow-flow-mcp" | grep -v grep

# Stop all MCP processes
pkill -f "servicenow-mcp\|snow-flow-mcp"
```

## 🔍 Troubleshooting

### "snowcode-with-mcp: command not found"

```bash
# Reinstall snow-flow
npm install -g snow-flow@latest

# Check installation
which snowcode-with-mcp
```

### "MCP tools still not available"

1. **Check MCP servers are running:**
   ```bash
   ps aux | grep -i "servicenow-mcp" | grep -v grep
   ```
   You should see processes running.

2. **Check server logs for errors:**
   ```bash
   # The servers output to console during startup
   # Look for errors like:
   # - Authentication failures
   # - Missing dependencies
   # - Network errors
   ```

3. **Verify credentials:**
   ```bash
   cat ~/.snowcode/snowcode.json | grep -A 5 environment
   ```
   Should show real values, NOT `${SNOW_INSTANCE}` placeholders.

4. **Re-authenticate:**
   ```bash
   snow-flow auth login
   ```

### "Server started but tools still unavailable"

This may indicate SnowCode is not properly detecting the running MCP servers. Possible solutions:

1. **Update SnowCode:**
   ```bash
   npm install -g @groeimetai/snowcode@latest
   ```

2. **Check SnowCode logs** for MCP connection errors (if available)

3. **Try manual server start + SnowCode separately:**
   ```bash
   # Terminal 1 - Start MCP servers manually
   node ~/.nvm/versions/node/v20.19.5/lib/node_modules/snow-flow/dist/mcp/servicenow-mcp-unified/index.js &
   node ~/.nvm/versions/node/v20.19.5/lib/node_modules/snow-flow/dist/mcp/snow-flow-mcp.js &

   # Terminal 2 - Launch SnowCode
   snowcode
   ```

## 🎯 Expected Behavior

**CORRECT (with snowcode-with-mcp):**
```javascript
await snow_create_update_set({
  name: "Test Update Set",
  description: "Testing MCP tools",
  application: "global"
});
// ✅ Returns: { sys_id: "...", name: "Test Update Set", ... }
```

**INCORRECT (without MCP servers):**
```javascript
await snow_create_update_set({ ... });
// ❌ ReferenceError: snow_create_update_set is not defined
```

## 📝 Technical Details

### Why SnowCode Doesn't Auto-Start MCP Servers

SnowCode v0.15.14 (based on OpenCode) appears to have a different MCP implementation than Claude Desktop/Claude Code. While it reads `~/.snowcode/snowcode.json`, it doesn't automatically spawn the MCP server processes.

**Evidence:**
- ✅ Config file is read (schema validation passes)
- ✅ Servers can start manually (no errors)
- ❌ No server processes spawn when launching SnowCode
- ❌ Tools remain undefined in SnowCode sessions

**Workaround Strategy:**
The `snowcode-with-mcp` launcher pre-starts the MCP servers before launching SnowCode, making the tools immediately available via MCP protocol.

### Config File Location Priority

SnowCode checks configs in this order:
1. **Local project:** `<project>/.snowcode/snowcode.json` (highest priority)
2. **Global user:** `~/.snowcode/snowcode.json`

The launcher uses the same priority logic.

## 🚀 Future Improvements

This workaround will be needed until:
1. SnowCode/OpenCode implements automatic MCP server spawning
2. Or Snow-Flow develops a native SnowCode integration

We are monitoring SnowCode/OpenCode updates for native MCP auto-start support.

## 📞 Support

If you continue experiencing issues:

1. **Run diagnostics:**
   ```bash
   node ~/.nvm/versions/node/v20.19.5/lib/node_modules/snow-flow/scripts/diagnose-mcp.js > mcp-diagnostic.log
   ```

2. **Check versions:**
   ```bash
   snow-flow --version
   snowcode --version
   node --version
   ```

3. **Report issue:**
   - GitHub: https://github.com/groeimetai/snow-flow/issues
   - Include: diagnostic log, versions, error messages

---

**Version:** 8.6.38+
**Last Updated:** 2025-10-29
**Status:** Active workaround for SnowCode v0.15.14 MCP limitation
