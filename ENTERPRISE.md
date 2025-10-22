# Snow-Flow Enterprise Documentation

Complete guide to Snow-Flow Enterprise features, licensing, and integration.

## Table of Contents

1. [Overview](#overview)
2. [License Tiers](#license-tiers)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Features](#features)
6. [MCP Tools Reference](#mcp-tools-reference)
7. [API Documentation](#api-documentation)
8. [Troubleshooting](#troubleshooting)
9. [Support](#support)

## Overview

Snow-Flow Enterprise extends the open-source Snow-Flow framework with advanced features for enterprise ServiceNow development:

- **Jira Integration** - Bidirectional sync between Jira and ServiceNow
- **Advanced ML Models** - Enhanced machine learning capabilities
- **Priority Support** - Direct access to Snow-Flow development team
- **Custom Integrations** - Tailored integration development
- **SLA Guarantees** - Service level agreements for uptime and response

### Architecture

```
┌─────────────────────┐
│  Snow-Flow Core     │  ← Open Source
│  (Free Forever)     │
└──────────┬──────────┘
           │
           │ Detects Enterprise
           ↓
┌─────────────────────┐
│ Snow-Flow Enterprise│  ← Commercial Add-on
│  (Licensed)         │
├─────────────────────┤
│ • License Validator │
│ • Jira Integration  │
│ • MCP Tools         │
│ • Advanced Features │
└─────────────────────┘
           │
           │ Phone Home
           ↓
┌─────────────────────┐
│  License Server     │
│  (Validation API)   │
└─────────────────────┘
```

## License Tiers

### Team ($49/month)

**For small teams getting started with advanced features**

- ✅ 3 concurrent installations
- ✅ Jira Integration (basic sync)
- ✅ Community support (48h response)
- ❌ Advanced ML models
- ❌ Priority support
- ❌ Custom integrations

**Ideal for:** Small teams (3-10 people)

### Professional ($199/month)

**For growing teams needing advanced capabilities**

- ✅ 10 concurrent installations
- ✅ Jira Integration (full featured)
- ✅ Advanced ML models
- ✅ Priority support (24h response)
- ✅ ServiceNow best practices consultation
- ❌ Custom integrations
- ❌ SLA guarantees

**Ideal for:** Medium teams (10-50 people)

### Enterprise ($999/month)

**For large organizations requiring enterprise support**

- ✅ Unlimited installations
- ✅ All features included
- ✅ Priority support (4h response)
- ✅ Custom integration development
- ✅ SLA guarantees (99.9% uptime)
- ✅ Dedicated account manager
- ✅ On-site training available
- ✅ White-label options

**Ideal for:** Large organizations (50+ people)

### Feature Comparison Matrix

| Feature | Team | Professional | Enterprise |
|---------|------|--------------|------------|
| **Installations** | 3 | 10 | Unlimited |
| **Jira Integration** | Basic | Full | Full |
| **Advanced ML** | ❌ | ✅ | ✅ |
| **Priority Support** | ❌ | ✅ | ✅ |
| **Support Response** | 48h | 24h | 4h |
| **Custom Integrations** | ❌ | ❌ | ✅ |
| **SLA Guarantees** | ❌ | ❌ | ✅ |
| **Account Manager** | ❌ | ❌ | ✅ |
| **On-site Training** | ❌ | ❌ | ✅ |
| **White-label** | ❌ | ❌ | ✅ |

## Installation

### Prerequisites

- Snow-Flow Core 8.0.0 or higher
- Node.js 18.0.0 or higher
- Valid enterprise license key

### Installation Steps

1. **Install Snow-Flow Core** (if not already installed)

```bash
npm install -g snow-flow
```

2. **Install Enterprise Package**

```bash
# Via npm (requires access to private registry)
npm install -g @snow-flow/enterprise

# Or via provided tarball
npm install -g snow-flow-enterprise-1.0.0.tgz
```

3. **Configure License Key**

```bash
# Set environment variable
export SNOW_LICENSE_KEY="SNOW-ENT-XXXXX"

# Or set in Snow-Flow config
snow-flow config set license.key "SNOW-ENT-XXXXX"
```

4. **Verify Installation**

```bash
snow-flow --version
# Should show: Snow-Flow 8.2.0 (Enterprise)

snow-flow license status
# Should show your license tier and features
```

## Configuration

### Environment Variables

```bash
# License Configuration
SNOW_LICENSE_KEY=your-license-key-here
SNOW_LICENSE_SERVER=https://license.snow-flow.dev

# Cache and Grace Period (optional)
SNOW_LICENSE_CHECK_INTERVAL=86400000  # 24 hours (default)
SNOW_LICENSE_GRACE_PERIOD=604800000   # 7 days (default)

# Feature Flags (optional)
SNOW_ENTERPRISE_JIRA_ENABLED=true
SNOW_ENTERPRISE_ML_ENABLED=true
```

### Configuration File

Create `~/.snow-flow/enterprise.config.json`:

```json
{
  "license": {
    "key": "SNOW-ENT-XXXXX",
    "server": "https://license.snow-flow.dev",
    "checkInterval": 86400000,
    "gracePeriod": 604800000
  },
  "features": {
    "jira": {
      "enabled": true,
      "defaultHost": "yourcompany.atlassian.net"
    },
    "ml": {
      "enabled": true,
      "modelCache": "~/.snow-flow/ml-models"
    }
  }
}
```

## Features

### Jira Integration

#### Overview

Bidirectional synchronization between Jira issues and ServiceNow records.

#### Capabilities

- **Backlog Sync** - Sync entire Jira project backlogs to ServiceNow
- **Issue Search** - Search Jira using JQL from Snow-Flow
- **Field Mapping** - Customize field mappings between Jira and ServiceNow
- **Comment Sync** - Sync comments bidirectionally
- **Status Transitions** - Trigger ServiceNow workflows from Jira status changes
- **Attachment Sync** - Sync file attachments

#### Configuration

```javascript
// In Snow-Flow script or MCP tool
const jiraConfig = {
  host: 'yourcompany.atlassian.net',
  username: 'your-email@company.com',
  apiToken: 'your-jira-api-token',
  protocol: 'https',
  apiVersion: '2',
  strictSSL: true
};
```

#### Usage Examples

**Sync Backlog:**
```bash
snow-flow swarm "Sync all issues from PROJ project in Jira to ServiceNow"
```

**Get Issue:**
```bash
snow-flow swarm "Get details for Jira issue PROJ-123"
```

**Search Issues:**
```bash
snow-flow swarm "Find all open Jira issues assigned to me in project TEAM"
```

### Advanced ML Models

#### Overview

Enhanced machine learning capabilities beyond the open-source offerings.

#### Capabilities

- **Deep Learning Models** - LSTM, CNN, and transformer-based models
- **Auto-ML** - Automatic model selection and hyperparameter tuning
- **Model Versioning** - Track and manage multiple model versions
- **A/B Testing** - Compare model performance in production
- **Explainable AI** - Understand model predictions with SHAP/LIME

#### Usage Examples

```bash
snow-flow swarm "Train advanced incident classifier using LSTM with 95% accuracy target"
```

## MCP Tools Reference

Enterprise MCP tools extend Snow-Flow's AI assistant capabilities.

### Jira Tools

#### snow_jira_sync_backlog

Sync Jira backlog to ServiceNow.

**Parameters:**
- `host` (required) - Jira host (e.g., company.atlassian.net)
- `username` (required) - Jira username
- `apiToken` (required) - Jira API token
- `projectKey` (required) - Project key (e.g., PROJ)
- `sprint` (optional) - Sprint name to filter
- `status` (optional) - Array of statuses to filter
- `issueTypes` (optional) - Array of issue types
- `jql` (optional) - Custom JQL query
- `maxResults` (optional) - Max results (default: 100)
- `dryRun` (optional) - Preview without syncing

**Example:**
```javascript
{
  "tool": "snow_jira_sync_backlog",
  "params": {
    "host": "mycompany.atlassian.net",
    "username": "user@company.com",
    "apiToken": "***",
    "projectKey": "PROJ",
    "sprint": "Sprint 42",
    "issueTypes": ["Story", "Bug"],
    "dryRun": true
  }
}
```

#### snow_jira_get_issue

Get detailed Jira issue information.

**Parameters:**
- `host` (required)
- `username` (required)
- `apiToken` (required)
- `issueKey` (required) - Issue key (e.g., PROJ-123)

#### snow_jira_search_issues

Search Jira using JQL.

**Parameters:**
- `host` (required)
- `username` (required)
- `apiToken` (required)
- `jql` (required) - JQL query string
- `maxResults` (optional) - Default: 50
- `startAt` (optional) - Pagination offset

#### snow_jira_add_comment

Add comment to Jira issue.

**Parameters:**
- `host` (required)
- `username` (required)
- `apiToken` (required)
- `issueKey` (required)
- `comment` (required) - Comment text

#### snow_jira_update_issue

Update Jira issue fields.

**Parameters:**
- `host` (required)
- `username` (required)
- `apiToken` (required)
- `issueKey` (required)
- `fields` (required) - Object with fields to update

#### snow_jira_transition_issue

Transition issue to new status.

**Parameters:**
- `host` (required)
- `username` (required)
- `apiToken` (required)
- `issueKey` (required)
- `transitionId` (required) - Transition ID

#### snow_jira_get_transitions

Get available transitions for issue.

**Parameters:**
- `host` (required)
- `username` (required)
- `apiToken` (required)
- `issueKey` (required)

### Advanced ML Tools

(Available in Professional and Enterprise tiers)

#### ml_train_advanced_classifier

Train advanced classification models with hyperparameter tuning.

#### ml_auto_ml

Automatic machine learning with model selection.

#### ml_explain_prediction

Explain model predictions with SHAP values.

## API Documentation

### License Validator API

#### initializeEnterprise()

Initialize enterprise features with license validation.

```typescript
import { initializeEnterprise } from '@snow-flow/enterprise';

await initializeEnterprise('SNOW-ENT-XXXXX');
```

#### requireLicense()

Require valid license with optional feature check.

```typescript
import { requireLicense } from '@snow-flow/enterprise';

// Require any valid license
await requireLicense();

// Require specific feature
await requireLicense('jira');
```

### Jira Integration API

#### JiraApiClient

Create Jira API client.

```typescript
import { JiraApiClient } from '@snow-flow/enterprise';

const client = new JiraApiClient({
  host: 'company.atlassian.net',
  username: 'user@company.com',
  password: 'api-token',
  protocol: 'https',
  apiVersion: '2',
  strictSSL: true
});

// Get issue
const issue = await client.getIssue('PROJ-123');

// Search issues
const results = await client.searchIssues('project = PROJ AND status = Open', 50);

// Update issue
await client.updateIssue('PROJ-123', { summary: 'Updated summary' });

// Add comment
await client.addComment('PROJ-123', 'Status update from Snow-Flow');
```

#### JiraSyncEngine

Orchestrate Jira synchronization.

```typescript
import { JiraSyncEngine } from '@snow-flow/enterprise';

const syncEngine = new JiraSyncEngine(jiraClient);

const result = await syncEngine.syncBacklog({
  projectKey: 'PROJ',
  sprint: 'Sprint 42',
  status: ['To Do', 'In Progress'],
  maxResults: 100,
  dryRun: false
});

console.log(`Synced: ${result.synced}, Failed: ${result.failed}`);
```

## Troubleshooting

### License Validation Issues

**Problem:** "License validation failed"

**Solutions:**
1. Check license key is correct
2. Verify internet connection to license server
3. Check system time is synchronized
4. Review grace period status: `snow-flow license status`

**Problem:** "Feature not included in your license"

**Solutions:**
1. Verify your license tier includes the feature
2. Check feature flags in configuration
3. Contact sales to upgrade license

### Jira Integration Issues

**Problem:** "Authentication failed"

**Solutions:**
1. Verify API token is valid (regenerate if needed)
2. Check username matches Atlassian account
3. Verify host is correct (don't include https://)

**Problem:** "INSTANCE_LIMIT_EXCEEDED"

**Solutions:**
1. Check active installations: `snow-flow license status`
2. Deactivate unused installations
3. Contact sales to increase limit

### Performance Issues

**Problem:** Slow license validation

**Solutions:**
1. Check network connectivity to license server
2. Verify grace period is working (cached validation)
3. Increase `checkInterval` to reduce validation frequency

## Support

### Community Support (All Tiers)

- GitHub Discussions: https://github.com/snow-flow/snow-flow/discussions
- Documentation: https://docs.snow-flow.dev
- Email: support@snow-flow.dev

### Priority Support (Professional & Enterprise)

- **Response Times:**
  - Professional: 24 hours
  - Enterprise: 4 hours
- **Channels:**
  - Dedicated support portal
  - Direct email: enterprise@snow-flow.dev
  - Video calls (Enterprise only)

### Enterprise Services

- **Account Manager** - Dedicated contact for strategic planning
- **On-site Training** - Custom training at your location
- **Custom Development** - Tailored integrations and features
- **Architecture Review** - Expert review of your Snow-Flow implementation

### Getting Help

1. **Check Documentation** - Most issues covered in docs
2. **Search GitHub Issues** - Someone may have had similar issue
3. **Community Forums** - Ask the community
4. **Create Support Ticket** - For licensed features
5. **Emergency Contact** - Critical issues (Enterprise only)

## FAQ

**Q: Can I try Enterprise before purchasing?**
A: Yes! Contact sales@snow-flow.dev for a 30-day trial license.

**Q: What happens if my license expires?**
A: Enterprise features will stop working after 7-day grace period. Core features remain functional.

**Q: Can I transfer my license to a different machine?**
A: Yes, deactivate on old machine first or contact support.

**Q: Is my data sent to Snow-Flow servers?**
A: Only license validation data (version, instance ID). No ServiceNow or business data.

**Q: Can I use Enterprise features offline?**
A: Yes, for up to 7 days (grace period) without internet connection.

**Q: Do you offer volume discounts?**
A: Yes! Contact sales for custom pricing for large deployments.

## License Agreement

See [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md) for complete terms.

---

**Snow-Flow Enterprise** - Supercharge your ServiceNow development
