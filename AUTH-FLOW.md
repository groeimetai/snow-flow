# ServiceNow OAuth Authentication Flow

## Overview

Snow-Flow MCP tools now automatically authenticate with ServiceNow OAuth credentials stored by snow-code. This document explains how the authentication works and how to troubleshoot issues.

## Authentication Priority

The MCP server loads ServiceNow credentials in the following order:

1. **Environment Variables** (highest priority)
   - `SERVICENOW_INSTANCE_URL` or `SNOW_INSTANCE`
   - `SERVICENOW_CLIENT_ID` or `SNOW_CLIENT_ID`
   - `SERVICENOW_CLIENT_SECRET` or `SNOW_CLIENT_SECRET`
   - `SERVICENOW_REFRESH_TOKEN` or `SNOW_REFRESH_TOKEN` (optional)
   - `SERVICENOW_USERNAME` or `SNOW_USERNAME` (fallback, not recommended)
   - `SERVICENOW_PASSWORD` or `SNOW_PASSWORD` (fallback, not recommended)

2. **snow-code auth.json** (automatic fallback)
   - Location: `~/.local/share/snow-code/auth.json`
   - Populated by: `snow-flow auth login`
   - Contains OAuth credentials from snow-code authentication

3. **Unauthenticated Mode** (last resort)
   - Server starts but all tool calls will fail with auth errors
   - Prompts user to run: `snow-flow auth login`

## How to Configure Authentication

### Option 1: Using snow-flow auth login (Recommended)

This is the easiest method and works automatically:

```bash
# Run the authentication flow
snow-flow auth login

# This will:
# 1. Authenticate with your LLM provider (Claude, GPT, etc.)
# 2. Authenticate with ServiceNow OAuth
# 3. Store credentials in ~/.local/share/snow-code/auth.json
# 4. MCP server automatically reads from auth.json
```

After running `snow-flow auth login`, the MCP tools will automatically use the stored credentials without any additional configuration.

### Option 2: Using Environment Variables

If you prefer explicit environment variables or need to override auth.json credentials:

```bash
# Set environment variables
export SERVICENOW_INSTANCE_URL="https://your-instance.service-now.com"
export SERVICENOW_CLIENT_ID="your-client-id"
export SERVICENOW_CLIENT_SECRET="your-client-secret"

# Or add to .env file (not recommended for production)
SERVICENOW_INSTANCE_URL=https://your-instance.service-now.com
SERVICENOW_CLIENT_ID=your-client-id
SERVICENOW_CLIENT_SECRET=your-client-secret
```

**Note:** Environment variables take priority over auth.json credentials.

### Option 3: Project-level .mcp.json (for Claude Desktop/SnowCode)

The `.mcp.json` file can also contain credentials for the MCP server:

```json
{
  "mcpServers": {
    "servicenow-unified": {
      "command": "node",
      "args": ["dist/mcp/servicenow-mcp-unified/index.js"],
      "env": {
        "SERVICENOW_INSTANCE_URL": "https://your-instance.service-now.com",
        "SERVICENOW_CLIENT_ID": "your-client-id",
        "SERVICENOW_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

The `snow-flow auth login` command automatically updates `.mcp.json` with credentials from auth.json.

## How It Works Internally

### 1. Authentication Flow

```
User runs: snow-flow auth login
    ↓
snow-code handles OAuth flow
    ↓
Credentials stored in: ~/.local/share/snow-code/auth.json
    ↓
MCP server starts and reads credentials
    ↓
Priority: env vars → auth.json → unauthenticated
    ↓
OAuth token obtained from ServiceNow
    ↓
Token cached in: ~/.snow-flow/token-cache.json
    ↓
MCP tools use authenticated API client
```

### 2. Token Management

The auth manager automatically handles:
- **Token refresh**: Tokens are refreshed before expiry (1 min buffer)
- **Token caching**: Tokens cached to avoid repeated OAuth calls
- **401 retry**: Automatic token refresh on authentication errors
- **Multiple instances**: Support for multiple ServiceNow instances

### 3. Auth Fallback Logic (server.ts:loadContext)

```typescript
// Pseudocode of credential loading
function loadContext() {
  // Step 1: Check environment variables
  if (hasValidEnvVars()) {
    return credentialsFromEnvVars();
  }

  // Step 2: Check snow-code auth.json
  if (authJsonExists()) {
    const creds = loadFromAuthJson();
    if (creds && !isPlaceholder(creds)) {
      return creds;
    }
  }

  // Step 3: Return empty (unauthenticated mode)
  return emptyCredentials();
}
```

## Troubleshooting

### Issue: "Authentication failed: No username/password available for basic authentication"

**Problem:** MCP server cannot find valid credentials.

**Solutions:**
1. Run `snow-flow auth login` to configure credentials
2. Check `~/.local/share/snow-code/auth.json` exists and contains servicenow credentials
3. Verify credentials are not placeholders (e.g., "your-instance", "your-client-id")
4. Check environment variables if using manual configuration

### Issue: "401 Unauthorized" errors

**Problem:** OAuth tokens expired or invalid.

**Solutions:**
1. Delete token cache: `rm -f ~/.snow-flow/token-cache.json`
2. Re-authenticate: `snow-flow auth login`
3. Verify OAuth client credentials in ServiceNow are still valid
4. Check if OAuth application is still active in ServiceNow

### Issue: MCP server starts in "UNAUTHENTICATED mode"

**Problem:** No valid credentials found during server startup.

**Expected behavior:**
```
[Auth] Warning: No ServiceNow credentials found
[Auth] Checked:
[Auth]   1. Environment variables (SERVICENOW_* or SNOW_*)
[Auth]   2. snow-code auth.json (~/.local/share/snow-code/auth.json)
[Auth] Server starting in UNAUTHENTICATED mode - tools will return authentication errors
[Auth] To configure credentials, run: snow-flow auth login
```

**Solution:** Run `snow-flow auth login` to configure credentials.

### Issue: Credentials in auth.json but still failing

**Check auth.json format:**
```json
{
  "servicenow": {
    "type": "servicenow-oauth",
    "instance": "https://your-instance.service-now.com",
    "clientId": "your-client-id",
    "clientSecret": "your-client-secret",
    "refreshToken": "optional-refresh-token"
  }
}
```

**Requirements:**
- `type` must be exactly `"servicenow-oauth"`
- `instance`, `clientId`, `clientSecret` must be present
- Values must not contain placeholders like "your-"

## Advanced: Multiple Instances

You can work with multiple ServiceNow instances by:

1. **Using environment variables** (per-session):
   ```bash
   # Instance 1
   export SERVICENOW_INSTANCE_URL="https://dev1.service-now.com"
   # ... other vars

   # Instance 2
   export SERVICENOW_INSTANCE_URL="https://dev2.service-now.com"
   # ... other vars
   ```

2. **Switching auth.json** (manual):
   ```bash
   # Backup current auth
   cp ~/.local/share/snow-code/auth.json ~/.local/share/snow-code/auth-instance1.json

   # Run auth for instance 2
   snow-flow auth login

   # Restore instance 1
   cp ~/.local/share/snow-code/auth-instance1.json ~/.local/share/snow-code/auth.json
   ```

## Security Best Practices

1. **Never commit credentials to git**
   - `.env` is in `.gitignore`
   - `auth.json` is in user home directory (not in project)
   - `.mcp.json` should use placeholders in templates

2. **Use OAuth over Basic Auth**
   - OAuth tokens expire and can be revoked
   - Basic auth (username/password) should only be used as last resort
   - OAuth is more secure and supports SSO

3. **Rotate credentials regularly**
   - Regenerate OAuth client secrets periodically
   - Update credentials with `snow-flow auth login`

4. **Use different OAuth clients per environment**
   - Development instance: dev-oauth-client
   - Production instance: prod-oauth-client
   - This allows better access control and auditing

## Implementation Details

### Files Modified (v8.31.36)

1. **src/mcp/servicenow-mcp-unified/server.ts**
   - Added `loadFromAuthJson()` method to read snow-code credentials
   - Updated `loadContext()` with 3-tier priority system
   - Enhanced error messages for credential troubleshooting

2. **src/cli/auth.ts**
   - Existing `updateMCPServerConfig()` already updates `.mcp.json`
   - No changes needed (already functional)

### Code Reference

```typescript
// server.ts:63-102
private loadFromAuthJson(): ServiceNowContext | undefined {
  // Reads ~/.local/share/snow-code/auth.json
  // Returns credentials if valid, undefined otherwise
}

// server.ts:113-170
private loadContext(): ServiceNowContext {
  // Priority 1: Environment variables
  // Priority 2: auth.json fallback
  // Priority 3: Unauthenticated mode
}
```

## FAQ

**Q: Do I need to run `snow-flow auth login` every time?**
A: No, credentials are persisted in auth.json. Only re-run if credentials change or expire.

**Q: Can I use snow-flow without OAuth?**
A: Yes, but not recommended. You can use username/password via environment variables, but this is less secure.

**Q: Where are OAuth tokens cached?**
A: In `~/.snow-flow/token-cache.json`. This file is automatically managed and can be safely deleted if needed.

**Q: How long do OAuth tokens last?**
A: ServiceNow OAuth access tokens typically last 30 minutes. The auth manager automatically refreshes them before expiry.

**Q: Can I manually edit auth.json?**
A: Yes, but it's better to use `snow-flow auth login`. Manual edits must match the exact JSON structure shown above.

## Support

If you encounter authentication issues:

1. Check this document's troubleshooting section
2. Verify ServiceNow OAuth application configuration
3. Review MCP server logs during startup
4. Open an issue: https://github.com/groeimetai/snow-flow/issues

## Changelog

### v8.31.36 (2025-11-13)
- Added automatic auth.json fallback in MCP server
- Implemented 3-tier credential priority system
- Enhanced authentication error messages
- Added comprehensive auth flow documentation
