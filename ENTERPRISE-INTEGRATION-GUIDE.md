# Enterprise Integration Guide

**Version:** 1.0.0
**Date:** 2025-10-22
**Status:** 🔄 IN PROGRESS

## 🎯 Overview

This guide explains how to connect the **open source Snow-Flow** with the **Enterprise License Server** to enable:

- ✅ Remote MCP tool execution via HTTP
- ✅ License validation per customer
- ✅ Complete usage tracking
- ✅ Multi-tenant isolation
- ✅ Enterprise integrations (Jira, Azure DevOps, Confluence)

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│  Open Source Snow-Flow (Local)      │
│  - Claude Code / OpenCode           │
│  - MCP Client (stdio/http)          │
│  - ServiceNow credentials           │
└─────────────┬───────────────────────┘
              │
              │ HTTPS with License Key
              │
┌─────────────▼───────────────────────┐
│  Enterprise License Server (GCP)    │
│  - License validation               │
│  - MCP HTTP endpoints               │
│  - Tool execution (Jira/Azure/etc.) │
│  - Usage tracking                   │
│  - SSO/SAML authentication          │
└─────────────┬───────────────────────┘
              │
              │ API Calls
              │
┌─────────────▼───────────────────────┐
│  External Services                  │
│  - Jira Cloud                       │
│  - Azure DevOps                     │
│  - Confluence                       │
│  - ServiceNow                       │
└─────────────────────────────────────┘
```

**Key Benefits:**
- ✅ **Code Privacy** - Enterprise integrations stay on server
- ✅ **License Control** - Per-customer validation
- ✅ **Usage Tracking** - Complete audit trail
- ✅ **Easy Updates** - Deploy once, all customers updated
- ✅ **Multi-tenant** - Service integrators can resell

## 🔌 Integration Methods

### Method 1: MCP HTTP Proxy (RECOMMENDED)

Create a local MCP proxy that forwards requests to the enterprise server.

**File:** `src/mcp/enterprise-proxy.ts`

```typescript
#!/usr/bin/env node
/**
 * Enterprise MCP Proxy
 *
 * Forwards MCP requests to enterprise license server via HTTP.
 * This allows Claude Code to use enterprise tools transparently.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import axios, { AxiosInstance } from 'axios';

// Configuration from environment variables
const LICENSE_SERVER_URL = process.env.SNOW_ENTERPRISE_URL || 'https://license-server.run.app';
const LICENSE_KEY = process.env.SNOW_LICENSE_KEY || '';

// ServiceNow credentials (passed to enterprise server)
const SNOW_INSTANCE_URL = process.env.SNOW_INSTANCE_URL || '';
const SNOW_USERNAME = process.env.SNOW_USERNAME || '';
const SNOW_PASSWORD = process.env.SNOW_PASSWORD || '';

// Jira credentials (optional)
const JIRA_BASE_URL = process.env.JIRA_BASE_URL || '';
const JIRA_EMAIL = process.env.JIRA_EMAIL || '';
const JIRA_API_TOKEN = process.env.JIRA_API_TOKEN || '';

// Azure DevOps credentials (optional)
const AZDO_ORG_URL = process.env.AZDO_ORG_URL || '';
const AZDO_PAT = process.env.AZDO_PAT || '';

// Confluence credentials (optional)
const CONFLUENCE_BASE_URL = process.env.CONFLUENCE_BASE_URL || '';
const CONFLUENCE_EMAIL = process.env.CONFLUENCE_EMAIL || '';
const CONFLUENCE_API_TOKEN = process.env.CONFLUENCE_API_TOKEN || '';

class EnterpriseProxyServer {
  private server: Server;
  private httpClient: AxiosInstance;
  private availableTools: any[] = [];

  constructor() {
    this.server = new Server(
      {
        name: 'snow-flow-enterprise-proxy',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Create HTTP client for license server
    this.httpClient = axios.create({
      baseURL: LICENSE_SERVER_URL,
      headers: {
        'Authorization': `Bearer ${LICENSE_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // 2 minutes for long-running tools
    });

    this.setupHandlers();
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler('tools/list', async () => {
      try {
        // Fetch available tools from enterprise server
        const response = await this.httpClient.get('/mcp/tools/list');
        this.availableTools = response.data.tools || [];

        return {
          tools: this.availableTools
        };
      } catch (error: any) {
        console.error('Failed to fetch tools:', error.message);
        return { tools: [] };
      }
    });

    // Call tool handler
    this.server.setRequestHandler('tools/call', async (request) => {
      try {
        const { name, arguments: args } = request.params;

        // Build credentials object from environment variables
        const credentials: any = {
          servicenow: {
            instanceUrl: SNOW_INSTANCE_URL,
            username: SNOW_USERNAME,
            password: SNOW_PASSWORD
          }
        };

        // Add Jira credentials if configured
        if (JIRA_BASE_URL && JIRA_EMAIL && JIRA_API_TOKEN) {
          credentials.jira = {
            baseUrl: JIRA_BASE_URL,
            email: JIRA_EMAIL,
            apiToken: JIRA_API_TOKEN
          };
        }

        // Add Azure DevOps credentials if configured
        if (AZDO_ORG_URL && AZDO_PAT) {
          credentials.azdo = {
            orgUrl: AZDO_ORG_URL,
            pat: AZDO_PAT
          };
        }

        // Add Confluence credentials if configured
        if (CONFLUENCE_BASE_URL && CONFLUENCE_EMAIL && CONFLUENCE_API_TOKEN) {
          credentials.confluence = {
            baseUrl: CONFLUENCE_BASE_URL,
            email: CONFLUENCE_EMAIL,
            apiToken: CONFLUENCE_API_TOKEN
          };
        }

        // Call enterprise server
        const response = await this.httpClient.post('/mcp/tools/call', {
          tool: name,
          arguments: args,
          credentials: credentials
        });

        if (!response.data.success) {
          throw new Error(response.data.error || 'Tool execution failed');
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response.data.result, null, 2)
            }
          ]
        };
      } catch (error: any) {
        console.error('Tool execution error:', error.message);
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Enterprise MCP Proxy running on stdio');
  }
}

// Start server
const proxy = new EnterpriseProxyServer();
proxy.run().catch(console.error);
```

### Method 2: Direct HTTP Configuration (OpenCode >= 2.0)

**When OpenCode/Claude Code supports HTTP transport directly:**

```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "transport": "http",
      "url": "https://your-license-server.run.app/mcp",
      "headers": {
        "Authorization": "Bearer SNOW-ENT-GLOB-ABC123"
      },
      "timeout": 120000
    }
  }
}
```

## 🛠️ Setup Instructions

### Step 1: Install Enterprise Proxy

**In your open source Snow-Flow directory:**

```bash
# Copy enterprise proxy to MCP directory
cp enterprise/mcp-proxy/enterprise-proxy.ts src/mcp/

# Build the proxy
npm run build

# Verify it works
node dist/mcp/enterprise-proxy.js
```

### Step 2: Configure OpenCode

**Update `.opencode/config.json` or `opencode-config.json`:**

```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "node",
      "args": ["dist/mcp/enterprise-proxy.js"],
      "env": {
        "SNOW_ENTERPRISE_URL": "https://your-license-server.run.app",
        "SNOW_LICENSE_KEY": "SNOW-ENT-GLOB-ABC123",
        "SNOW_INSTANCE_URL": "https://dev123456.service-now.com",
        "SNOW_USERNAME": "admin",
        "SNOW_PASSWORD": "password",
        "JIRA_BASE_URL": "https://company.atlassian.net",
        "JIRA_EMAIL": "user@company.com",
        "JIRA_API_TOKEN": "your-jira-token",
        "AZDO_ORG_URL": "https://dev.azure.com/your-org",
        "AZDO_PAT": "your-azure-pat",
        "CONFLUENCE_BASE_URL": "https://company.atlassian.net/wiki",
        "CONFLUENCE_EMAIL": "user@company.com",
        "CONFLUENCE_API_TOKEN": "your-confluence-token"
      }
    }
  }
}
```

### Step 3: Test Connection

**Test the enterprise proxy:**

```bash
# 1. Start the proxy manually
SNOW_ENTERPRISE_URL=https://your-license-server.run.app \
SNOW_LICENSE_KEY=SNOW-ENT-GLOB-ABC123 \
SNOW_INSTANCE_URL=https://dev123456.service-now.com \
SNOW_USERNAME=admin \
SNOW_PASSWORD=password \
node dist/mcp/enterprise-proxy.js

# 2. In another terminal, test with MCP inspector
npx @modelcontextprotocol/inspector node dist/mcp/enterprise-proxy.js

# 3. Try listing tools
# 4. Try calling a tool
```

### Step 4: Use in Claude Code

**Once configured, tools are available automatically:**

```
User: "Create a Jira ticket for the authentication bug"

Claude Code:
- Sees snow_jira_create_issue tool available
- Calls enterprise proxy
- Proxy forwards to license server
- License server validates license
- License server creates Jira ticket
- Result returned to Claude Code
- Claude confirms to user
```

## 🔐 Security Considerations

### 1. License Key Security

**❌ DON'T:**
- Commit license keys to git
- Share license keys in public repos
- Hardcode license keys in source code

**✅ DO:**
- Store in environment variables
- Use `.env` files (gitignored)
- Use secrets management (GCP Secret Manager, etc.)

**Example `.env` file:**

```bash
# Enterprise License Server
SNOW_ENTERPRISE_URL=https://license-server.run.app
SNOW_LICENSE_KEY=SNOW-ENT-GLOB-ABC123

# ServiceNow Credentials
SNOW_INSTANCE_URL=https://dev123456.service-now.com
SNOW_USERNAME=admin
SNOW_PASSWORD=password

# Jira Credentials (optional)
JIRA_BASE_URL=https://company.atlassian.net
JIRA_EMAIL=user@company.com
JIRA_API_TOKEN=your-token-here

# Azure DevOps Credentials (optional)
AZDO_ORG_URL=https://dev.azure.com/your-org
AZDO_PAT=your-pat-here

# Confluence Credentials (optional)
CONFLUENCE_BASE_URL=https://company.atlassian.net/wiki
CONFLUENCE_EMAIL=user@company.com
CONFLUENCE_API_TOKEN=your-token-here
```

### 2. HTTPS Only

**Always use HTTPS for license server:**
- Encrypts license keys in transit
- Protects credentials
- Prevents man-in-the-middle attacks

### 3. Credential Isolation

**Credentials are sent per-request:**
- Never stored on license server
- Used only for that specific tool execution
- Sanitized before logging

## 📊 Usage Tracking

Every tool call is logged in the license server database:

```sql
-- View your usage
SELECT
  tool_name,
  tool_category,
  COUNT(*) as call_count,
  AVG(duration_ms) as avg_duration,
  SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_calls
FROM mcp_usage
WHERE customer_id = 123
  AND timestamp > strftime('%s', 'now', '-30 days') * 1000
GROUP BY tool_name, tool_category
ORDER BY call_count DESC;
```

**Analytics Available:**
- Total API calls per customer
- Tool usage breakdown (Jira vs Azure vs Confluence)
- Success/failure rates
- Average response times
- Usage over time

## 🚀 Deployment Checklist

### For Service Integrators

**1. Deploy License Server to GCP:**
- [ ] Create GCP project
- [ ] Deploy to Cloud Run
- [ ] Configure custom domain
- [ ] Enable HTTPS
- [ ] Set up monitoring

**2. Create Customer Accounts:**
- [ ] Generate license keys
- [ ] Create customer records in database
- [ ] Configure SSO (if needed)
- [ ] Send onboarding email

**3. Provide Configuration:**
- [ ] Share license server URL
- [ ] Provide license key
- [ ] Share setup instructions
- [ ] Provide example configs

### For Customers

**1. Install Open Source Snow-Flow:**
```bash
git clone https://github.com/your-org/snow-flow
cd snow-flow
npm install
npm run build
```

**2. Configure Enterprise Connection:**
```bash
# Create .env file
cp .env.example .env

# Edit .env with your credentials
nano .env
```

**3. Configure OpenCode:**
```bash
# Update OpenCode config
nano .opencode/config.json
```

**4. Test Connection:**
```bash
# Test enterprise proxy
npm run test:enterprise

# Or manually:
node dist/mcp/enterprise-proxy.js
```

**5. Use with Claude Code:**
```bash
# Claude Code automatically picks up MCP servers
# Just start using the tools!
```

## 🎯 What's Next?

### Phase 1: Current Status ✅
- ✅ License server with MCP HTTP endpoints
- ✅ Complete enterprise integrations (Jira/Azure/Confluence)
- ✅ SSO/SAML authentication
- ✅ Audit logging
- 🔄 Enterprise proxy implementation (IN PROGRESS)

### Phase 2: UI Dashboard (Next)
- [ ] React Admin UI for service integrators
- [ ] Customer management dashboard
- [ ] License key generation UI
- [ ] SSO configuration wizard
- [ ] Usage analytics dashboards

### Phase 3: GCP Deployment
- [ ] Deploy license server to Cloud Run
- [ ] Configure custom domain
- [ ] Set up CI/CD pipeline
- [ ] Configure monitoring/alerting
- [ ] Production hardening

## 📚 Additional Resources

**License Server Documentation:**
- [SSO Integration Guide](SSO-INTEGRATION-GUIDE.md)
- [Jira Integration Guide](JIRA-INTEGRATION-GUIDE.md)
- [Azure DevOps Integration Guide](AZURE-DEVOPS-INTEGRATION-GUIDE.md)
- [Confluence Integration Guide](CONFLUENCE-INTEGRATION-GUIDE.md)

**API References:**
- License Server API: `https://your-server.run.app/api/admin`
- MCP HTTP API: `https://your-server.run.app/mcp`
- SSO API: `https://your-server.run.app/sso`

**Support:**
- Email: support@snow-flow.com
- Documentation: https://docs.snow-flow.com
- GitHub Issues: https://github.com/your-org/snow-flow/issues

---

**Status:** 🔄 IN PROGRESS - Enterprise proxy implementation needed
**Next Step:** Implement MCP HTTP proxy for client connection
