# OpenCode MCP Troubleshooting Guide

## Problem: "Tools not available" or Agent Shows Code Instead of Calling Tools

### Root Causes

There are TWO independent issues that can cause this:

1. **MCP Configuration Issue** (`"env"` vs `"environment"`)
2. **ServiceNow Authentication Failure** (OAuth without refresh token)

Both have been fixed in v8.3.1+!

---

## ✅ Solution 1: Use Updated Configuration (v8.3.1+)

### Quick Fix

```bash
# Update to v8.3.1+
npm install -g snow-flow@latest

# Use the new launcher (handles everything)
cd your-project
./node_modules/snow-flow/scripts/start-opencode.sh
```

The launcher will:
- ✅ Check .env file exists
- ✅ Build Snow-Flow if needed
- ✅ Start MCP servers automatically
- ✅ Run health checks
- ✅ Launch OpenCode with tools pre-loaded

---

## ✅ Solution 2: Manual Setup (Understanding the Fix)

### Step 1: Fix Authentication

**Option A: Use Username/Password (Simpler)**

Edit your `.env` file:

```bash
# ServiceNow Configuration
SNOW_INSTANCE=dev123456.service-now.com

# Use username/password (NEW in v8.3.1!)
SNOW_USERNAME=admin
SNOW_PASSWORD=your-password

# OAuth can be left empty
SNOW_CLIENT_ID=
SNOW_CLIENT_SECRET=
```

**Option B: Fix OAuth (For Production)**

If you prefer OAuth, ensure your ServiceNow OAuth app has:
- ✅ Refresh Token Lifespan set (not "0")
- ✅ Redirect URI configured
- ✅ Access Token Lifespan ≥ 1800 seconds

Go to: **System OAuth** → **Application Registry** → Your OAuth App

### Step 2: Fix OpenCode Configuration

Ensure `opencode-config.json` uses `"environment"` (not `"env"`):

```json
{
  "mcp": {
    "servicenow-unified": {
      "type": "local",
      "command": ["node", "dist/mcp/servicenow-mcp-unified/index.js"],
      "environment": {  // ✅ CORRECT (not "env")
        "SERVICENOW_INSTANCE_URL": "https://dev123456.service-now.com",
        "SERVICENOW_USERNAME": "admin",
        "SERVICENOW_PASSWORD": "your-password"
      },
      "enabled": true
    }
  }
}
```

### Step 3: Test MCP Servers Manually

```bash
# Start MCP server
./scripts/mcp-server-manager.sh start

# Check status
./scripts/mcp-server-manager.sh status
# Should show: "✓ MCP server is running (PID: ...)"
# Should show: "✓ Tools loaded: 370+"

# Run health check
./scripts/mcp-server-manager.sh health
# Should show: "✓ Health check passed - 370+ tools available"
```

### Step 4: Launch OpenCode

```bash
# Option A: Use launcher (recommended)
./scripts/start-opencode.sh

# Option B: Manual launch
opencode
```

---

## 🔍 Diagnostic Commands

### Check if MCP Server is Running

```bash
./scripts/mcp-server-manager.sh status
```

**Good Output:**
```
✓ MCP server is running (PID: 12345)
✓ Tools loaded: 370
```

**Bad Output:**
```
✗ MCP server is not running
```

**Fix:** `./scripts/mcp-server-manager.sh start`

### Check Authentication

```bash
./scripts/mcp-server-manager.sh logs
```

**Good Output:**
```
[Auth] Using username/password authentication
[Auth] Username/password authentication successful
[ToolRegistry] Registered 370 tools
```

**Bad Output:**
```
[Auth] OAuth token refresh failed: No refresh token available
[Auth] Username/password authentication failed: Invalid credentials
```

**Fix:**
- Check .env file has correct credentials
- For OAuth: Add SNOW_USERNAME + SNOW_PASSWORD as fallback
- Verify instance URL is correct (should be `dev123456.service-now.com`, NOT `https://...`)

### Test JSON-RPC Communication

```bash
./scripts/mcp-server-manager.sh health
```

**Good Output:**
```
Testing JSON-RPC communication...
✓ Health check passed - 370 tools available
```

**Bad Output:**
```
✗ Health check failed - timeout
```

**Fix:**
- Check MCP server logs: `./scripts/mcp-server-manager.sh logs`
- Restart server: `./scripts/mcp-server-manager.sh restart`

---

## Common Error Messages & Fixes

### Error: "Missing required environment variables"

**Cause:** .env file not found or MCP server can't read it

**Fix:**
```bash
# Create .env from example
cp .env.example .env

# Edit with your credentials
vi .env

# Restart MCP server
./scripts/mcp-server-manager.sh restart
```

### Error: "OAuth token refresh failed: No refresh token available"

**Cause:** OAuth configuration doesn't provide refresh tokens

**Fix:** Add username/password to .env (fallback auth method):
```bash
SNOW_USERNAME=admin
SNOW_PASSWORD=your-password
```

**Why this works:** v8.3.1+ tries OAuth first, then automatically falls back to username/password.

### Error: "Username/password authentication failed: Invalid credentials"

**Cause:** Wrong username or password

**Fix:**
1. Verify credentials work in ServiceNow web UI
2. Check for special characters (escape them in .env)
3. Try different user account

### Error: "Model tried to call unavailable tool '$functions.snow_update_set_manage'"

**Cause:** MCP tools not loaded in OpenCode

**Fix:**
1. Check `opencode-config.json` uses `"environment"` (not `"env"`)
2. Verify MCP servers are running: `./scripts/mcp-server-manager.sh status`
3. Restart OpenCode: `./scripts/start-opencode.sh`

### Error: "Connection timeout" or "ECONNREFUSED"

**Cause:** ServiceNow instance URL wrong or network issue

**Fix:**
1. Verify SNOW_INSTANCE in .env (should be `dev123456.service-now.com`)
2. Test connectivity: `ping dev123456.service-now.com`
3. Check firewall/VPN settings

---

## Authentication Flow (v8.3.1+)

```
┌─────────────────────────────────────┐
│  MCP Server Starts                  │
└─────────┬───────────────────────────┘
          │
          ▼
┌─────────────────────────────────────┐
│  Try OAuth Authentication           │
│  (if CLIENT_ID + CLIENT_SECRET)     │
└─────────┬───────────────────────────┘
          │
          ├─ Success ──► Use OAuth tokens
          │
          ├─ No refresh token ─────┐
          │                        │
          ▼                        ▼
┌─────────────────────────────────────┐
│  Fallback to Username/Password      │
│  (if USERNAME + PASSWORD)           │
└─────────┬───────────────────────────┘
          │
          ├─ Success ──► Use Basic Auth
          │
          ├─ Fail ─────► Error (no auth method works)
          │
          ▼
     Tools Available!
```

---

## MCP Server Manager Commands

```bash
# Start MCP server in background
./scripts/mcp-server-manager.sh start

# Stop MCP server
./scripts/mcp-server-manager.sh stop

# Restart MCP server
./scripts/mcp-server-manager.sh restart

# Check status
./scripts/mcp-server-manager.sh status

# Run health check (tests JSON-RPC communication)
./scripts/mcp-server-manager.sh health

# Follow logs (Ctrl+C to exit)
./scripts/mcp-server-manager.sh logs

# Show help
./scripts/mcp-server-manager.sh help
```

---

## OpenCode Launcher Benefits

Using `./scripts/start-opencode.sh` instead of direct `opencode`:

- ✅ Validates .env file exists
- ✅ Builds Snow-Flow if dist/ missing
- ✅ Auto-starts MCP servers
- ✅ Runs pre-flight health checks
- ✅ Creates opencode-config.json if missing
- ✅ Replaces ${VARIABLES} with actual values
- ✅ Shows clear error messages with solutions

---

## Still Having Issues?

### 1. Check All Logs

```bash
# MCP server logs
./scripts/mcp-server-manager.sh logs

# OpenCode logs (if available)
cat ~/.opencode/logs/latest.log
```

### 2. Test Individual Components

```bash
# Test MCP server binary exists
ls -la dist/mcp/servicenow-mcp-unified/index.js

# Test environment variables
source .env && echo $SNOW_INSTANCE

# Test ServiceNow connectivity
curl -u "$SNOW_USERNAME:$SNOW_PASSWORD" \
  "https://$SNOW_INSTANCE/api/now/table/sys_user?sysparm_limit=1"
```

### 3. Clean Restart

```bash
# Stop everything
./scripts/mcp-server-manager.sh stop

# Rebuild
npm run build

# Start fresh
./scripts/start-opencode.sh
```

### 4. Report Issue

If none of the above works, create a GitHub issue with:

- Snow-Flow version: `npm list -g snow-flow`
- Node.js version: `node -v`
- OpenCode version: `opencode --version`
- Output of: `./scripts/mcp-server-manager.sh health`
- Relevant logs (without passwords!)

---

## Version Information

- **v8.3.0 and earlier**: Only OAuth supported, config used `"env"`
- **v8.3.1+**: OAuth + Username/Password fallback, config uses `"environment"`

**Upgrade command:**
```bash
npm install -g snow-flow@latest
```

---

**Last Updated:** 2025-10-22 (v8.3.1)
