# Snow-Flow Enterprise Integrations

Complete integration guide for Jira, Azure DevOps, and Confluence with autonomous agent capabilities.

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Jira Integration](#jira-integration)
4. [Azure DevOps Integration](#azure-devops-integration)
5. [Confluence Integration](#confluence-integration)
6. [Setup & Configuration](#setup--configuration)
7. [Autonomous Agent Workflows](#autonomous-agent-workflows)

---

## Overview

Snow-Flow Enterprise provides **26 MCP tools** across three major integrations:

| Integration | Tools | Primary Use Case |
|-------------|-------|------------------|
| **Jira** | 8 tools | Autonomous backlog management |
| **Azure DevOps** | 10 tools | Autonomous DevOps workflows & pipelines |
| **Confluence** | 8 tools | Autonomous documentation management |

**Key Benefits:**
- ✅ **Server-side execution** - integration code never leaves the license server
- ✅ **Automatic field mapping** - Jira/Azure DevOps/Confluence → ServiceNow format
- ✅ **Complete usage tracking** - every API call logged
- ✅ **Zero customer maintenance** - updates deploy without reinstalls
- ✅ **AI agent ready** - designed for autonomous 24/7 operation

---

## Architecture

```
Customer Installation (Claude Code / Local)
  ↓ HTTPS Request with License Key + Service Credentials
License Server (GCP Cloud Run - europe-west4)
  ↓ Validates License & Credentials (encrypted with KMS)
  ↓ Executes Integration API Request
  ↓ Maps Response → ServiceNow Format
  ↓ Logs Usage (customer_id, tool, duration, success)
  ↓ Returns Mapped Result
Customer Installation (Receives Data)
```

**Security Features:**
- 🔐 Credentials encrypted with Google Cloud KMS (HSM-backed)
- 🔐 TLS 1.3 for all communication
- 🔐 License validation on every request
- 🔐 Rate limiting per tier (Team: 100/15min, Pro: 500/15min, Enterprise: 2000/15min)
- 🔐 Audit logging for compliance (SOC 2, ISO 27001, HIPAA ready)

---

## Jira Integration

### Tools (8)

1. **snow_jira_sync_backlog** - Sync Jira backlog to ServiceNow
2. **snow_jira_get_issue** - Get detailed issue information
3. **snow_jira_create_issue** - Create Jira issues from ServiceNow
4. **snow_jira_update_issue** - Update existing issues
5. **snow_jira_transition_issue** - Transition issues through workflow
6. **snow_jira_search_issues** - Advanced JQL search
7. **snow_jira_add_comment** - Add comments to issues
8. **snow_jira_get_transitions** - Get available transitions for issue

### Quick Start

```typescript
// 1. Sync Jira backlog to ServiceNow incidents
await snow_jira_sync_backlog({
  projectKey: "PROJ",
  status: ["To Do", "In Progress"],
  syncToTable: "incident",
  maxResults: 100
});

// 2. Create Jira issue from ServiceNow
await snow_jira_create_issue({
  projectKey: "PROJ",
  issueType: "Bug",
  summary: "Fix authentication issue",
  description: "Users unable to login",
  priority: "High"
});

// 3. Transition issue
await snow_jira_transition_issue({
  issueKey: "PROJ-123",
  transition: "In Progress",
  comment: "Starting work on this issue"
});
```

### Common Workflows

**Agent Backlog Management:**
```typescript
// Agent reads backlog
const backlog = await snow_jira_search_issues({
  jql: "project = PROJ AND status = 'To Do' ORDER BY priority DESC",
  maxResults: 50
});

// Agent prioritizes and starts work
for (const issue of backlog.issues) {
  if (issue.priority === "Critical") {
    await snow_jira_transition_issue({
      issueKey: issue.key,
      transition: "In Progress",
      comment: "🤖 Agent starting work on critical issue"
    });

    // Agent does the work...

    await snow_jira_transition_issue({
      issueKey: issue.key,
      transition: "Done",
      comment: "🤖 Agent completed work"
    });
  }
}
```

### Field Mapping (Jira → ServiceNow)

| Jira Field | ServiceNow Field | Notes |
|------------|------------------|-------|
| key | number | PROJ-123 → INC0001234 |
| summary | short_description | - |
| description | description | - |
| status | state | Mapped to ServiceNow workflow |
| priority | priority | Highest→1, High→2, etc. |
| assignee | assigned_to | Mapped to sys_user |
| created | opened_at | ISO timestamp |
| updated | updated_at | ISO timestamp |
| issuetype | category | Bug→Software, Story→Request |

---

## Azure DevOps Integration

### Tools (10)

1. **snow_azdo_sync_backlog** - Sync work items to ServiceNow
2. **snow_azdo_get_work_item** - Get detailed work item info
3. **snow_azdo_create_work_item** - Create work items
4. **snow_azdo_update_work_item** - Update work items
5. **snow_azdo_query_work_items** - Query with WIQL
6. **snow_azdo_list_pipelines** - List build/release pipelines
7. **snow_azdo_run_pipeline** - Trigger pipeline execution
8. **snow_azdo_get_build_status** - Get build status
9. **snow_azdo_list_repos** - List Git repositories
10. **snow_azdo_get_pull_requests** - Get PR information

### Quick Start

```typescript
// 1. Sync Azure DevOps backlog
await snow_azdo_sync_backlog({
  organization: "myorg",
  project: "MyProject",
  area: "MyTeam",
  workItemTypes: ["Bug", "User Story"],
  syncToTable: "incident"
});

// 2. Trigger deployment pipeline
await snow_azdo_run_pipeline({
  organization: "myorg",
  project: "MyProject",
  pipelineId: 42,
  branch: "main"
});

// 3. Monitor build status
const build = await snow_azdo_get_build_status({
  organization: "myorg",
  project: "MyProject",
  buildId: 12345
});
```

### Common Workflows

**Agent CI/CD Management:**
```typescript
// Agent monitors pull requests
const prs = await snow_azdo_get_pull_requests({
  organization: "myorg",
  project: "MyProject",
  repository: "backend",
  status: "active"
});

// Agent triggers builds for approved PRs
for (const pr of prs.value) {
  if (pr.reviewers.every(r => r.vote > 0)) {
    await snow_azdo_run_pipeline({
      organization: "myorg",
      project: "MyProject",
      pipelineId: pr.sourceBranch.pipelineId,
      branch: pr.sourceBranch.name
    });
  }
}
```

### Field Mapping (Azure DevOps → ServiceNow)

| Azure DevOps Field | ServiceNow Field | Notes |
|--------------------|------------------|-------|
| id | number | 12345 → INC0012345 |
| title | short_description | - |
| description | description | HTML stripped |
| state | state | New→1, Active→2, Resolved→6 |
| priority | priority | 1→1, 2→2, 3→3, 4→4 |
| assignedTo | assigned_to | Mapped to sys_user |
| createdDate | opened_at | ISO timestamp |
| changedDate | updated_at | ISO timestamp |
| workItemType | category | Bug→Software, Task→Request |

---

## Confluence Integration

### Tools (8)

1. **snow_confluence_sync_space** - Sync Confluence space to ServiceNow knowledge
2. **snow_confluence_get_page** - Get page content
3. **snow_confluence_create_page** - Create new pages
4. **snow_confluence_update_page** - Update existing pages
5. **snow_confluence_search_pages** - Search with CQL
6. **snow_confluence_list_spaces** - List available spaces
7. **snow_confluence_get_page_tree** - Get page hierarchy
8. **snow_confluence_get_attachments** - Get page attachments

### Quick Start

```typescript
// 1. Sync Confluence space to ServiceNow knowledge base
await snow_confluence_sync_space({
  spaceKey: "DOCS",
  syncToKB: "IT",
  includeAttachments: true
});

// 2. Create knowledge article from Confluence
await snow_confluence_create_page({
  spaceKey: "DOCS",
  title: "How to Reset Password",
  content: "<h1>Password Reset</h1><p>Steps...</p>",
  parentId: "123456"
});

// 3. Search documentation
const results = await snow_confluence_search_pages({
  cql: "space = DOCS AND text ~ 'authentication'",
  maxResults: 10
});
```

### Common Workflows

**Agent Documentation Management:**
```typescript
// Agent monitors ServiceNow knowledge base for updates
const recentKB = await snow_query_table({
  table: "kb_knowledge",
  query: "updated_atRELATIVEGT@day@ago@1",
  fields: ["number", "short_description", "text"]
});

// Agent syncs updates to Confluence
for (const article of recentKB) {
  await snow_confluence_update_page({
    pageId: article.confluence_id,
    title: article.short_description,
    content: article.text,
    version: article.confluence_version + 1
  });
}
```

### Field Mapping (Confluence → ServiceNow Knowledge)

| Confluence Field | ServiceNow KB Field | Notes |
|------------------|---------------------|-------|
| id | number | 123456 → KB0001234 |
| title | short_description | - |
| body.storage.value | text | HTML content |
| status | workflow_state | current→published |
| version.number | version | Version tracking |
| createdDate | sys_created_on | ISO timestamp |
| lastUpdated | sys_updated_on | ISO timestamp |
| space.key | kb_category | Mapped to category |

---

## Setup & Configuration

### 1. Add Service Credentials

**Via Portal (Recommended):**
1. Login to portal: https://your-portal.snow-flow.dev
2. Navigate to **Settings → Integrations**
3. Click **"Add Credential"**
4. Select service (Jira/Azure DevOps/Confluence)
5. Enter credentials:
   - **Jira**: Email + API Token
   - **Azure DevOps**: Organization + Personal Access Token
   - **Confluence**: Email + API Token
6. Click **"Test Connection"**
7. Click **"Save"**

**Via API:**
```bash
curl -X POST https://your-portal.snow-flow.dev/api/credentials/store \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "jira",
    "username": "user@company.com",
    "apiToken": "your-jira-api-token",
    "instanceUrl": "https://company.atlassian.net"
  }'
```

### 2. Configure MCP Client

**Claude Desktop (`~/.config/Claude/claude_desktop_config.json`):**
```json
{
  "mcpServers": {
    "snow-flow-enterprise": {
      "command": "npx",
      "args": [
        "-y",
        "@snow-flow/mcp-proxy",
        "--license-key",
        "YOUR-LICENSE-KEY"
      ]
    }
  }
}
```

### 3. Test Integration

```typescript
// Test Jira connection
await snow_jira_search_issues({
  jql: "project = PROJ ORDER BY created DESC",
  maxResults: 1
});

// Test Azure DevOps connection
await snow_azdo_query_work_items({
  organization: "myorg",
  project: "MyProject",
  wiql: "SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Bug'"
});

// Test Confluence connection
await snow_confluence_list_spaces();
```

---

## Autonomous Agent Workflows

### Agent Architecture

```
Agent (Claude Code)
  ↓ Monitors backlog/queue
  ↓ Prioritizes work
  ↓ Executes tasks
  ↓ Updates status
  ↓ Reports completion
  ↓ Sleeps until next cycle
```

### Example: 24/7 Backlog Agent

```typescript
// Agent runs every 15 minutes
while (true) {
  // 1. Get high-priority work
  const jiraIssues = await snow_jira_search_issues({
    jql: "project = PROJ AND status = 'To Do' AND priority IN ('Highest', 'High') ORDER BY priority DESC",
    maxResults: 10
  });

  const azdoWork = await snow_azdo_query_work_items({
    organization: "myorg",
    project: "MyProject",
    wiql: "SELECT [System.Id] FROM WorkItems WHERE [State] = 'New' AND [Priority] <= 2"
  });

  // 2. Process each item
  for (const issue of jiraIssues.issues) {
    // Start work
    await snow_jira_transition_issue({
      issueKey: issue.key,
      transition: "In Progress",
      comment: "🤖 Agent processing"
    });

    // Execute work (e.g., run scripts, deploy, test)
    const result = await executeWork(issue);

    // Complete work
    await snow_jira_transition_issue({
      issueKey: issue.key,
      transition: result.success ? "Done" : "Blocked",
      comment: `🤖 Agent ${result.success ? 'completed' : 'blocked'}: ${result.message}`
    });
  }

  // 3. Sleep 15 minutes
  await sleep(15 * 60 * 1000);
}
```

### Agent Best Practices

1. **Always comment agent actions** - Use 🤖 emoji prefix
2. **Implement error handling** - Don't leave issues in bad state
3. **Rate limit awareness** - Respect tier limits
4. **Idempotent operations** - Safe to retry
5. **Monitoring & alerts** - Track agent health
6. **Human escalation** - Flag complex issues for human review

---

## Troubleshooting

### Common Issues

**❌ "Invalid credentials"**
- Verify credentials in portal
- Check API token hasn't expired
- Ensure correct instance URL

**❌ "Rate limit exceeded"**
- Check tier limits (Team: 100/15min, Pro: 500/15min)
- Implement backoff/retry logic
- Upgrade tier if needed

**❌ "Field mapping error"**
- Check ServiceNow table has required fields
- Verify field types match
- Review mapping configuration

**❌ "Connection timeout"**
- Check service is accessible from GCP europe-west4
- Verify firewall rules
- Check service status page

---

## Support

- **Documentation**: https://docs.snow-flow.dev
- **Portal**: https://portal.snow-flow.dev
- **Issues**: support@snow-flow.dev
- **Enterprise Support**: Available 24/7 for Enterprise tier

---

**Version:** 2.0.0
**Last Updated:** 2025-10-28
