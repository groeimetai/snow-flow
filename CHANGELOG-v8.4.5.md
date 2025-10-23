# Snow-Flow v8.4.5 Release Notes

**Release Date**: 2025-10-23
**Type**: Critical Bug Fix
**Breaking Changes**: No (but requires `snow-flow init` to be run again)

---

## 🚨 Critical Bug Fixes

### Fixed MCP Server Socket Connection Crash

**Problem**:
- MCP servers crashed immediately with "socket connection was closed unexpectedly" error
- OpenCode could not connect to ServiceNow tools
- Swarm command would hang/not start

**Root Causes**:

1. **Environment Variable Mismatch**:
   - Init command created config with: `SNOW_INSTANCE`, `SNOW_CLIENT_ID`, `SNOW_CLIENT_SECRET`
   - MCP server expected: `SERVICENOW_INSTANCE_URL`, `SERVICENOW_CLIENT_ID`, `SERVICENOW_CLIENT_SECRET`
   - **Result**: MCP server couldn't find credentials and crashed

2. **Fatal Error on Missing Credentials**:
   - MCP server threw fatal error if credentials were missing
   - **Result**: Server exited instead of starting in unauthenticated mode

**Solutions**:

### 1. Fixed Environment Variable Names (src/cli.ts)

**Before:**
```javascript
env: {
  SNOW_INSTANCE: "${SNOW_INSTANCE}",
  SNOW_CLIENT_ID: "${SNOW_CLIENT_ID}",
  SNOW_CLIENT_SECRET: "${SNOW_CLIENT_SECRET}"
}
```

**After:**
```javascript
env: {
  SERVICENOW_INSTANCE_URL: "https://${SNOW_INSTANCE}",
  SERVICENOW_CLIENT_ID: "${SNOW_CLIENT_ID}",
  SERVICENOW_CLIENT_SECRET: "${SNOW_CLIENT_SECRET}",
  SERVICENOW_USERNAME: "${SNOW_USERNAME}",
  SERVICENOW_PASSWORD: "${SNOW_PASSWORD}"
}
```

**Changes**:
- ✅ Added `SERVICENOW_` prefix to match MCP server expectations
- ✅ Added `https://` prefix to instance URL
- ✅ Added username/password support for basic auth

### 2. Graceful Degradation Without Credentials (server.ts)

**Before:**
```typescript
if (!instanceUrl || !clientId || !clientSecret) {
  throw new Error('Missing required environment variables...');  // CRASH!
}
```

**After:**
```typescript
if (!instanceUrl || !clientId || !clientSecret) {
  console.error('[Auth] Warning: Missing ServiceNow credentials');
  console.error('[Auth] Server starting in UNAUTHENTICATED mode');
  console.error('[Auth] Configure credentials in .env to enable integration');

  // Return empty context - tools will fail with clear auth errors
  return { instanceUrl: '', clientId: '', clientSecret: '', ... };
}
```

**Benefits**:
- ✅ Server starts even without credentials
- ✅ Clear error messages in logs
- ✅ Tools fail gracefully with authentication errors
- ✅ Better developer experience during setup

### 3. Updated Type Definitions (types.ts)

Added optional username/password fields to `ServiceNowContext`:

```typescript
export interface ServiceNowContext {
  instanceUrl: string;
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
  accessToken?: string;
  tokenExpiry?: number;
  username?: string;      // NEW
  password?: string;      // NEW
  enterprise?: EnterpriseLicense;
}
```

### 4. Fixed Example Config (opencode-config.example.json)

**Before:**
```json
{
  "command": ["node", "dist/mcp/..."],  // Wrong format
  "environment": { ... }                 // Wrong key
}
```

**After:**
```json
{
  "command": "node",
  "args": ["dist/mcp/..."],
  "env": {
    "SERVICENOW_INSTANCE_URL": "https://${SNOW_INSTANCE}",
    ...
  }
}
```

---

## 📦 Files Changed

**Modified:**
- `src/cli.ts` - Fixed env variable names in init config generation
- `src/mcp/servicenow-mcp-unified/server.ts` - Graceful degradation without credentials
- `src/mcp/servicenow-mcp-unified/shared/types.ts` - Added username/password fields
- `opencode-config.example.json` - Fixed config format and env vars
- `package.json` - Version bump to 8.4.5

---

## 🔧 Migration Guide

### For Existing Users:

**You MUST re-run init to get the fixed config:**

```bash
# Install v8.4.5
npm install -g snow-flow@8.4.5

# Re-run init in your project (overwrites .opencode/opencode.json)
cd your-project
snow-flow init --force

# Verify MCP servers can start
# You should see:
# 🔍 Verifying MCP server configuration...
#    Testing servicenow-unified... ✓
#    Testing snow-flow... ✓
#
#    ✅ All 2 MCP server(s) verified successfully
```

**If you see warnings about missing credentials:**
```
[Auth] Warning: Missing ServiceNow credentials
[Auth] Server starting in UNAUTHENTICATED mode
```

This is OK! It means:
- ✅ MCP server is starting correctly
- ⚠️ You need to configure `.env` with ServiceNow credentials
- ℹ️ Tools will work once credentials are added

### For New Users:

Just run `snow-flow init` - it will create the correct config automatically!

---

## 🎯 Testing the Fix

### Test 1: MCP Server Starts Without Credentials

```bash
# Should NOT crash anymore:
node dist/mcp/servicenow-mcp-unified/index.js

# Expected output:
# [Auth] Warning: Missing ServiceNow credentials
# [Auth] Server starting in UNAUTHENTICATED mode
# [Server] Started on stdio transport (235 tools available)
```

### Test 2: Swarm Command Works

```bash
# Should start OpenCode now:
snow-flow swarm "create incident dashboard"

# OpenCode should launch and connect to MCP servers
```

### Test 3: OpenCode Integration

```bash
# Start OpenCode directly
opencode

# Try using a ServiceNow tool
# If no credentials: Clear auth error (not crash!)
# If credentials configured: Tool works!
```

---

## 📊 Impact

| Issue | Before v8.4.5 | After v8.4.5 |
|-------|---------------|--------------|
| MCP server with credentials | ❌ Crash (wrong env vars) | ✅ Works |
| MCP server without credentials | ❌ Fatal crash | ✅ Starts (unauthenticated) |
| Swarm command | ❌ Hangs/fails | ✅ Works |
| OpenCode integration | ❌ Socket errors | ✅ Works |
| Developer experience | ❌ Confusing crashes | ✅ Clear error messages |

---

## 🚧 What This Fixes

1. **"Socket connection closed unexpectedly"** - MCP servers now start correctly
2. **Swarm command hanging** - OpenCode can now connect to MCP servers
3. **Silent failures** - Clear error messages when credentials are missing
4. **Setup friction** - Server starts even before credentials are configured

---

## 🙏 Acknowledgments

Thanks to the community for reporting the socket connection issues!

---

## ⚠️ Important Notes

**BREAKING CHANGE (Config Only):**
- Existing `.opencode/opencode.json` files will NOT work with v8.4.5
- You MUST run `snow-flow init --force` to regenerate the config
- This is a one-time migration - future versions will be backward compatible

**Why this change was necessary:**
- The MCP server was using the industry-standard `SERVICENOW_` prefix
- The init command was generating non-standard variable names
- We aligned the init command with the MCP server's expectations

---

**Full Changelog**: https://github.com/groeimetai/snow-flow/compare/v8.4.4...v8.4.5
