# MCP HTTP Server Reference Guide

**Base URL:** `http://localhost:8080/mcp` (development)
**Production URL:** `https://license-server-prod-xxx.run.app/mcp`
**Authentication:** Bearer token with customer license key

## 🔐 Authentication

All MCP requests require a valid customer license key in the Authorization header:

```bash
curl -H "Authorization: Bearer SNOW-ENT-GLOB-ABC123" \
  http://localhost:8080/mcp/tools/list
```

## 📊 Architecture

```
Customer Installation (local)
  ↓ HTTPS Request with License Key
Remote MCP Server (GCP Cloud Run)
  ↓ Validates License
  ↓ Executes Tool (Jira/Azure/Confluence/ML)
  ↓ Logs Usage
  ↓ Returns Result
Customer Installation (receives result)
```

**Key Benefits:**
- ✅ Your code stays private on GCP server
- ✅ License validated per request
- ✅ Complete usage tracking
- ✅ Updates deploy without customer reinstall
- ✅ True SaaS model

## 🛠️ Endpoints

### List Available Tools

**POST** `/mcp/tools/list`

Get all available MCP tools for authenticated customer.

**Headers:**
```
Authorization: Bearer SNOW-ENT-GLOB-ABC123
```

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": 1,
    "name": "GlobalCorp IT",
    "licenseKey": "SNOW-ENT-GLOB-ABC123"
  },
  "tools": [
    {
      "name": "snow_jira_sync_backlog",
      "description": "Sync Jira backlog to ServiceNow incidents/tasks",
      "category": "jira",
      "inputSchema": {
        "projectKey": { "type": "string", "required": true },
        "sprint": { "type": "string", "required": false },
        "syncToTable": { "type": "string", "required": true, "default": "incident" }
      }
    }
  ],
  "count": 43
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/mcp/tools/list \
  -H "Authorization: Bearer SNOW-ENT-GLOB-ABC123" \
  -H "Content-Type: application/json"
```

### Execute Tool

**POST** `/mcp/tools/call`

Execute a specific MCP tool.

**Headers:**
```
Authorization: Bearer SNOW-ENT-GLOB-ABC123
X-Instance-Id: abc123def456 (optional - for tracking)
X-Snow-Flow-Version: 8.2.0 (optional)
```

**Request Body:**
```json
{
  "tool": "snow_jira_sync_backlog",
  "arguments": {
    "projectKey": "PROJ",
    "sprint": "Sprint 42",
    "syncToTable": "incident",
    "maxResults": 100
  },
  "credentials": {
    "jira": {
      "host": "company.atlassian.net",
      "email": "user@company.com",
      "apiToken": "xxx"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "tool": "snow_jira_sync_backlog",
  "result": {
    "syncedIssues": 42,
    "created": 10,
    "updated": 32,
    "skipped": 0,
    "errors": []
  },
  "usage": {
    "durationMs": 5432,
    "timestamp": 1704067200000,
    "customer": "GlobalCorp IT"
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:8080/mcp/tools/call \
  -H "Authorization: Bearer SNOW-ENT-GLOB-ABC123" \
  -H "X-Instance-Id: abc123def456" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_sync_backlog",
    "arguments": {
      "projectKey": "PROJ",
      "syncToTable": "incident"
    },
    "credentials": {
      "jira": {
        "host": "company.atlassian.net",
        "email": "user@company.com",
        "apiToken": "xxx"
      }
    }
  }'
```

### Direct Tool Execution (Alternative)

**POST** `/mcp/tools/{toolName}`

Execute tool directly without wrapping in call structure.

**Example:**
```bash
curl -X POST http://localhost:8080/mcp/tools/snow_jira_sync_backlog \
  -H "Authorization: Bearer SNOW-ENT-GLOB-ABC123" \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "projectKey": "PROJ"
    },
    "credentials": {
      "jira": {
        "host": "company.atlassian.net",
        "email": "user@company.com",
        "apiToken": "xxx"
      }
    }
  }'
```

## 🔧 All 43 MCP Tools

### Jira Integration (8 tools)

| Tool Name | Description |
|-----------|-------------|
| `snow_jira_sync_backlog` | Sync Jira backlog to ServiceNow |
| `snow_jira_get_issue` | Get detailed Jira issue |
| `snow_jira_create_issue` | Create Jira issue |
| `snow_jira_update_issue` | Update Jira issue |
| `snow_jira_transition_issue` | Transition issue status |
| `snow_jira_search_issues` | Search with JQL |
| `snow_jira_get_project` | Get project details |
| `snow_jira_link_issues` | Link related issues |

**Credentials Required:**
```json
{
  "jira": {
    "host": "company.atlassian.net",
    "email": "user@company.com",
    "apiToken": "xxx"
  }
}
```

### Azure DevOps Integration (10 tools)

| Tool Name | Description |
|-----------|-------------|
| `snow_azdo_sync_work_items` | Sync Azure DevOps work items |
| `snow_azdo_get_work_item` | Get work item details |
| `snow_azdo_create_work_item` | Create work item |
| `snow_azdo_update_work_item` | Update work item |
| `snow_azdo_get_pipeline_runs` | Get pipeline history |
| `snow_azdo_trigger_pipeline` | Trigger build pipeline |
| `snow_azdo_get_pull_requests` | Get pull requests |
| `snow_azdo_create_pull_request` | Create pull request |
| `snow_azdo_get_releases` | Get release history |
| `snow_azdo_create_release` | Create release |

**Credentials Required:**
```json
{
  "azureDevOps": {
    "organization": "company",
    "pat": "xxx"
  }
}
```

### Confluence Integration (8 tools)

| Tool Name | Description |
|-----------|-------------|
| `snow_confluence_sync_pages` | Sync pages to ServiceNow KB |
| `snow_confluence_get_page` | Get page content |
| `snow_confluence_create_page` | Create page |
| `snow_confluence_update_page` | Update page |
| `snow_confluence_search` | Search with CQL |
| `snow_confluence_get_space` | Get space details |
| `snow_confluence_attach_file` | Attach file to page |
| `snow_confluence_export_page` | Export as PDF |

**Credentials Required:**
```json
{
  "confluence": {
    "host": "company.atlassian.net",
    "email": "user@company.com",
    "apiToken": "xxx"
  }
}
```

### ML & Analytics (15 tools)

| Tool Name | Description |
|-----------|-------------|
| `snow_ml_predict_incident_priority` | Predict priority using ML |
| `snow_ml_predict_incident_category` | Auto-categorize incidents |
| `snow_ml_predict_assignment_group` | Predict best assignment |
| `snow_ml_detect_duplicate_incidents` | Find similar incidents |
| `snow_ml_predict_resolution_time` | Estimate resolution time |
| `snow_ml_recommend_solutions` | Recommend KB articles |
| `snow_ml_detect_anomalies` | Detect anomaly patterns |
| `snow_ml_forecast_incident_volume` | Forecast future volume |
| `snow_ml_cluster_similar_issues` | Cluster for analysis |
| `snow_ml_sentiment_analysis` | Analyze comment sentiment |
| `snow_analytics_incident_trends` | Analyze incident trends |
| `snow_analytics_sla_performance` | SLA compliance analysis |
| `snow_analytics_agent_performance` | Agent metrics |
| `snow_analytics_change_success_rate` | Change success rates |
| `snow_analytics_custom_report` | Custom analytics |

**No external credentials required** - uses ServiceNow data only.

### SSO/SAML (2 tools)

| Tool Name | Description |
|-----------|-------------|
| `snow_configure_sso` | Configure SSO |
| `snow_configure_saml` | Configure SAML 2.0 |

## 🔒 Security & Authentication

### License Key Validation

Every request validates:
1. ✅ License key format (`SNOW-ENT-XXXX-XXXXX`)
2. ✅ Customer exists in database
3. ✅ Customer status is 'active'
4. ✅ Request logged for audit trail

### Instance Tracking

Optional headers for tracking:
- `X-Instance-Id` - Hardware fingerprint (auto-generated by client)
- `X-Snow-Flow-Version` - Client version

Benefits:
- Track which instances are using the license
- Detect unauthorized sharing
- Monitor version distribution

### Usage Logging

Every tool call logs:
- Customer ID
- Instance ID
- Tool name & category
- Timestamp & duration
- Success/failure
- Sanitized parameters (first 1KB)
- IP address

## 📊 Usage Analytics

Service integrators can view:
- Total API calls per customer
- Most used tools
- Tool category breakdown
- Success rates
- Average response times
- Geographic distribution

**Access via Admin API:**
```bash
curl http://localhost:8080/api/admin/customers/1/usage \
  -H "X-Admin-Key: admin-key"
```

## 🚨 Error Handling

### Authentication Errors

```json
{
  "success": false,
  "error": "Missing license key - provide in Authorization header"
}
```

**Status:** 401 Unauthorized

### Invalid License

```json
{
  "success": false,
  "error": "Invalid license key"
}
```

**Status:** 401 Unauthorized

### Suspended Customer

```json
{
  "success": false,
  "error": "Customer status: suspended - contact support"
}
```

**Status:** 403 Forbidden

### Tool Not Found

```json
{
  "success": false,
  "error": "Tool not found: snow_invalid_tool",
  "availableTools": ["snow_jira_sync_backlog", "..."]
}
```

**Status:** 404 Not Found

### Tool Execution Error

```json
{
  "success": false,
  "error": "Failed to connect to Jira API",
  "usage": {
    "durationMs": 1234,
    "timestamp": 1704067200000
  }
}
```

**Status:** 500 Internal Server Error

## 🧪 Testing Workflow

### 1. Setup Test Customer

```bash
# Create service integrator
curl -X POST http://localhost:8080/api/admin/si \
  -H "X-Admin-Key: test-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "companyName": "Test SI",
    "contactEmail": "admin@testsi.com",
    "billingEmail": "billing@testsi.com"
  }'

# Create customer (note the license key returned)
curl -X POST http://localhost:8080/api/admin/customers \
  -H "X-Admin-Key: test-admin-key" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceIntegratorId": 1,
    "name": "Test Customer",
    "contactEmail": "it@testcustomer.com"
  }'
```

### 2. List Available Tools

```bash
LICENSE_KEY="SNOW-ENT-TEST-ABC123"  # From step 1

curl -X POST http://localhost:8080/mcp/tools/list \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "Content-Type: application/json" | jq
```

### 3. Execute Test Tool

```bash
curl -X POST http://localhost:8080/mcp/tools/call \
  -H "Authorization: Bearer $LICENSE_KEY" \
  -H "X-Instance-Id: test-instance-001" \
  -H "Content-Type: application/json" \
  -d '{
    "tool": "snow_jira_get_issue",
    "arguments": {
      "issueKey": "PROJ-123"
    },
    "credentials": {
      "jira": {
        "host": "test.atlassian.net",
        "email": "test@test.com",
        "apiToken": "test"
      }
    }
  }' | jq
```

### 4. Check Usage Stats

```bash
curl http://localhost:8080/api/admin/customers/1/usage \
  -H "X-Admin-Key: test-admin-key" | jq
```

## 🌐 Client Integration (OpenCode/Claude Code)

### OpenCode MCP Configuration

Add to `.opencode/config.json`:

```json
{
  "mcpServers": {
    "snow-flow-core": {
      "command": "node",
      "args": ["dist/cli.js", "mcp", "servicenow-unified"],
      "env": {
        "SNOW_INSTANCE": "https://dev123.service-now.com",
        "SNOW_USERNAME": "admin",
        "SNOW_PASSWORD": "xxx"
      }
    },
    "snow-flow-enterprise": {
      "url": "https://license-server-prod-xxx.run.app/mcp",
      "headers": {
        "Authorization": "Bearer SNOW-ENT-GLOB-ABC123",
        "X-Instance-Id": "abc123def456",
        "X-Jira-Host": "company.atlassian.net",
        "X-Jira-Email": "user@company.com",
        "X-Jira-Token": "xxx",
        "X-Azdo-Org": "company",
        "X-Azdo-Pat": "xxx"
      }
    }
  }
}
```

**Note:** OpenCode will automatically call the remote server for enterprise tools!

## 📈 Performance

**Expected Response Times:**
- Tool listing: < 100ms
- Simple tools (get/search): 500-2000ms
- Sync operations: 2000-10000ms (depends on data volume)

**Rate Limits:**
- Default: 100 requests per 15 minutes per license key
- Can be increased for Enterprise customers

## 🎯 Next Steps

1. ✅ MCP server infrastructure complete
2. 🚧 Implement actual Jira integration (Week 2)
3. 🚧 Implement Azure DevOps integration (Week 3)
4. 🚧 Implement Confluence integration (Week 3)
5. 🚧 Implement ML tools (Week 4)
6. 🚧 Deploy to GCP Cloud Run (Week 5)

---

**Total Tools:** 43
**Authentication:** Bearer token (license key)
**Rate Limit:** 100/15min
**Code Location:** License server (stays private!)
