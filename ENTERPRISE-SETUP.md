# Snow-Flow Enterprise MCP Server Setup

## Overview

Snow-Flow Enterprise is an **optional** premium service that provides 26+ advanced integration tools for:
- Jira (issues, sprints, boards, workflows)
- Azure DevOps (work items, pipelines, repos)
- Confluence (spaces, pages, content management)
- Bi-directional ServiceNow sync
- AI-powered planning and analytics

**Note:** The enterprise server is NOT required for normal Snow-Flow usage. The open-source version includes 235+ ServiceNow tools and full orchestration capabilities.

## Prerequisites

- Active Snow-Flow Enterprise license
- JWT authentication token from https://portal.snow-flow.dev

## Installation

### 1. Get Your Enterprise Token

Visit https://portal.snow-flow.dev and:
1. Log in with your enterprise credentials
2. Navigate to "API Tokens"
3. Generate a new JWT token
4. Copy the token (starts with `eyJ...`)

### 2. Add Enterprise Server to SnowCode Config

Edit `~/.snowcode/snowcode.json` and add the enterprise server:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "tui": {
    "scroll_speed": 5
  },
  "mcp": {
    "servicenow-unified": {
      "type": "local",
      "command": ["node", "/path/to/snow-flow/dist/mcp/servicenow-mcp-unified/index.js"],
      "environment": {
        "SERVICENOW_INSTANCE_URL": "https://dev12345.service-now.com",
        "SERVICENOW_CLIENT_ID": "your-client-id",
        "SERVICENOW_CLIENT_SECRET": "your-client-secret"
      },
      "enabled": true
    },
    "snow-flow-orchestration": {
      "type": "local",
      "command": ["node", "/path/to/snow-flow/dist/mcp/snow-flow-mcp.js"],
      "environment": {
        "SNOW_FLOW_ENV": "production"
      },
      "enabled": true
    },
    "snow-flow-enterprise": {
      "type": "remote",
      "url": "https://enterprise.snow-flow.dev/mcp/sse",
      "headers": {
        "Authorization": "Bearer YOUR_JWT_TOKEN_HERE"
      },
      "enabled": true
    }
  }
}
```

**Important:**
- Replace `YOUR_JWT_TOKEN_HERE` with your actual JWT token from the portal
- Set `"enabled": true` to activate the enterprise server
- Ensure the token is valid (check expiration on portal)

### 3. Verify Connection

Start SnowCode with MCP:

```bash
snowcode-with-mcp
```

You should see:

```
🚀 SnowCode + MCP Auto-Start Launcher

📡 Starting MCP servers...

🔧 Starting: servicenow-unified
   ✅ Started (PID: xxxxx)
🔧 Starting: snow-flow-orchestration
   ✅ Started (PID: xxxxx)
⏭️  Skipping remote server: snow-flow-enterprise (will connect when needed)

✅ Started 2 local MCP server(s)
🎯 Launching SnowCode...
```

The enterprise server connects on-demand via SSE when you use enterprise tools.

### 4. Test Enterprise Tools

In SnowCode, test an enterprise tool:

```javascript
// List Jira projects
await jira_list_projects({
  instance_url: "https://yourcompany.atlassian.net"
});

// Should return project data, NOT authentication errors
```

## Troubleshooting

### Error: "Non-200 status code (401)"

**Cause:** Invalid or expired JWT token

**Solution:**
1. Go to https://portal.snow-flow.dev
2. Check token status (may be expired)
3. Generate new token if needed
4. Update `~/.snowcode/snowcode.json` with new token
5. Restart SnowCode

### Error: "MCP server snow-flow-enterprise failed to connect: SSE error"

**Cause:** Network connectivity issue or server downtime

**Solution:**
1. Check internet connection
2. Visit https://status.snow-flow.dev for service status
3. If server is down, disable enterprise server temporarily:
   ```json
   "snow-flow-enterprise": {
     "enabled": false
   }
   ```

### Enterprise Tools Not Available

**Cause:** Server not enabled or license inactive

**Solution:**
1. Verify `"enabled": true` in config
2. Check license status: https://portal.snow-flow.dev/license
3. Ensure subscription is active (not expired)

## Available Enterprise Tools

Once connected, you have access to:

### Jira (10 tools)
- `jira_list_projects` - List all projects
- `jira_create_issue` - Create new issue
- `jira_update_issue` - Update existing issue
- `jira_search_issues` - JQL search
- `jira_get_board` - Get board details
- `jira_get_sprint` - Sprint information
- And more...

### Azure DevOps (8 tools)
- `azure_list_projects` - List projects
- `azure_create_work_item` - Create work item
- `azure_update_work_item` - Update work item
- `azure_get_pipeline` - Pipeline details
- `azure_run_pipeline` - Trigger pipeline
- And more...

### Confluence (8 tools)
- `confluence_list_spaces` - List spaces
- `confluence_create_page` - Create page
- `confluence_update_page` - Update page
- `confluence_search_content` - Search content
- And more...

## Pricing & Licensing

Visit https://snow-flow.dev/pricing for:
- License tiers and pricing
- Feature comparison (free vs enterprise)
- Trial options
- Volume discounts

## Support

Enterprise customers get priority support:
- Email: enterprise-support@snow-flow.dev
- Slack: https://snow-flow.dev/slack (enterprise channel)
- Response time: < 4 hours (business hours)

Community users (free tier):
- GitHub issues: https://github.com/groeimetai/snow-flow/issues
- Discussions: https://github.com/groeimetai/snow-flow/discussions

---

**Remember:** The enterprise server is completely optional. Snow-Flow's open-source version is fully functional with 235+ ServiceNow tools and orchestration capabilities.
