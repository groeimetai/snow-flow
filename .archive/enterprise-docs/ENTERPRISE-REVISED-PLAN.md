# Snow-Flow Enterprise - Revised Integration Plan

**Version:** 2.0 (Revised)
**Date:** October 27, 2025
**Status:** 🔄 Updated with existing tools inventory

---

## 🎯 Executive Summary

Snow-Flow ALREADY HAS basic integration tools (Jira, LDAP, SAML, OAuth, Webhooks). The enterprise edition adds:

1. **License Gating** - Tools only available to enterprise/team tier customers
2. **Advanced Features** - Bidirectional sync, AI parsing, real-time webhooks
3. **Remote MCP Server** - Centralized enterprise feature hosting
4. **Service Integrator Support** - Multi-tenant license management

---

## ✅ Existing Integration Tools (Open Source)

Located in: `src/mcp/servicenow-mcp-unified/tools/adapters/`

| Tool | What It Does | Status |
|------|--------------|--------|
| `snow_jira_integration` | Configure JIRA connection (URL, auth) | ✅ Basic |
| `snow_ldap_sync` | Trigger LDAP user sync | ✅ Complete |
| `snow_saml_config` | Configure SAML SSO | ✅ Complete |
| `snow_oauth_provider` | Setup OAuth provider | ✅ Complete |
| `snow_webhook_config` | Configure webhooks | ✅ Basic |

**These tools work, but lack:**
- License tier restrictions
- Advanced enterprise features
- Bidirectional sync
- Real-time event processing

---

## 🏗️ Revised Architecture

### Phase 1: Add License Gating to Existing Tools

**Goal:** Make existing adapter tools enterprise-only

**Location:** `snow-flow` (open source, but with enterprise checks)

**Implementation:**

```typescript
// src/mcp/servicenow-mcp-unified/tools/adapters/snow_jira_integration.ts
export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  // NEW: Check enterprise license
  if (!context.enterprise || context.enterprise.tier === 'community') {
    return createErrorResult(
      'JIRA integration requires enterprise license. ' +
      'Contact sales@snow-flow.dev for upgrade.'
    );
  }

  // NEW: Check feature flag
  if (!context.enterprise.features.includes('jira')) {
    return createErrorResult(
      'JIRA integration not included in your license tier. ' +
      'Upgrade to Team or Enterprise for access.'
    );
  }

  // Existing implementation...
  const { jira_url, username, api_token } = args;
  const client = await getAuthenticatedClient(context);
  // ... rest of code
}
```

**Files to Update:**
- ✅ `snow_jira_integration.ts` - Add license check
- ✅ `snow_ldap_sync.ts` - Add license check (enterprise only)
- ✅ `snow_saml_config.ts` - Add license check (enterprise only)
- ✅ `snow_oauth_provider.ts` - Add license check (team+ only)
- ✅ `snow_webhook_config.ts` - Keep open source (or basic enterprise)

---

### Phase 2: Build Advanced Enterprise Tools

**Location:** `snow-flow-enterprise` (private repo)

**New Tools to Build:**

#### 2.1 Advanced Jira Integration

```
enterprise/src/tools/jira/
├── jira-advanced-sync.ts          ← Bidirectional backlog sync
├── jira-webhook-handler.ts        ← Real-time webhook processing
├── jira-ai-parser.ts              ← AI-powered requirement extraction
├── jira-sprint-planner.ts         ← Sprint planning integration
└── index.ts
```

**Example: `jira-advanced-sync.ts`**

```typescript
import axios from 'axios';
import { ServiceNowContext, ToolResult } from '@snow-flow/types';

export const toolDefinition = {
  name: 'jira_sync_backlog_advanced',
  description: 'Bidirectional Jira-ServiceNow backlog synchronization with AI parsing',
  category: 'enterprise',
  subcategory: 'jira',
  inputSchema: {
    type: 'object',
    properties: {
      jira_project_key: { type: 'string', description: 'Jira project key (e.g., PROJ)' },
      servicenow_table: { type: 'string', description: 'Target ServiceNow table' },
      sync_direction: {
        type: 'string',
        enum: ['jira-to-snow', 'snow-to-jira', 'bidirectional'],
        default: 'bidirectional'
      },
      ai_parse_requirements: {
        type: 'boolean',
        description: 'Use AI to extract structured requirements',
        default: true
      },
      sync_interval: {
        type: 'number',
        description: 'Sync interval in minutes (0 = manual)',
        default: 15
      }
    },
    required: ['jira_project_key', 'servicenow_table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    jira_project_key,
    servicenow_table,
    sync_direction = 'bidirectional',
    ai_parse_requirements = true,
    sync_interval = 15
  } = args;

  // Step 1: Fetch Jira issues
  const jiraIssues = await fetchJiraIssues(
    context.jiraUrl,
    context.jiraToken,
    jira_project_key
  );

  // Step 2: AI parse requirements (if enabled)
  let parsedIssues = jiraIssues;
  if (ai_parse_requirements) {
    parsedIssues = await parseWithAI(jiraIssues);
  }

  // Step 3: Sync Jira → ServiceNow
  if (sync_direction === 'jira-to-snow' || sync_direction === 'bidirectional') {
    await syncJiraToServiceNow(parsedIssues, servicenow_table, context);
  }

  // Step 4: Sync ServiceNow → Jira
  if (sync_direction === 'snow-to-jira' || sync_direction === 'bidirectional') {
    await syncServiceNowToJira(servicenow_table, jira_project_key, context);
  }

  // Step 5: Setup continuous sync (if interval > 0)
  if (sync_interval > 0) {
    await scheduleContinuousSync(
      jira_project_key,
      servicenow_table,
      sync_direction,
      sync_interval
    );
  }

  return {
    success: true,
    data: {
      synced_issues: parsedIssues.length,
      sync_direction,
      continuous_sync: sync_interval > 0,
      next_sync: sync_interval > 0 ? new Date(Date.now() + sync_interval * 60000) : null
    }
  };
}

async function fetchJiraIssues(jiraUrl: string, token: string, projectKey: string) {
  const response = await axios.get(`${jiraUrl}/rest/api/3/search`, {
    params: {
      jql: `project = ${projectKey} AND status != Done`,
      maxResults: 100
    },
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.data.issues;
}

async function parseWithAI(issues: any[]) {
  // Use LLM to extract structured requirements from descriptions
  // This would call Claude/GPT to parse:
  // - User stories → acceptance criteria
  // - Technical specs → implementation steps
  // - Epics → child stories

  return issues.map(issue => ({
    ...issue,
    parsed: {
      acceptance_criteria: extractAcceptanceCriteria(issue.fields.description),
      technical_requirements: extractTechnicalReqs(issue.fields.description),
      estimated_complexity: estimateComplexity(issue)
    }
  }));
}

async function syncJiraToServiceNow(issues: any[], table: string, context: ServiceNowContext) {
  // Create/update ServiceNow records from Jira issues
  // Map: Jira Story → ServiceNow Incident/Story/Task
}

async function syncServiceNowToJira(table: string, projectKey: string, context: ServiceNowContext) {
  // Create/update Jira issues from ServiceNow records
  // Bidirectional sync
}

async function scheduleContinuousSync(
  projectKey: string,
  table: string,
  direction: string,
  interval: number
) {
  // Create ServiceNow scheduled job for continuous sync
}
```

#### 2.2 Azure DevOps Integration (NEW)

```
enterprise/src/tools/azure/
├── azure-work-item-sync.ts        ← Work item synchronization
├── azure-pipeline-tracker.ts      ← Build/release pipeline tracking
├── azure-pr-integration.ts        ← Pull request lifecycle tracking
├── azure-test-results.ts          ← Test result documentation
└── index.ts
```

**Example: `azure-work-item-sync.ts`**

```typescript
export const toolDefinition = {
  name: 'azure_sync_work_items',
  description: 'Sync Azure DevOps work items to ServiceNow with pipeline integration',
  category: 'enterprise',
  subcategory: 'azure-devops',
  inputSchema: {
    type: 'object',
    properties: {
      azure_project: { type: 'string', description: 'Azure DevOps project name' },
      work_item_type: {
        type: 'string',
        enum: ['User Story', 'Bug', 'Task', 'Epic', 'All'],
        default: 'All'
      },
      servicenow_table: { type: 'string', description: 'Target ServiceNow table' },
      include_pipeline_status: {
        type: 'boolean',
        description: 'Include build/release pipeline status',
        default: true
      }
    },
    required: ['azure_project', 'servicenow_table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  // Implementation here
  // Fetches Azure DevOps work items, pipelines, test results
  // Syncs to ServiceNow with full context
}
```

#### 2.3 Confluence Integration (NEW)

```
enterprise/src/tools/confluence/
├── confluence-doc-sync.ts         ← Documentation synchronization
├── confluence-spec-parser.ts      ← Technical specs → KB articles
├── confluence-diagram-import.ts   ← Architecture diagram sync
└── index.ts
```

**Example: `confluence-doc-sync.ts`**

```typescript
export const toolDefinition = {
  name: 'confluence_sync_documentation',
  description: 'Sync Confluence pages to ServiceNow knowledge base',
  category: 'enterprise',
  subcategory: 'confluence',
  inputSchema: {
    type: 'object',
    properties: {
      confluence_space_key: { type: 'string', description: 'Confluence space key' },
      knowledge_base_sys_id: { type: 'string', description: 'ServiceNow KB sys_id' },
      sync_attachments: { type: 'boolean', default: true },
      convert_to_markdown: { type: 'boolean', default: true }
    },
    required: ['confluence_space_key', 'knowledge_base_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  // Implementation here
  // Fetches Confluence pages, converts to KB articles
}
```

---

### Phase 3: Remote Enterprise MCP Server

**Location:** `snow-flow-enterprise/src/server/`

**Purpose:** Host all enterprise tools as remote MCP server

**Architecture:**

```
┌─────────────────────────────────────────────┐
│ Local: snow-flow (open source)             │
│ • Basic tools (open to all)                │
│ • Basic adapters (with license checks)     │
│ • Remote MCP client (connects to ↓)        │
└──────────────────┬──────────────────────────┘
                   │ HTTPS/SSE + JWT
                   ↓
┌─────────────────────────────────────────────┐
│ Remote: enterprise.snow-flow.dev            │
│ • JWT authentication                        │
│ • License validation                        │
│ • Enterprise MCP server (SSE)               │
│                                             │
│ Tools exposed:                              │
│ • jira_sync_backlog_advanced                │
│ • jira_webhook_handler                      │
│ • jira_ai_parser                            │
│ • azure_sync_work_items                     │
│ • azure_pipeline_tracker                    │
│ • azure_pr_integration                      │
│ • confluence_sync_documentation             │
│ • confluence_spec_parser                    │
│ • enterprise_audit_logs                     │
└─────────────────────────────────────────────┘
```

**Implementation:**

Same as original plan (see ENTERPRISE-INTEGRATION-PLAN.md Phase 1-2)

---

## 🛠️ Implementation Roadmap (Revised)

### Week 1: Add License Gating to Existing Tools

**Tasks:**
1. ✅ Update `snow_jira_integration.ts` with license check
2. ✅ Update `snow_ldap_sync.ts` with license check
3. ✅ Update `snow_saml_config.ts` with license check
4. ✅ Update `snow_oauth_provider.ts` with license check
5. ✅ Test license gating with community vs enterprise tier

**Deliverable:** Existing tools now require enterprise license

### Week 2: Create snow-flow-enterprise Repository

**Tasks:**
1. ✅ Create private GitHub repository
2. ✅ Setup TypeScript project structure
3. ✅ Implement authentication service (JWT, license validation)
4. ✅ Implement basic SSE MCP server
5. ✅ Test authentication flow locally

**Deliverable:** Enterprise server can authenticate users

### Week 3: Build Advanced Jira Tools

**Tasks:**
1. ✅ Implement `jira_sync_backlog_advanced`
2. ✅ Implement `jira_webhook_handler`
3. ✅ Implement `jira_ai_parser` (using Claude/GPT)
4. ✅ Test with real Jira instance

**Deliverable:** Advanced Jira integration working

### Week 4: Build Azure DevOps & Confluence Tools

**Tasks:**
1. ✅ Implement `azure_sync_work_items`
2. ✅ Implement `azure_pipeline_tracker`
3. ✅ Implement `confluence_sync_documentation`
4. ✅ Test end-to-end with all integrations

**Deliverable:** All enterprise tools working

### Week 5: Deploy & Test

**Tasks:**
1. ✅ Deploy enterprise server to Railway/AWS
2. ✅ Configure domain (enterprise.snow-flow.dev)
3. ✅ Test with service integrator license (Capgemini)
4. ✅ Test with customer license (restricted access)
5. ✅ Performance testing & optimization

**Deliverable:** Production-ready enterprise server

---

## 📊 Comparison: Community vs Enterprise

| Feature | Community (Open Source) | Enterprise |
|---------|------------------------|------------|
| **Basic ServiceNow Tools** | ✅ 235+ tools | ✅ 235+ tools |
| **Basic Jira Config** | ✅ snow_jira_integration | ✅ + Advanced sync |
| **Bidirectional Jira Sync** | ❌ No | ✅ Yes |
| **AI-Powered Parsing** | ❌ No | ✅ Yes |
| **Azure DevOps Integration** | ❌ No | ✅ Yes |
| **Confluence Integration** | ❌ No | ✅ Yes |
| **SAML/SSO** | ❌ No (basic only) | ✅ Yes (full) |
| **Audit Logging** | ❌ No | ✅ Yes |
| **Custom Themes** | ❌ ServiceNow only | ✅ Company branding |
| **Support SLA** | ❌ Community forum | ✅ 24/7 (Enterprise tier) |
| **Pricing** | Free | €499-1,999/month |

---

## 🔐 License Tier Feature Matrix

| Feature | Community | Professional | Team | Enterprise |
|---------|-----------|--------------|------|-----------|
| Basic ServiceNow tools | ✅ | ✅ | ✅ | ✅ |
| Basic Jira config | ❌ | ✅ | ✅ | ✅ |
| Advanced Jira sync | ❌ | ❌ | ✅ | ✅ |
| Azure DevOps | ❌ | ✅ | ✅ | ✅ |
| Confluence | ❌ | ❌ | ✅ | ✅ |
| SAML/SSO | ❌ | ❌ | ❌ | ✅ |
| Audit Logging | ❌ | ❌ | ❌ | ✅ |
| Custom Themes | ❌ | ❌ | ❌ | ✅ |
| AI Features | ❌ | ❌ | ❌ | ✅ |
| Users | Unlimited | 5 | 20 | Unlimited |
| Price/Month | Free | €499 | €999 | €1,999 |

---

## 🚀 Testing Strategy

### Test 1: Community User (No License)

```bash
# .env
SNOW_FLOW_LICENSE_KEY=  # Empty or not set

# Try to use Jira integration
> Use snow_jira_integration to connect to Jira

# Expected:
# ❌ Error: "JIRA integration requires enterprise license. Contact sales@snow-flow.dev"
```

### Test 2: Professional User (Basic License)

```bash
# .env
SNOW_FLOW_LICENSE_KEY=SNOW-PRO-ACME-20251231-XXX

# Try basic Jira config
> Use snow_jira_integration to connect to Jira
# ✅ Works

# Try advanced sync
> Use jira_sync_backlog_advanced to sync PROJECT-123
# ❌ Error: "Advanced Jira sync requires Team or Enterprise tier"
```

### Test 3: Enterprise User (Full Access)

```bash
# .env
SNOW_FLOW_LICENSE_KEY=SNOW-ENT-CAPGEMINI-20261231-XXX

# All tools work
> Use jira_sync_backlog_advanced
# ✅ Works

> Use azure_sync_work_items
# ✅ Works

> Use confluence_sync_documentation
# ✅ Works
```

---

## 💰 Revenue Model (Service Integrators)

### Capgemini Partnership Example

**Master License:** €5,000/month
- Unlimited seats for Capgemini developers
- Full access to all enterprise features
- White-label with Capgemini branding
- Can create customer sub-licenses

**Customer Sub-License:** Included in Capgemini's contract
- Customer pays Capgemini (not us)
- Capgemini marks up 30-50%
- We provide license key for customer
- Customer has restricted access (only their instance)

**Example:**
```
Capgemini → Customer "ABC Corp"
- Capgemini charges ABC Corp: €2,500/month (for their consulting)
- Snow-Flow included in that price
- We give Capgemini master license: €5,000/month
- Capgemini creates 20 customer licenses (20 × €2,500 = €50,000/month)
- Capgemini profit: €45,000/month
- Our revenue: €5,000/month (from Capgemini master license)
```

**Why this works:**
- ✅ Capgemini has incentive to sell (high margin)
- ✅ We get guaranteed €5k/month
- ✅ Customers get enterprise features
- ✅ We don't handle customer support (Capgemini does)

---

## 📝 Next Steps

### Immediate (This Week)

1. **Add license gating to existing adapter tools**
   - Update 5 adapter tools with enterprise checks
   - Test with community vs enterprise license
   - Verify error messages

2. **Create snow-flow-enterprise repository**
   - Setup project structure
   - Implement authentication service
   - Generate test license keys

### Short-term (Next 2 Weeks)

3. **Build advanced Jira tools**
   - Bidirectional sync
   - Webhook handlers
   - AI parsing

4. **Build Azure DevOps tools**
   - Work item sync
   - Pipeline tracking

### Medium-term (Next Month)

5. **Build Confluence tools**
   - Documentation sync
   - Spec parsing

6. **Deploy enterprise server**
   - Railway/AWS deployment
   - Domain setup
   - SSL certificates

7. **Partner with Capgemini**
   - Demo enterprise features
   - Sign partnership agreement
   - Generate master license

---

**Status:** 🚀 Ready to implement!
**Next Action:** Add license gating to existing adapter tools

