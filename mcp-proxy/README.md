# Snow-Flow Enterprise MCP Proxy

Connect the **open source Snow-Flow** to your **Enterprise License Server** to access enterprise-hosted tools (Jira, Azure DevOps, Confluence).

## 🎯 What This Does

This proxy allows Claude Code to use enterprise MCP tools that are hosted on your license server:

```
Claude Code → Enterprise Proxy → License Server → Jira/Azure/Confluence
```

**Benefits:**
- ✅ Use enterprise tools from open source Snow-Flow
- ✅ License validation per request
- ✅ Complete usage tracking
- ✅ Credentials never leave your machine
- ✅ Easy updates (server-side only)

## 📋 Prerequisites

1. **Enterprise License Server** running (deployed to GCP or similar)
2. **Valid License Key** (e.g., `SNOW-ENT-GLOB-ABC123`)
3. **Node.js 18+** installed
4. **Claude Code / OpenCode** installed

## 🚀 Quick Start

### Step 1: Install Dependencies

```bash
cd enterprise/mcp-proxy
npm install
```

### Step 2: Build the Proxy

```bash
npm run build
```

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your credentials
nano .env
```

**Required variables:**
```bash
SNOW_ENTERPRISE_URL=https://your-license-server.run.app
SNOW_LICENSE_KEY=SNOW-ENT-GLOB-ABC123
```

**Optional (depending on which tools you use):**
```bash
# ServiceNow
SNOW_INSTANCE_URL=https://dev123456.service-now.com
SNOW_USERNAME=admin
SNOW_PASSWORD=password

# Jira
JIRA_BASE_URL=https://company.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=your-token

# Azure DevOps
AZDO_ORG_URL=https://dev.azure.com/org
AZDO_PAT=your-pat

# Confluence
CONFLUENCE_BASE_URL=https://company.atlassian.net/wiki
CONFLUENCE_EMAIL=user@company.com
CONFLUENCE_API_TOKEN=your-token
```

### Step 4: Test the Proxy

```bash
# Test manually
npm start

# You should see:
# ═══════════════════════════════════════════════════
# Snow-Flow Enterprise MCP Proxy
# ═══════════════════════════════════════════════════
# License Server: https://your-license-server.run.app
# License Key: SNOW-ENT-GLOB-ABC123...
#
# Configured Services:
#   ServiceNow: ✓
#   Jira: ✓
#   Azure DevOps: ✓
#   Confluence: ✓
# ═══════════════════════════════════════════════════
```

### Step 5: Configure OpenCode

**Option A: Using .env file (Recommended)**

Create `.opencode/config.json`:

```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["/absolute/path/to/enterprise/mcp-proxy/dist/enterprise-proxy.js"],
      "env": {}
    }
  }
}
```

Then create `/absolute/path/to/enterprise/mcp-proxy/.env` with your credentials.

**Option B: Inline environment variables**

```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["/absolute/path/to/enterprise/mcp-proxy/dist/enterprise-proxy.js"],
      "env": {
        "SNOW_ENTERPRISE_URL": "https://your-license-server.run.app",
        "SNOW_LICENSE_KEY": "SNOW-ENT-GLOB-ABC123",
        "SNOW_INSTANCE_URL": "https://dev123456.service-now.com",
        "SNOW_USERNAME": "admin",
        "SNOW_PASSWORD": "password",
        "JIRA_BASE_URL": "https://company.atlassian.net",
        "JIRA_EMAIL": "user@company.com",
        "JIRA_API_TOKEN": "your-token"
      }
    }
  }
}
```

### Step 6: Restart Claude Code

Restart Claude Code / OpenCode to pick up the new MCP server configuration.

### Step 7: Verify Tools Available

In Claude Code, ask:

```
User: "What Jira tools are available?"

Claude: "I have access to these Jira tools:
- snow_jira_create_issue
- snow_jira_update_issue
- snow_jira_query_issues
- snow_jira_get_issue
- snow_jira_add_comment
- snow_jira_transition_issue
- snow_jira_create_sprint
- snow_jira_assign_issue"
```

### Step 8: Use the Tools!

```
User: "Create a Jira ticket for bug: Authentication fails on login"

Claude: [Uses snow_jira_create_issue via enterprise proxy]
       "Created Jira ticket SNOW-123: Authentication fails on login
        URL: https://company.atlassian.net/browse/SNOW-123"
```

## 🔒 Security Best Practices

### 1. Never Commit Credentials

Add to `.gitignore`:
```
.env
.env.local
.env.production
```

### 2. Use Environment Variables

**✅ DO:**
```bash
# Store in .env file
SNOW_LICENSE_KEY=SNOW-ENT-GLOB-ABC123
```

**❌ DON'T:**
```json
// Hardcode in config
"SNOW_LICENSE_KEY": "SNOW-ENT-GLOB-ABC123"
```

### 3. Rotate Credentials Regularly

- Jira API tokens every 90 days
- Azure PATs every 90 days
- ServiceNow passwords every 90 days
- License keys on security incidents

### 4. Use Read-Only Credentials When Possible

Grant minimum necessary permissions:
- Jira: Project-specific access
- Azure: Repository read/write only
- ServiceNow: Specific table access

## 🐛 Troubleshooting

### Error: "SNOW_ENTERPRISE_URL environment variable is required"

**Solution:** Set the environment variable in `.env` or OpenCode config.

```bash
# In .env
SNOW_ENTERPRISE_URL=https://your-license-server.run.app
```

### Error: "Failed to connect to license server"

**Possible causes:**
1. License server URL is wrong
2. License server is down
3. License key is invalid
4. Network connectivity issues

**Check:**
```bash
# Test license server is up
curl https://your-license-server.run.app/health

# Test license key
curl -H "Authorization: Bearer SNOW-ENT-GLOB-ABC123" \
  https://your-license-server.run.app/mcp/tools/list
```

### Error: "Tool execution failed"

**Possible causes:**
1. Missing credentials for that service
2. Invalid credentials
3. API rate limits exceeded
4. Service is down

**Check logs:**
```bash
# Run proxy with debug output
node dist/enterprise-proxy.js
```

### Proxy not showing up in Claude Code

**Solutions:**
1. Check OpenCode config path is correct
2. Verify absolute paths (not relative)
3. Restart Claude Code
4. Check Claude Code logs: `~/.opencode/logs/`

## 📊 Usage Tracking

All tool calls are logged on the license server:

```bash
# View your usage via API
curl -H "Authorization: Bearer SNOW-ENT-GLOB-ABC123" \
  https://your-license-server.run.app/api/admin/customers/me/usage
```

**Metrics tracked:**
- Total tool calls
- Calls per tool category (Jira, Azure, Confluence)
- Success/failure rates
- Average response times
- Usage over time

## 🔧 Advanced Configuration

### Using Multiple License Keys

Create separate proxy instances for different projects:

```json
{
  "mcpServers": {
    "snow-flow-project-a": {
      "command": "node",
      "args": ["/.../enterprise-proxy.js"],
      "env": {
        "SNOW_LICENSE_KEY": "SNOW-ENT-PROJ-A"
      }
    },
    "snow-flow-project-b": {
      "command": "node",
      "args": ["/.../enterprise-proxy.js"],
      "env": {
        "SNOW_LICENSE_KEY": "SNOW-ENT-PROJ-B"
      }
    }
  }
}
```

### Custom Timeout

Increase timeout for slow operations:

Edit `enterprise-proxy.ts`:
```typescript
timeout: 300000 // 5 minutes instead of 2
```

Rebuild:
```bash
npm run build
```

### Logging

Enable debug logging:

```bash
# Set DEBUG environment variable
DEBUG=snow-flow:* node dist/enterprise-proxy.js
```

## 📚 Related Documentation

- [Enterprise Integration Guide](../ENTERPRISE-INTEGRATION-GUIDE.md)
- [SSO Integration Guide](../license-server/SSO-INTEGRATION-GUIDE.md)
- [Jira Integration Guide](../license-server/JIRA-INTEGRATION-GUIDE.md)
- [Azure DevOps Integration Guide](../license-server/AZURE-DEVOPS-INTEGRATION-GUIDE.md)
- [Confluence Integration Guide](../license-server/CONFLUENCE-INTEGRATION-GUIDE.md)

## 🆘 Support

**Email:** support@snow-flow.com
**GitHub Issues:** https://github.com/your-org/snow-flow/issues
**Documentation:** https://docs.snow-flow.com

## 📝 License

MIT License - See LICENSE file for details

---

**Status:** ✅ READY FOR USE
**Version:** 1.0.0
**Last Updated:** 2025-10-22
