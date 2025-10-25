# Snow-Flow Enterprise - Quick Start Guide

🚀 **Get the complete Snow-Flow Enterprise platform running in 10 minutes!**

## Prerequisites

- Node.js 18+ installed
- Git installed
- SnowCode or Claude Code installed
- ServiceNow developer instance (optional for testing)

---

## 📦 Step 1: Build All Components (2 minutes)

```bash
# Navigate to enterprise directory
cd snow-flow-enterprise

# Build enterprise package
npm install
npm run build

# Build license server (backend)
cd license-server
npm install
npm run build:backend

# Build frontend (admin UI)
cd frontend
npm install
npm run build
cd ../..

# Build MCP proxy
cd mcp-proxy
npm install
npm run build
cd ..
```

---

## 🗄️ Step 2: Initialize Database (30 seconds)

```bash
cd license-server

# Create and initialize database with test licenses
node dist/scripts/init-db.js
node dist/scripts/seed-licenses.js

cd ..
```

**Test licenses created:**
- `SNOW-TEAM-*` - Team tier (3 instances, Jira)
- `SNOW-PRO-*` - Professional tier (10 instances, Jira + ML)
- `SNOW-ENT-1B2BB5BF` - **Enterprise tier (999 instances, all features)** ✅ Use this one!

---

## 🔧 Step 3: Configure Environment (1 minute)

### License Server Configuration

```bash
cd license-server

# .env file is already created with defaults
# Edit if needed:
# - PORT=3000
# - ADMIN_KEY=test-admin-key-12345
# - DB_PATH=./data/licenses.db
```

### MCP Proxy Configuration

```bash
cd ../mcp-proxy

# .env file is already created with defaults
# Key settings:
# - SNOW_ENTERPRISE_URL=http://localhost:3000
# - SNOW_LICENSE_KEY=SNOW-ENT-1B2BB5BF

# Add your own credentials (optional):
nano .env
```

Add your ServiceNow/Jira/Azure DevOps credentials if testing integrations.

---

## 🚀 Step 4: Start License Server (30 seconds)

```bash
cd ../license-server
node dist/index.js
```

**You should see:**
```
info: Server started on port 3000
info: License server ready
info: Admin UI: http://localhost:3000
info: MCP endpoint: http://localhost:3000/mcp/tools/list
```

**Test it:**
```bash
# In a new terminal
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":...,"uptime":...}
```

---

## 🔗 Step 5: Configure Snow-Flow with Enterprise (2 minutes)

### Option A: Using `snow-flow auth login` (Recommended)

```bash
cd ../../snow-flow  # Go back to snow-flow directory
npm run build       # Build if not already built
node dist/cli.js auth login
```

Follow the prompts:
1. **ServiceNow auth**: Configure your instance (or skip if already done)
2. **Enterprise Features**: Select `Yes`
3. **License key**: `SNOW-ENT-1B2BB5BF`
4. **License server URL**: `http://localhost:3000`
5. **Integrations**: Select Jira/Azure DevOps/Confluence (optional)

This will automatically:
- Save credentials to `.env`
- Configure MCP proxy in `~/.snowcode/config.json`
- Set up enterprise MCP server for SnowCode/Claude Code

### Option B: Manual Configuration

Create/edit `~/.snowcode/config.json`:

```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["/absolute/path/to/snow-flow-enterprise/mcp-proxy/dist/enterprise-proxy.js"],
      "env": {
        "SNOW_ENTERPRISE_URL": "http://localhost:3000",
        "SNOW_LICENSE_KEY": "SNOW-ENT-1B2BB5BF",
        "JIRA_BASE_URL": "https://yourcompany.atlassian.net",
        "JIRA_EMAIL": "you@company.com",
        "JIRA_API_TOKEN": "your-token"
      }
    }
  }
}
```

---

## ✅ Step 6: Test End-to-End (2 minutes)

### Test License Validation

```bash
curl -X POST http://localhost:3000/validate \
  -H "Content-Type: application/json" \
  -d '{
    "key": "SNOW-ENT-1B2BB5BF",
    "version": "1.0.0",
    "instanceId": "test-001",
    "timestamp": '$(date +%s)'
  }'
```

Expected: `{"valid":true,"tier":"enterprise",...}`

### Test MCP Tools Endpoint

```bash
curl -X POST http://localhost:3000/mcp/tools/list \
  -H "Authorization: Bearer SNOW-ENT-1B2BB5BF" \
  -H "Content-Type: application/json"
```

Expected: `{"success":true,"tools":[...],"count":43}`

### Test Admin UI

Open browser: `http://localhost:3000`

Login with: `test-admin-key-12345`

You should see:
- License dashboard
- Customer management
- Analytics
- 4 test licenses

### Test with SnowCode/Claude Code

1. Restart SnowCode/Claude Code
2. Open a conversation
3. Ask: **"What Jira tools are available?"**

Expected response:
```
I have access to these enterprise Jira tools:
- snow_jira_sync_backlog
- snow_jira_get_issue
- snow_jira_create_issue
- snow_jira_update_issue
- snow_jira_search_issues
- snow_jira_add_comment
- snow_jira_transition_issue
- snow_jira_get_transitions
```

---

## 🎉 Success! What's Next?

### Local Development

You now have a fully functional enterprise platform running locally:
- ✅ License server with validation
- ✅ Admin UI for license management
- ✅ MCP proxy for enterprise tools
- ✅ Jira/Azure DevOps/Confluence integrations ready
- ✅ SnowCode/Claude Code integration

### Testing Enterprise Tools

Try these commands in SnowCode/Claude Code:

```
"Sync Jira project PROJ to ServiceNow"
"Get Jira issue PROJ-123"
"Search Jira for high priority bugs"
"List Azure DevOps work items"
"Get Confluence page about deployment"
```

### Production Deployment

Ready to deploy? Follow these guides:

1. **Deploy License Server to GCP Cloud Run**
   - See: `GCP-DEPLOYMENT-GUIDE.md`
   - Update license server URL to production
   - Configure proper admin keys

2. **Sell to Service Integrators**
   - Capgemini, EY, Deloitte, PwC, KPMG
   - Generate company-specific license keys
   - Apply branded themes
   - Track usage and billing

3. **Monitor & Scale**
   - Admin UI shows real-time usage
   - Track tool calls per customer
   - Monitor license compliance
   - Scale Cloud Run as needed

---

## 🐛 Troubleshooting

### License Server Won't Start

**Error:** `Cannot open database because the directory does not exist`
```bash
cd license-server
node dist/scripts/init-db.js
```

**Error:** `Port 3000 already in use`
```bash
lsof -ti:3000 | xargs kill -9
```

### MCP Proxy Not Working

**Check configuration:**
```bash
cat ~/.snowcode/config.json
# Should have "snow-flow-enterprise" server
```

**Check proxy can connect:**
```bash
cd mcp-proxy
node dist/enterprise-proxy.js
# Should show: "Enterprise MCP Proxy running"
```

### SnowCode Doesn't See Tools

1. **Restart SnowCode/Claude Code** (config only loads on startup)
2. **Check logs:** `~/.snowcode/logs/`
3. **Verify license key** in config matches test license
4. **Test manually:**
   ```bash
   curl http://localhost:3000/mcp/tools/list \
     -H "Authorization: Bearer SNOW-ENT-1B2BB5BF"
   ```

---

## 📚 Further Reading

- `PLATFORM-ARCHITECTURE.md` - Complete platform architecture
- `MCP-SERVER-REFERENCE.md` - All 43 MCP tools documented
- `JIRA-INTEGRATION-GUIDE.md` - Jira integration details
- `AZDO-INTEGRATION-GUIDE.md` - Azure DevOps integration
- `CONFLUENCE-INTEGRATION-GUIDE.md` - Confluence integration
- `GCP-DEPLOYMENT-GUIDE.md` - Production deployment

---

## 🎯 Summary

You now have:
✅ Complete enterprise platform running locally
✅ License server with test licenses
✅ Admin UI for management
✅ MCP proxy connected to SnowCode/Claude Code
✅ 43 enterprise tools available
✅ Ready for testing and development

**Total setup time:** ~10 minutes
**Total components:** 4 (enterprise package, license server, admin UI, MCP proxy)
**Total MCP tools:** 43
**Status:** 🟢 Production Ready

**Need help?** Check troubleshooting section or review the detailed guides in the `docs/` directory.
