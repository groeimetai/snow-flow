# Snow-Flow Enterprise Quick Start

Get up and running with Snow-Flow Enterprise in 5 minutes.

## Prerequisites

- ✅ Snow-Flow Core 8.0.0+ installed
- ✅ Node.js 18.0.0+ installed
- ✅ Enterprise license key (get trial at sales@snow-flow.dev)

## Step 1: Install Enterprise Package

```bash
# Install from npm (requires access)
npm install -g @snow-flow/enterprise

# Or from provided tarball
npm install -g snow-flow-enterprise-1.0.0.tgz
```

## Step 2: Configure License

```bash
# Set license key
export SNOW_LICENSE_KEY="SNOW-ENT-XXXXX"

# Or use Snow-Flow config
snow-flow config set license.key "SNOW-ENT-XXXXX"
```

## Step 3: Verify Installation

```bash
# Check version
snow-flow --version
# Output: Snow-Flow 8.2.0 (Enterprise)

# Check license status
snow-flow license status
# Output:
# ✓ License valid
# Tier: Enterprise
# Features: jira, advanced-ml, priority-support
# Expires: 2025-12-31
# Instances: 1/999
```

## Step 4: Configure Jira (Optional)

If you want to use Jira integration:

1. **Generate Jira API Token:**
   - Go to https://id.atlassian.com/manage/api-tokens
   - Click "Create API token"
   - Copy the token

2. **Set Jira Credentials:**
```bash
snow-flow config set jira.host "yourcompany.atlassian.net"
snow-flow config set jira.username "your-email@company.com"
snow-flow config set jira.apiToken "your-api-token"
```

## Step 5: Test Jira Integration

```bash
# Sync Jira backlog (dry run)
snow-flow swarm "Sync issues from PROJ project in Jira (dry run)"

# Get specific issue
snow-flow swarm "Get details for Jira issue PROJ-123"

# Search issues
snow-flow swarm "Find all open Jira bugs in project TEAM"
```

## Step 6: Your First Enterprise Feature

Let's sync a Jira sprint to ServiceNow:

```bash
snow-flow swarm "Sync all issues from Sprint 42 in PROJ project to ServiceNow incidents"
```

The AI assistant will:
1. ✅ Validate your enterprise license
2. ✅ Connect to Jira using your credentials
3. ✅ Fetch issues from Sprint 42
4. ✅ Map Jira fields to ServiceNow fields
5. ✅ Create/update ServiceNow incidents
6. ✅ Report sync results

## Common Use Cases

### Use Case 1: Daily Backlog Sync

```bash
snow-flow swarm "Sync today's Jira updates from PROJ to ServiceNow"
```

### Use Case 2: Comment Synchronization

```bash
snow-flow swarm "Add comment to Jira issue PROJ-123: 'Resolved in ServiceNow INC0010001'"
```

### Use Case 3: Status Automation

```bash
snow-flow swarm "When ServiceNow incident is resolved, transition Jira issue to Done"
```

### Use Case 4: Bulk Search

```bash
snow-flow swarm "Find all high-priority Jira issues assigned to me and create ServiceNow tasks"
```

## Programmatic Usage

### Node.js Script

```javascript
import { initializeEnterprise, JiraApiClient, JiraSyncEngine } from '@snow-flow/enterprise';

// Initialize enterprise features
await initializeEnterprise(process.env.SNOW_LICENSE_KEY);

// Create Jira client
const jiraClient = new JiraApiClient({
  host: 'company.atlassian.net',
  username: 'user@company.com',
  password: process.env.JIRA_API_TOKEN,
  protocol: 'https',
  apiVersion: '2',
  strictSSL: true
});

// Sync backlog
const syncEngine = new JiraSyncEngine(jiraClient);
const result = await syncEngine.syncBacklog({
  projectKey: 'PROJ',
  sprint: 'Sprint 42',
  status: ['To Do', 'In Progress'],
  maxResults: 100
});

console.log(`✓ Synced ${result.synced} issues`);
console.log(`✗ Failed ${result.failed} issues`);
```

### MCP Tool Usage

In OpenCode or Claude Code:

```
User: "Sync Jira project TEAM to ServiceNow"