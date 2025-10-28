# Snow-Flow Enterprise MCP Reference

Complete reference for Snow-Flow's Model Context Protocol (MCP) architecture and toolset.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Complete Toolset (40+ Tools)](#complete-toolset)
4. [MCP Proxy](#mcp-proxy)
5. [MCP Server](#mcp-server)
6. [Setup & Configuration](#setup--configuration)
7. [Development](#development)

---

## Overview

Snow-Flow Enterprise provides **40+ MCP tools** via a remote server architecture:

```
Claude Code (Local)
  ↓ stdio
MCP Proxy (Local npm package)
  ↓ HTTPS
MCP Server (GCP Cloud Run - europe-west4)
  ↓ Validates License
  ↓ Executes Tools
  ↓ Logs Usage
  ↓ Returns Results
```

**Key Benefits:**
- ✅ **Remote execution** - integration code stays on server
- ✅ **Zero maintenance** - updates deploy without customer action
- ✅ **Usage tracking** - complete analytics per customer
- ✅ **Secure** - credentials encrypted with Google Cloud KMS
- ✅ **Scalable** - serverless Cloud Run infrastructure

---

## Architecture

### Components

**1. MCP Proxy (`mcp-proxy/`)**
- Local npm package installed by customer
- Bridges Claude Code (stdio) ↔ Remote MCP Server (HTTPS)
- Handles authentication (license key)
- Manages connection lifecycle

**2. MCP Server (`mcp-server/`)**
- Express.js server on Cloud Run
- Exposes `/mcp` endpoint (SSE protocol)
- Validates licenses
- Routes tool calls to integrations
- Logs usage to MySQL

**3. Portal (`portal/`)**
- Web dashboard for customers & service integrators
- Credential management (KMS-encrypted)
- Usage analytics
- License management (admin)

### Request Flow

```
1. Claude Code calls tool: snow_jira_get_issue({ issueKey: "PROJ-123" })
   ↓
2. MCP Proxy receives via stdio
   ↓
3. MCP Proxy sends HTTPS POST to MCP Server:
   POST https://enterprise.snow-flow.dev/mcp
   Headers:
     X-License-Key: SNOW-TEAM-XXXX-XXXX-XXXX-XXXX
   Body:
     { method: "tools/call", params: { name: "snow_jira_get_issue", arguments: {...} }}
   ↓
4. MCP Server validates license in MySQL
   ↓
5. MCP Server gets Jira credentials (decrypts from KMS)
   ↓
6. MCP Server calls Jira API
   ↓
7. MCP Server maps response to ServiceNow format
   ↓
8. MCP Server logs usage (customer_id, tool, duration, success)
   ↓
9. MCP Server returns result
   ↓
10. MCP Proxy returns to Claude Code via stdio
```

---

## Complete Toolset

### Jira Integration (8 tools)

| Tool | Description | Tier |
|------|-------------|------|
| `snow_jira_sync_backlog` | Sync Jira backlog to ServiceNow | Team+ |
| `snow_jira_get_issue` | Get detailed issue information | Team+ |
| `snow_jira_create_issue` | Create Jira issues | Team+ |
| `snow_jira_update_issue` | Update existing issues | Team+ |
| `snow_jira_transition_issue` | Transition issue workflow | Pro+ |
| `snow_jira_search_issues` | Advanced JQL search | Pro+ |
| `snow_jira_add_comment` | Add comments to issues | Pro+ |
| `snow_jira_get_transitions` | Get available transitions | Pro+ |

### Azure DevOps Integration (10 tools)

| Tool | Description | Tier |
|------|-------------|------|
| `snow_azdo_sync_backlog` | Sync work items to ServiceNow | Pro+ |
| `snow_azdo_get_work_item` | Get detailed work item info | Pro+ |
| `snow_azdo_create_work_item` | Create work items | Pro+ |
| `snow_azdo_update_work_item` | Update work items | Pro+ |
| `snow_azdo_query_work_items` | Query with WIQL | Pro+ |
| `snow_azdo_list_pipelines` | List build/release pipelines | Pro+ |
| `snow_azdo_run_pipeline` | Trigger pipeline execution | Pro+ |
| `snow_azdo_get_build_status` | Get build status | Pro+ |
| `snow_azdo_list_repos` | List Git repositories | Pro+ |
| `snow_azdo_get_pull_requests` | Get PR information | Pro+ |

### Confluence Integration (8 tools)

| Tool | Description | Tier |
|------|-------------|------|
| `snow_confluence_sync_space` | Sync space to ServiceNow KB | Pro+ |
| `snow_confluence_get_page` | Get page content | Pro+ |
| `snow_confluence_create_page` | Create new pages | Pro+ |
| `snow_confluence_update_page` | Update existing pages | Pro+ |
| `snow_confluence_search_pages` | Search with CQL | Enterprise |
| `snow_confluence_list_spaces` | List available spaces | Enterprise |
| `snow_confluence_get_page_tree` | Get page hierarchy | Enterprise |
| `snow_confluence_get_attachments` | Get page attachments | Enterprise |

### ML & Analytics (15 tools)

| Tool | Description | Tier |
|------|-------------|------|
| `snow_ml_predict_priority` | Predict incident priority | Pro+ |
| `snow_ml_predict_assignment` | Predict best assignee | Pro+ |
| `snow_ml_predict_resolution_time` | Estimate resolution time | Pro+ |
| `snow_ml_detect_anomalies` | Detect unusual patterns | Enterprise |
| `snow_ml_cluster_incidents` | Cluster similar incidents | Enterprise |
| `snow_ml_sentiment_analysis` | Analyze customer sentiment | Enterprise |
| `snow_ml_forecast_volume` | Forecast ticket volume | Enterprise |
| `snow_ml_recommend_articles` | Recommend KB articles | Enterprise |
| `snow_ml_auto_categorize` | Auto-categorize incidents | Enterprise |
| `snow_ml_risk_assessment` | Assess change risk | Enterprise |
| `snow_analytics_dashboard` | Generate analytics dashboard | Pro+ |
| `snow_analytics_report` | Generate custom reports | Pro+ |
| `snow_analytics_trends` | Analyze trends | Pro+ |
| `snow_analytics_kpi` | Calculate KPIs | Enterprise |
| `snow_analytics_export` | Export data for BI tools | Enterprise |

---

## MCP Proxy

### Installation

```bash
# Via Claude Desktop config
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "npx",
      "args": ["-y", "@snow-flow/mcp-proxy", "--license-key", "YOUR-KEY"]
    }
  }
}

# Or manual install
npm install -g @snow-flow/mcp-proxy
snow-flow-mcp-proxy --license-key YOUR-KEY
```

### Configuration

**Environment Variables:**
```bash
SNOW_FLOW_LICENSE_KEY=SNOW-TEAM-XXXX-XXXX-XXXX-XXXX
SNOW_FLOW_SERVER_URL=https://enterprise.snow-flow.dev  # Optional
SNOW_FLOW_TIMEOUT=30000  # Optional, default 30s
```

**CLI Options:**
```bash
snow-flow-mcp-proxy \
  --license-key SNOW-TEAM-XXXX \
  --server-url https://enterprise.snow-flow.dev \
  --timeout 30000 \
  --verbose
```

### Features

- ✅ Automatic reconnection on network failures
- ✅ Request retries with exponential backoff
- ✅ License key validation caching (5 minutes)
- ✅ Connection health monitoring
- ✅ Detailed logging (use `--verbose` flag)

---

## MCP Server

### Endpoints

**1. `/mcp` - Main MCP endpoint**
- Protocol: Server-Sent Events (SSE)
- Methods: `initialize`, `tools/list`, `tools/call`
- Authentication: `X-License-Key` header

**2. `/health` - Health check**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "database": "connected",
  "uptime": 123456
}
```

**3. `/api/validate` - License validation**
```bash
curl https://enterprise.snow-flow.dev/api/validate \
  -H "X-License-Key: YOUR-KEY"
```

### Deployment

**Cloud Run (Production):**
```bash
# Deploy via Cloud Build trigger (automatic on git push)
git push origin main

# Or manual deploy
gcloud run deploy snow-flow-enterprise \
  --source . \
  --region europe-west4 \
  --allow-unauthenticated \
  --set-env-vars NODE_ENV=production,USE_CLOUD_SQL=true
```

**Local Development:**
```bash
cd mcp-server
npm install
npm run dev  # Runs on http://localhost:3000
```

### Architecture

```
src/
├── index.ts              # Express server
├── mcp-handler.ts        # MCP protocol implementation
├── integrations/
│   ├── jira-client.ts    # Jira API wrapper
│   ├── azdo-client.ts    # Azure DevOps API wrapper
│   └── confluence-client.ts # Confluence API wrapper
├── ml/
│   ├── predictor.ts      # ML prediction models
│   └── analytics.ts      # Analytics engine
└── utils/
    ├── logger.ts         # Winston logger
    └── validator.ts      # Input validation
```

---

## Setup & Configuration

### For Customers

**1. Get License Key**
- Purchase from https://snow-flow.dev/pricing
- Or request trial key

**2. Install MCP Proxy**
```bash
# Add to Claude Desktop config
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "npx",
      "args": ["-y", "@snow-flow/mcp-proxy", "--license-key", "YOUR-KEY"]
    }
  }
}
```

**3. Add Service Credentials**
- Login to portal: https://portal.snow-flow.dev
- Navigate to Settings → Integrations
- Add Jira/Azure DevOps/Confluence credentials

**4. Test**
```typescript
// In Claude Code
await snow_jira_search_issues({
  jql: "project = PROJ ORDER BY created DESC",
  maxResults: 1
});
```

### For Service Integrators

**1. Get Master License**
- Contact sales@snow-flow.dev
- Receive `SNOW-SI-XXXX` master key

**2. Create Customer Licenses**
```bash
# Via Portal Admin API
curl https://portal.snow-flow.dev/api/admin/licenses \
  -H "X-Admin-Key: YOUR-ADMIN-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceIntegratorId": 1,
    "tier": "pro",
    "customerName": "Acme Corp",
    "contactEmail": "admin@acme.com"
  }'
```

**3. White-Label Portal**
- Configure custom domain
- Upload logo
- Customize theme

---

## Development

### Local Development Setup

```bash
# 1. Clone repo
git clone https://github.com/your-org/snow-flow-enterprise
cd snow-flow-enterprise

# 2. Install dependencies
npm install

# 3. Setup local MySQL
docker run -d \
  --name snow-flow-mysql \
  -e MYSQL_ROOT_PASSWORD=dev-password \
  -e MYSQL_DATABASE=licenses \
  -p 3306:3306 \
  mysql:8.4

# 4. Configure environment
cd mcp-server
cp .env.example .env
# Edit .env with local MySQL credentials

# 5. Run migrations
npm run db:migrate

# 6. Start MCP server
npm run dev  # http://localhost:3000

# 7. Start portal (separate terminal)
cd ../portal/backend
npm run dev  # http://localhost:8080
```

### Testing MCP Server Locally

```bash
# Test with MCP proxy pointing to localhost
npx @snow-flow/mcp-proxy \
  --license-key SNOW-TEAM-TEST \
  --server-url http://localhost:3000 \
  --verbose
```

### Adding New Tools

**1. Create tool handler:**
```typescript
// mcp-server/src/integrations/my-integration.ts
export async function myNewTool(params: { param1: string }) {
  // Implement tool logic
  return { success: true, data: {...} };
}
```

**2. Register tool:**
```typescript
// mcp-server/src/mcp-handler.ts
{
  name: "snow_my_new_tool",
  description: "Does something awesome",
  inputSchema: {
    type: "object",
    properties: {
      param1: { type: "string", description: "Parameter 1" }
    },
    required: ["param1"]
  }
}
```

**3. Add route:**
```typescript
// mcp-server/src/mcp-handler.ts
case "snow_my_new_tool":
  return await myNewTool(params);
```

**4. Test:**
```bash
curl http://localhost:3000/mcp \
  -H "X-License-Key: TEST-KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "snow_my_new_tool",
      "arguments": { "param1": "test" }
    }
  }'
```

---

## API Reference

### MCP Protocol

**Initialize:**
```json
{
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "snow-flow-mcp-proxy",
      "version": "1.0.0"
    }
  }
}
```

**List Tools:**
```json
{
  "method": "tools/list"
}
```

**Call Tool:**
```json
{
  "method": "tools/call",
  "params": {
    "name": "snow_jira_get_issue",
    "arguments": {
      "issueKey": "PROJ-123"
    }
  }
}
```

### Response Format

**Success:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "{ \"key\": \"PROJ-123\", \"summary\": \"Fix bug\" }"
    }
  ]
}
```

**Error:**
```json
{
  "error": {
    "code": "INVALID_LICENSE",
    "message": "License key is invalid or expired"
  }
}
```

---

## Troubleshooting

### Common Issues

**❌ "Connection refused"**
- Check MCP server is running
- Verify server URL is correct
- Check firewall rules

**❌ "Invalid license key"**
- Verify license key format: `SNOW-TIER-XXXX-XXXX-XXXX-XXXX`
- Check license hasn't expired
- Verify license tier has access to tool

**❌ "Rate limit exceeded"**
- Team: 100 requests/15min
- Pro: 500 requests/15min
- Enterprise: 2000 requests/15min
- Implement backoff/retry logic

**❌ "Tool not found"**
- Check tool name spelling
- Verify tier has access to tool
- Update MCP proxy: `npx -y @snow-flow/mcp-proxy@latest`

### Debug Mode

```bash
# Enable verbose logging
snow-flow-mcp-proxy \
  --license-key YOUR-KEY \
  --verbose \
  --log-level debug
```

### Health Checks

```bash
# Check MCP server health
curl https://enterprise.snow-flow.dev/health

# Validate license
curl https://enterprise.snow-flow.dev/api/validate \
  -H "X-License-Key: YOUR-KEY"

# Test tool call
curl https://enterprise.snow-flow.dev/mcp \
  -H "X-License-Key: YOUR-KEY" \
  -H "Content-Type: application/json" \
  -d '{"method":"tools/list"}'
```

---

## Performance

### Benchmarks

| Metric | Value |
|--------|-------|
| Average latency | 150ms |
| P95 latency | 500ms |
| P99 latency | 1000ms |
| Throughput | 1000 req/sec |
| Uptime | 99.9% SLA |

### Optimization Tips

1. **Batch requests** - Use search/query tools instead of multiple get calls
2. **Cache results** - Cache frequently accessed data locally
3. **Parallel calls** - Use `Promise.all()` for independent requests
4. **Rate limiting** - Implement exponential backoff
5. **Connection pooling** - MCP proxy maintains persistent connection

---

## Security

### Best Practices

1. **Never commit license keys** - Use environment variables
2. **Rotate credentials** - Change API tokens regularly
3. **Use KMS encryption** - Enable for production deployments
4. **Monitor usage** - Check portal for unusual activity
5. **Limit permissions** - Use principle of least privilege

### Compliance

- ✅ **SOC 2 Type II** ready
- ✅ **ISO 27001** ready
- ✅ **GDPR** compliant
- ✅ **HIPAA** compatible (with BAA)
- ✅ **PCI-DSS** Level 1 ready

---

## Support

- **Documentation**: https://docs.snow-flow.dev
- **Portal**: https://portal.snow-flow.dev
- **Issues**: support@snow-flow.dev
- **Enterprise Support**: 24/7 available for Enterprise tier
- **GitHub**: https://github.com/your-org/snow-flow-enterprise

---

**Version:** 2.0.0
**Last Updated:** 2025-10-28
