# Snow-Flow Enterprise - Complete MCP Tool Set

## 🎯 Overview

Complete remote MCP server with **40+ enterprise tools** across 4 integration categories:

1. **Jira Integration** (8 tools)
2. **Azure DevOps Integration** (10 tools)
3. **Confluence Integration** (8 tools)
4. **Advanced ML & Analytics** (15+ tools)

All tools run on **remote GCP server** - your code stays private!

## 📊 Feature Matrix by Tier

| Feature Category | Team | Pro | Enterprise |
|------------------|------|-----|------------|
| **Jira Integration** | ✅ Basic (4 tools) | ✅ Full (8 tools) | ✅ Full (8 tools) |
| **Azure DevOps** | ❌ | ✅ Full (10 tools) | ✅ Full (10 tools) |
| **Confluence** | ❌ | ✅ Basic (4 tools) | ✅ Full (8 tools) |
| **Advanced ML** | ❌ | ✅ Basic (5 tools) | ✅ Full (15 tools) |
| **SSO/SAML** | ❌ | ❌ | ✅ |
| **Priority Support** | ❌ | ❌ | ✅ |
| **Custom Tools** | ❌ | ❌ | ✅ (on request) |
| **Max Instances** | 3 | 10 | Unlimited |
| **API Rate Limit** | 100/15min | 500/15min | 2000/15min |

## 🔧 1. Jira Integration (8 Tools)

### Tool List

```typescript
// 1. snow_jira_sync_backlog
{
  name: "snow_jira_sync_backlog",
  description: "Sync Jira backlog to ServiceNow incidents/tasks",
  inputSchema: {
    projectKey: "string",     // PROJ
    sprint?: "string",        // Sprint name or ID
    status?: "string[]",      // Filter by status
    issueTypes?: "string[]",  // Filter by type
    jql?: "string",           // Custom JQL
    maxResults?: "number",    // Default: 100
    syncToTable: "string",    // incident, task, problem
    dryRun?: "boolean"
  }
}

// 2. snow_jira_get_issue
{
  name: "snow_jira_get_issue",
  description: "Get detailed Jira issue information",
  inputSchema: {
    issueKey: "string"  // PROJ-123
  }
}

// 3. snow_jira_create_issue
{
  name: "snow_jira_create_issue",
  description: "Create Jira issue from ServiceNow record",
  inputSchema: {
    projectKey: "string",
    issueType: "string",      // Story, Bug, Task, Epic
    summary: "string",
    description?: "string",
    priority?: "string",      // Highest, High, Medium, Low, Lowest
    assignee?: "string",
    labels?: "string[]",
    components?: "string[]",
    customFields?: "object"
  }
}

// 4. snow_jira_update_issue
{
  name: "snow_jira_update_issue",
  description: "Update existing Jira issue",
  inputSchema: {
    issueKey: "string",
    fields: "object",         // Any Jira fields
    notifyUsers?: "boolean"
  }
}

// 5. snow_jira_transition_issue
{
  name: "snow_jira_transition_issue",
  description: "Transition Jira issue (To Do → In Progress → Done)",
  inputSchema: {
    issueKey: "string",
    transition: "string",     // "To Do", "In Progress", "Done", etc.
    comment?: "string"
  }
}

// 6. snow_jira_search_issues
{
  name: "snow_jira_search_issues",
  description: "Advanced Jira issue search with JQL",
  inputSchema: {
    jql: "string",            // Full JQL query
    fields?: "string[]",      // Fields to return
    maxResults?: "number",
    startAt?: "number"
  }
}

// 7. snow_jira_get_project
{
  name: "snow_jira_get_project",
  description: "Get Jira project details and metadata",
  inputSchema: {
    projectKey: "string"
  }
}

// 8. snow_jira_link_issues
{
  name: "snow_jira_link_issues",
  description: "Create link between Jira issues",
  inputSchema: {
    fromIssue: "string",      // PROJ-123
    toIssue: "string",        // PROJ-456
    linkType: "string",       // "Blocks", "Relates to", "Duplicates", etc.
    comment?: "string"
  }
}
```

### Use Cases

**1. Bi-directional Sync:**
```bash
snow-flow swarm "Sync Jira sprint TEAM-Sprint-42 to ServiceNow incidents"
# Creates/updates incidents for all sprint issues
# Maps priority, status, assignee automatically
```

**2. Incident → Jira:**
```bash
snow-flow swarm "Create Jira ticket for incident INC0010001"
# Reads incident from ServiceNow
# Creates Jira issue with all details
# Links back via correlation_id
```

**3. Status Sync:**
```bash
snow-flow swarm "Update Jira issues when ServiceNow incidents resolve"
# Monitors ServiceNow state changes
# Transitions Jira issues automatically
```

## 🔷 2. Azure DevOps Integration (10 Tools)

### Tool List

```typescript
// 1. snow_azdo_sync_work_items
{
  name: "snow_azdo_sync_work_items",
  description: "Sync Azure DevOps work items to ServiceNow",
  inputSchema: {
    organization: "string",   // company.visualstudio.com or dev.azure.com/company
    project: "string",
    areaPath?: "string",
    iterationPath?: "string",
    workItemTypes?: "string[]", // User Story, Bug, Task, Feature
    wiql?: "string",           // Custom WIQL query
    syncToTable: "string",     // incident, task, change_request
    maxResults?: "number"
  }
}

// 2. snow_azdo_get_work_item
{
  name: "snow_azdo_get_work_item",
  description: "Get Azure DevOps work item details",
  inputSchema: {
    organization: "string",
    project: "string",
    workItemId: "number"
  }
}

// 3. snow_azdo_create_work_item
{
  name: "snow_azdo_create_work_item",
  description: "Create Azure DevOps work item",
  inputSchema: {
    organization: "string",
    project: "string",
    workItemType: "string",   // User Story, Bug, Task, etc.
    title: "string",
    description?: "string",
    assignedTo?: "string",
    areaPath?: "string",
    iterationPath?: "string",
    priority?: "number",      // 1-4
    severity?: "string",      // Critical, High, Medium, Low
    tags?: "string[]",
    customFields?: "object"
  }
}

// 4. snow_azdo_update_work_item
{
  name: "snow_azdo_update_work_item",
  description: "Update Azure DevOps work item",
  inputSchema: {
    organization: "string",
    project: "string",
    workItemId: "number",
    fields: "object",
    comment?: "string"
  }
}

// 5. snow_azdo_get_pipeline_runs
{
  name: "snow_azdo_get_pipeline_runs",
  description: "Get Azure DevOps pipeline run history",
  inputSchema: {
    organization: "string",
    project: "string",
    pipelineId: "number",
    top?: "number",
    status?: "string"        // succeeded, failed, canceled
  }
}

// 6. snow_azdo_trigger_pipeline
{
  name: "snow_azdo_trigger_pipeline",
  description: "Trigger Azure DevOps pipeline build",
  inputSchema: {
    organization: "string",
    project: "string",
    pipelineId: "number",
    branch?: "string",       // Default: main
    parameters?: "object"
  }
}

// 7. snow_azdo_get_pull_requests
{
  name: "snow_azdo_get_pull_requests",
  description: "Get Azure DevOps pull requests",
  inputSchema: {
    organization: "string",
    project: "string",
    repository: "string",
    status?: "string",       // active, completed, abandoned
    createdBy?: "string"
  }
}

// 8. snow_azdo_create_pull_request
{
  name: "snow_azdo_create_pull_request",
  description: "Create Azure DevOps pull request",
  inputSchema: {
    organization: "string",
    project: "string",
    repository: "string",
    sourceBranch: "string",
    targetBranch: "string",
    title: "string",
    description?: "string",
    reviewers?: "string[]",
    workItems?: "number[]",  // Link work items
    autoComplete?: "boolean"
  }
}

// 9. snow_azdo_get_releases
{
  name: "snow_azdo_get_releases",
  description: "Get Azure DevOps release history",
  inputSchema: {
    organization: "string",
    project: "string",
    definitionId?: "number",
    top?: "number",
    status?: "string"
  }
}

// 10. snow_azdo_create_release
{
  name: "snow_azdo_create_release",
  description: "Create Azure DevOps release",
  inputSchema: {
    organization: "string",
    project: "string",
    definitionId: "number",
    description?: "string",
    artifacts?: "object[]",
    variables?: "object"
  }
}
```

### Use Cases

**1. Work Item Sync:**
```bash
snow-flow swarm "Sync Azure DevOps sprint bugs to ServiceNow incidents"
```

**2. Change Request → Pipeline:**
```bash
snow-flow swarm "Trigger Azure pipeline when change request approved"
```

**3. Deployment Tracking:**
```bash
snow-flow swarm "Create ServiceNow change for each Azure DevOps release"
```

## 📚 3. Confluence Integration (8 Tools)

### Tool List

```typescript
// 1. snow_confluence_sync_pages
{
  name: "snow_confluence_sync_pages",
  description: "Sync Confluence pages to ServiceNow knowledge base",
  inputSchema: {
    spaceKey: "string",
    label?: "string",         // Filter by label
    title?: "string",         // Search by title
    maxResults?: "number",
    syncToTable: "string"     // kb_knowledge, kb_knowledge_base
  }
}

// 2. snow_confluence_get_page
{
  name: "snow_confluence_get_page",
  description: "Get Confluence page content",
  inputSchema: {
    pageId: "string",
    expand?: "string[]"       // body.storage, version, space, etc.
  }
}

// 3. snow_confluence_create_page
{
  name: "snow_confluence_create_page",
  description: "Create Confluence page from ServiceNow KB article",
  inputSchema: {
    spaceKey: "string",
    title: "string",
    content: "string",        // HTML or storage format
    parentId?: "string",
    labels?: "string[]"
  }
}

// 4. snow_confluence_update_page
{
  name: "snow_confluence_update_page",
  description: "Update Confluence page",
  inputSchema: {
    pageId: "string",
    title?: "string",
    content?: "string",
    version: "number",        // Required for updates
    minorEdit?: "boolean"
  }
}

// 5. snow_confluence_search
{
  name: "snow_confluence_search",
  description: "Search Confluence content",
  inputSchema: {
    cql: "string",            // Confluence Query Language
    limit?: "number",
    start?: "number",
    expand?: "string[]"
  }
}

// 6. snow_confluence_get_space
{
  name: "snow_confluence_get_space",
  description: "Get Confluence space details",
  inputSchema: {
    spaceKey: "string",
    expand?: "string[]"
  }
}

// 7. snow_confluence_attach_file
{
  name: "snow_confluence_attach_file",
  description: "Attach file to Confluence page",
  inputSchema: {
    pageId: "string",
    fileName: "string",
    fileContent: "string",    // Base64 encoded
    contentType?: "string",
    comment?: "string"
  }
}

// 8. snow_confluence_export_page
{
  name: "snow_confluence_export_page",
  description: "Export Confluence page as PDF",
  inputSchema: {
    pageId: "string",
    exportFormat: "string"    // pdf, word, storage
  }
}
```

### Use Cases

**1. Knowledge Sync:**
```bash
snow-flow swarm "Sync Confluence IT space to ServiceNow knowledge base"
```

**2. Incident → Documentation:**
```bash
snow-flow swarm "Create Confluence page for incident resolution INC0010001"
```

**3. Search Integration:**
```bash
snow-flow swarm "Search Confluence for similar issues when incident created"
```

## 🧠 4. Advanced ML & Analytics (15 Tools)

### Machine Learning Tools

```typescript
// 1. snow_ml_predict_incident_priority
{
  name: "snow_ml_predict_incident_priority",
  description: "Predict incident priority using ML model",
  inputSchema: {
    shortDescription: "string",
    description?: "string",
    category?: "string",
    caller?: "string",
    configurationItem?: "string"
  }
}

// 2. snow_ml_predict_incident_category
{
  name: "snow_ml_predict_incident_category",
  description: "Auto-categorize incidents using NLP",
  inputSchema: {
    shortDescription: "string",
    description?: "string"
  }
}

// 3. snow_ml_predict_assignment_group
{
  name: "snow_ml_predict_assignment_group",
  description: "Predict best assignment group for incident",
  inputSchema: {
    incidentData: "object",   // Full incident record
    historicalAccuracy?: "boolean"  // Include confidence score
  }
}

// 4. snow_ml_detect_duplicate_incidents
{
  name: "snow_ml_detect_duplicate_incidents",
  description: "Find duplicate/similar incidents using ML",
  inputSchema: {
    incidentId: "string",
    threshold?: "number",     // Similarity threshold (0-1)
    maxResults?: "number"
  }
}

// 5. snow_ml_predict_resolution_time
{
  name: "snow_ml_predict_resolution_time",
  description: "Predict incident resolution time",
  inputSchema: {
    incidentData: "object",
    includeFactors?: "boolean"  // Show factors affecting time
  }
}

// 6. snow_ml_recommend_solutions
{
  name: "snow_ml_recommend_solutions",
  description: "Recommend KB articles for incident resolution",
  inputSchema: {
    incidentId: "string",
    maxRecommendations?: "number",
    minConfidence?: "number"
  }
}

// 7. snow_ml_detect_anomalies
{
  name: "snow_ml_detect_anomalies",
  description: "Detect anomalies in incident patterns",
  inputSchema: {
    table: "string",          // incident, task, change_request
    timeRange: "string",      // last_7_days, last_30_days, custom
    dimensions?: "string[]",  // category, priority, assignment_group
    threshold?: "number"
  }
}

// 8. snow_ml_forecast_incident_volume
{
  name: "snow_ml_forecast_incident_volume",
  description: "Forecast future incident volume",
  inputSchema: {
    forecastDays: "number",   // How many days ahead
    granularity: "string",    // hour, day, week
    groupBy?: "string[]"      // category, priority
  }
}

// 9. snow_ml_cluster_similar_issues
{
  name: "snow_ml_cluster_similar_issues",
  description: "Cluster similar issues for pattern analysis",
  inputSchema: {
    table: "string",
    timeRange: "string",
    minClusterSize?: "number",
    maxClusters?: "number"
  }
}

// 10. snow_ml_sentiment_analysis
{
  name: "snow_ml_sentiment_analysis",
  description: "Analyze sentiment in comments/work notes",
  inputSchema: {
    recordId: "string",
    table: "string",
    analyzeComments?: "boolean",
    analyzeWorkNotes?: "boolean"
  }
}
```

### Analytics Tools

```typescript
// 11. snow_analytics_incident_trends
{
  name: "snow_analytics_incident_trends",
  description: "Analyze incident trends and patterns",
  inputSchema: {
    timeRange: "string",
    groupBy: "string[]",      // category, priority, assignment_group
    includeForecasts?: "boolean"
  }
}

// 12. snow_analytics_sla_performance
{
  name: "snow_analytics_sla_performance",
  description: "Analyze SLA compliance and performance",
  inputSchema: {
    timeRange: "string",
    slaDefinition?: "string",
    groupBy?: "string[]"
  }
}

// 13. snow_analytics_agent_performance
{
  name: "snow_analytics_agent_performance",
  description: "Analyze agent/team performance metrics",
  inputSchema: {
    timeRange: "string",
    assignmentGroup?: "string",
    userId?: "string",
    metrics?: "string[]"      // resolution_time, reopen_rate, etc.
  }
}

// 14. snow_analytics_change_success_rate
{
  name: "snow_analytics_change_success_rate",
  description: "Analyze change request success rates",
  inputSchema: {
    timeRange: "string",
    changeType?: "string",
    riskLevel?: "string",
    groupBy?: "string[]"
  }
}

// 15. snow_analytics_custom_report
{
  name: "snow_analytics_custom_report",
  description: "Generate custom analytics report with AI",
  inputSchema: {
    table: "string",
    metrics: "string[]",
    dimensions: "string[]",
    filters?: "object",
    timeRange: "string",
    visualization?: "string"  // chart, table, heatmap
  }
}
```

### Use Cases

**1. Smart Assignment:**
```bash
snow-flow swarm "Auto-assign new incidents using ML predictions"
```

**2. Proactive Resolution:**
```bash
snow-flow swarm "Recommend KB articles for high-priority incidents"
```

**3. Trend Analysis:**
```bash
snow-flow swarm "Analyze incident trends and predict next week's volume"
```

## 🔐 5. SSO/SAML Authentication (Enterprise Only)

```typescript
// Enterprise-only authentication tools
{
  name: "snow_configure_sso",
  description: "Configure SSO for ServiceNow instance",
  inputSchema: {
    provider: "string",       // okta, azure-ad, google
    idpMetadata: "string",    // XML or URL
    assertionConsumerUrl: "string",
    entityId: "string"
  }
}

{
  name: "snow_configure_saml",
  description: "Configure SAML 2.0 authentication",
  inputSchema: {
    idpCertificate: "string",
    ssoUrl: "string",
    logoutUrl?: "string",
    attributeMapping: "object"
  }
}
```

## 📋 Complete Tool Summary

### Total Tools by Category

| Category | Team Tier | Pro Tier | Enterprise Tier |
|----------|-----------|----------|-----------------|
| **Jira** | 4 basic | 8 full | 8 full |
| **Azure DevOps** | 0 | 10 full | 10 full |
| **Confluence** | 0 | 4 basic | 8 full |
| **Advanced ML** | 0 | 5 basic | 15 full |
| **SSO/SAML** | 0 | 0 | 2 full |
| **Total Tools** | **4** | **27** | **43** |

## 🔌 MCP Endpoint Structure

### Endpoint Pattern

```
POST /mcp/tools/call
{
  "tool": "snow_jira_sync_backlog",
  "arguments": { /* tool-specific */ },
  "credentials": {
    "jira": {
      "host": "company.atlassian.net",
      "email": "user@company.com",
      "apiToken": "xxx"
    },
    "azureDevOps": {
      "organization": "company",
      "pat": "xxx"
    },
    "confluence": {
      "host": "company.atlassian.net",
      "email": "user@company.com",
      "apiToken": "xxx"
    }
  }
}
```

### Response Format

```json
{
  "success": true,
  "result": {
    "syncedIssues": 42,
    "created": 10,
    "updated": 32,
    "skipped": 0,
    "errors": []
  },
  "usage": {
    "duration_ms": 5432,
    "timestamp": 1234567890,
    "toolName": "snow_jira_sync_backlog",
    "creditsUsed": 1
  }
}
```

## 💰 Pricing Model

### Suggested Pricing

| Tier | Price/Month | Tools | Rate Limit | Support |
|------|-------------|-------|------------|---------|
| **Team** | €49 | 4 Jira tools | 100/15min | Community |
| **Pro** | €149 | 27 tools | 500/15min | Email |
| **Enterprise** | €399 | 43 tools | 2000/15min | Priority + Dedicated |

### Usage-Based Add-ons (Optional)

- Extra API calls: €0.01 per 100 calls
- Custom ML model training: €99/model
- Custom tool development: €499/tool
- On-premise deployment: €999/month

## 🎯 Customer Credential Storage

### Secure Credential Management

**Option 1: Customer stores credentials (current plan):**
```json
// In customer's .env or config
{
  "JIRA_HOST": "company.atlassian.net",
  "JIRA_EMAIL": "user@company.com",
  "JIRA_API_TOKEN": "xxx",
  "AZDO_ORGANIZATION": "company",
  "AZDO_PAT": "xxx",
  "CONFLUENCE_HOST": "company.atlassian.net",
  "CONFLUENCE_API_TOKEN": "xxx"
}
```

**Option 2: Encrypted cloud storage (future enhancement):**
- Customer saves credentials once in admin UI
- Encrypted with customer-specific key
- Stored in GCP Secret Manager per license
- Passed to MCP tools automatically

## 🚀 Implementation Priority

### Phase 1 (Week 1): Core Platform
1. Database schema + Admin API
2. Admin UI (license management)
3. Basic analytics dashboard

### Phase 2 (Week 2): Jira Integration
4. Implement 8 Jira MCP tools
5. Test Jira sync flow
6. Customer beta testing

### Phase 3 (Week 3): Azure DevOps
7. Implement 10 Azure DevOps tools
8. Test DevOps workflows
9. Documentation

### Phase 4 (Week 4): Confluence + ML
10. Implement 8 Confluence tools
11. Implement 15 ML/Analytics tools
12. Performance optimization

### Phase 5 (Week 5): Polish + Launch
13. SSO/SAML tools
14. Advanced analytics
15. Marketing materials
16. Public launch 🚀

---

**Next:** Implement Phase 1 - Core Platform! 🎯
