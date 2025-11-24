/**
 * Enterprise Documentation Generator
 *
 * Automatically updates AGENTS.md and CLAUDE.md with comprehensive
 * enterprise integration instructions when user authenticates with
 * Snow-Flow Enterprise (Jira, Azure DevOps, Confluence).
 */

import fs from 'fs';
import path from 'path';

/**
 * Generate comprehensive enterprise workflow instructions
 */
export function generateEnterpriseInstructions(enabledServices: string[]): string {
  const hasJira = enabledServices.includes('jira');
  const hasAzdo = enabledServices.includes('azdo');
  const hasConfluence = enabledServices.includes('confluence');

  let instructions = `\n\n---\n\n# 🚀 ENTERPRISE INTEGRATIONS - AUTONOMOUS DEVELOPMENT WORKFLOW\n\n`;
  instructions += `**YOU HAVE ACCESS TO ENTERPRISE TOOLS:** ${enabledServices.map(s => s.toUpperCase()).join(', ')}\n\n`;
  instructions += `This is not just about fetching data - you have **FULL AUTONOMY** to manage the entire development lifecycle across platforms.\n\n`;

  // Add Jira instructions
  if (hasJira) {
    instructions += generateJiraInstructions();
  }

  // Add Azure DevOps instructions
  if (hasAzdo) {
    instructions += generateAzureDevOpsInstructions();
  }

  // Add Confluence instructions
  if (hasConfluence) {
    instructions += generateConfluenceInstructions();
  }

  // Add cross-platform workflow
  if (enabledServices.length > 1) {
    instructions += generateCrossPlatformWorkflow(hasJira, hasAzdo, hasConfluence);
  }

  return instructions;
}

function generateJiraInstructions(): string {
  return `## 🎯 JIRA - AUTONOMOUS STORY MANAGEMENT

### COMPLETE WORKFLOW (Not Just Reading!)

You are **NOT** a read-only integration. You have **FULL CONTROL** over Jira stories throughout the development lifecycle.

#### 1️⃣ STORY SELECTION & PLANNING

**Get Your Work:**
\`\`\`javascript
// Find stories assigned to you or ready for development
const stories = await jira_search_issues({
  jql: "project = MYPROJ AND status = 'Ready for Development' AND assignee = currentUser() ORDER BY priority DESC",
  maxResults: 10
});

// Or get specific sprint stories
const sprintStories = await jira_search_issues({
  jql: "project = MYPROJ AND sprint in openSprints() ORDER BY rank ASC"
});
\`\`\`

**Claim a Story:**
\`\`\`javascript
// Assign story to yourself and move to In Progress
await jira_transition_issue({
  issueKey: "MYPROJ-123",
  transitionIdOrName: "In Progress"
});

await jira_update_issue({
  issueKey: "MYPROJ-123",
  assignee: "currentUser" // Or specific username
});
\`\`\`

#### 2️⃣ ACTIVE DEVELOPMENT - CONTINUOUS UPDATES

**This is CRITICAL:** As you develop, **UPDATE THE STORY IN REAL-TIME**!

**Add Development Comments:**
\`\`\`javascript
// After creating Update Set
await jira_add_comment({
  issueKey: "MYPROJ-123",
  comment: \`🔧 Development Started

Update Set Created:
- Name: Feature: Auto-Assignment Logic
- Sys ID: abc123def456
- Environment: DEV

Components:
- Business Rule: Auto-assign incidents
- Script Include: AssignmentEngine
- UI Action: Manual Assignment Override
\`
});

// After completing a component
await jira_add_comment({
  issueKey: "MYPROJ-123",
  comment: \`✅ Component Complete: Business Rule "Auto-assign incidents"

Implementation:
- Triggers: Before Insert on incident table
- Logic: Category + Location based assignment
- Edge Cases: Handles no available groups, offline hours
- Tests: 15 test scenarios validated

Files Modified:
- sys_script_*.xml (Business Rule)
- Update Set: abc123def456
\`
});
\`\`\`

**Update Story Description with Technical Details:**
\`\`\`javascript
// Add architecture notes to description
await jira_update_issue({
  issueKey: "MYPROJ-123",
  description: originalDescription + \`

--- TECHNICAL IMPLEMENTATION ---

Architecture:
- Business Rule (Before Insert) → AssignmentEngine.autoAssign()
- Script Include: AssignmentEngine
  - Method: autoAssign(current)
  - Method: getAvailableGroups(category, location)
  - Method: calculateWorkload(groupId)

Database:
- Table: incident (trigger point)
- Fields: category, location, assignment_group

Integration Points:
- Group Availability API
- Workload Balancer Service

Edge Cases:
- No groups available → Default to "Unassigned" queue
- Multiple matches → Use workload balancing
- Offline hours → Route to 24/7 group

Testing:
- Unit tests: AssignmentEngine test suite
- Integration tests: 15 scenarios
- Performance: <200ms per assignment
\`
});
\`\`\`

#### 3️⃣ STORY COMPLETION - COMPREHENSIVE CLOSEOUT

**When Done, Provide COMPLETE Information:**

\`\`\`javascript
// 1. Add final summary comment
await jira_add_comment({
  issueKey: "MYPROJ-123",
  comment: \`🎉 IMPLEMENTATION COMPLETE

✅ Deliverables:
1. Business Rule: "Auto-assign incidents" (sys_id: br_12345)
2. Script Include: "AssignmentEngine" (sys_id: si_67890)
3. UI Action: "Manual Assignment Override" (sys_id: ua_11111)
4. Update Set: "Feature: Auto-Assignment Logic" (sys_id: us_22222)

📊 Testing Results:
- All 15 test scenarios passed
- Performance: Average 150ms per assignment
- Edge cases validated

📚 Documentation:
- Confluence: https://company.atlassian.net/wiki/spaces/DEV/pages/123456
  - Architecture Overview
  - API Documentation
  - Troubleshooting Guide
- ServiceNow Update Set includes inline comments

🚀 Deployment:
- Ready for TEST environment
- Update Set complete: us_22222
- No breaking changes
- Backward compatible

📦 Update Set Contents:
- 1 Business Rule
- 1 Script Include
- 1 UI Action
- 3 ACL modifications
- 2 UI Policies

View Update Set: https://dev123456.service-now.com/sys_update_set.do?sys_id=us_22222
\`
});

// 2. Add Update Set link as custom field (if available)
await jira_update_issue({
  issueKey: "MYPROJ-123",
  customFields: {
    customfield_10050: "us_22222", // Update Set ID field
    customfield_10051: "https://dev123456.service-now.com/sys_update_set.do?sys_id=us_22222" // Update Set URL
  }
});

// 3. Link to Confluence documentation
await jira_add_comment({
  issueKey: "MYPROJ-123",
  comment: "[View Complete Documentation|https://company.atlassian.net/wiki/spaces/DEV/pages/123456]"
});

// 4. Move to Done
await jira_transition_issue({
  issueKey: "MYPROJ-123",
  transitionIdOrName: "Done",
  fields: {
    resolution: { name: "Done" },
    comment: "Implementation complete. All acceptance criteria met. Ready for TEST deployment."
  }
});
\`\`\`

#### 4️⃣ PROACTIVE STORY MANAGEMENT

**Block Stories When Needed:**
\`\`\`javascript
// If you discover a blocker during development
await jira_transition_issue({
  issueKey: "MYPROJ-123",
  transitionIdOrName: "Blocked"
});

await jira_add_comment({
  issueKey: "MYPROJ-123",
  comment: \`⚠️ BLOCKED

Issue: Missing API access to Group Availability Service

Impact: Cannot implement automatic group assignment
Workaround: Using manual assignment temporarily
Action Needed: DevOps team to provision API credentials

Created blocker ticket: MYPROJ-124
\`
});

// Create blocker ticket
await jira_create_issue({
  project: "MYPROJ",
  summary: "Provide API access to Group Availability Service",
  description: "Needed for MYPROJ-123 implementation",
  issueType: "Task",
  priority: "High",
  labels: ["blocker", "devops"]
});
\`\`\`

**Link Related Issues:**
\`\`\`javascript
// Link to related stories
await jira_link_issues({
  inwardIssue: "MYPROJ-123",
  outwardIssue: "MYPROJ-100", // Parent epic
  linkType: "relates to"
});
\`\`\`

### 🎯 AVAILABLE JIRA TOOLS

1. **jira_search_issues** - Find stories with JQL
2. **jira_get_issue** - Get detailed story info
3. **jira_create_issue** - Create new stories/bugs/tasks
4. **jira_update_issue** - Update story fields
5. **jira_transition_issue** - Move story through workflow (To Do → In Progress → Done)
6. **jira_add_comment** - Add development updates
7. **jira_link_issues** - Link related stories
8. **jira_sync_to_servicenow** - Sync Jira backlog to ServiceNow

### 💡 BEST PRACTICES

1. **Update Stories in Real-Time** - Don't wait until the end!
2. **Document as You Go** - Add comments after each major step
3. **Link Everything** - Update Sets, Confluence docs, related stories
4. **Be Specific** - Provide technical details, not just "completed"
5. **Include Testing** - Document what you tested and results
6. **Think About Deployment** - Provide deployment notes in final comment

`;
}

function generateAzureDevOpsInstructions(): string {
  return `## 🔷 AZURE DEVOPS - AUTONOMOUS WORK ITEM MANAGEMENT

### COMPLETE WORKFLOW (Full Control!)

You have **FULL AUTONOMY** over Azure DevOps work items - not just reading, but managing the entire lifecycle.

#### 1️⃣ WORK ITEM SELECTION

**Get Your Work:**
\`\`\`javascript
// Find work items assigned to you
const workItems = await azure_search_work_items({
  wiql: "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.AssignedTo] = @Me AND [System.State] = 'New' ORDER BY [Microsoft.VSTS.Common.Priority] ASC",
  project: "MyProject"
});

// Or get sprint work items
const sprintItems = await azure_search_work_items({
  wiql: "SELECT * FROM WorkItems WHERE [System.IterationPath] = @CurrentIteration AND [System.State] <> 'Closed'",
  project: "MyProject"
});
\`\`\`

**Start Work:**
\`\`\`javascript
// Move to Active and assign to yourself
await azure_update_work_item({
  workItemId: 1234,
  project: "MyProject",
  updates: {
    "System.State": "Active",
    "System.AssignedTo": "user@company.com"
  }
});
\`\`\`

#### 2️⃣ CONTINUOUS UPDATES DURING DEVELOPMENT

**Add Development Progress:**
\`\`\`javascript
// After creating Update Set
await azure_add_work_item_comment({
  workItemId: 1234,
  project: "MyProject",
  comment: \`🔧 Development Started

Update Set: Feature: Dashboard Widget
- Sys ID: us_abc123
- Environment: DEV
- Link: https://dev123456.service-now.com/sys_update_set.do?sys_id=us_abc123

Components:
- Widget: incident_dashboard
- Portal Page: IT Dashboard
- Client Script: Dashboard Controller
\`
});

// Update remaining work
await azure_update_work_item({
  workItemId: 1234,
  project: "MyProject",
  updates: {
    "Microsoft.VSTS.Scheduling.RemainingWork": 4 // hours remaining
  }
});
\`\`\`

#### 3️⃣ COMPLETION WITH FULL TRACEABILITY

\`\`\`javascript
// Final update with complete information
await azure_add_work_item_comment({
  workItemId: 1234,
  project: "MyProject",
  comment: \`✅ IMPLEMENTATION COMPLETE

Deliverables:
1. Widget: "incident_dashboard" (sys_id: sp_widget_123)
2. Portal Page: "IT Dashboard" (sys_id: sp_page_456)
3. Client Script: Dashboard controller
4. Server Script: Data aggregation logic
5. CSS: Custom dashboard styles

Update Set:
- Name: Feature: Dashboard Widget
- Sys ID: us_abc123
- URL: https://dev123456.service-now.com/sys_update_set.do?sys_id=us_abc123

Testing:
- Unit tests: All passed
- Integration tests: 12 scenarios validated
- Performance: Load time < 2s
- Browser compatibility: Chrome, Firefox, Safari, Edge

Documentation:
- Confluence: https://company.atlassian.net/wiki/spaces/DEV/pages/789012
- Inline code comments
- README in Update Set

Ready for UAT deployment
\`
});

// Move to Closed
await azure_update_work_item({
  workItemId: 1234,
  project: "MyProject",
  updates: {
    "System.State": "Closed",
    "Microsoft.VSTS.Scheduling.RemainingWork": 0,
    "Microsoft.VSTS.Common.ClosedDate": new Date().toISOString(),
    "System.Reason": "Completed"
  }
});
\`\`\`

### 🎯 AVAILABLE AZURE DEVOPS TOOLS

1. **azure_search_work_items** - Find work items with WIQL
2. **azure_get_work_item** - Get detailed work item info
3. **azure_create_work_item** - Create new work items
4. **azure_update_work_item** - Update work item fields
5. **azure_add_work_item_comment** - Add development updates
6. **azure_link_work_items** - Link related work items
7. **azure_sync_to_servicenow** - Sync Azure DevOps backlog to ServiceNow

`;
}

function generateConfluenceInstructions(): string {
  return `## 📚 CONFLUENCE - AUTONOMOUS DOCUMENTATION

### CREATE LIVING DOCUMENTATION

You don't just reference documentation - you **CREATE AND MAINTAIN** it!

#### 1️⃣ CREATE DOCUMENTATION FOR EVERY FEATURE

**After Completing Development:**
\`\`\`javascript
// Create comprehensive feature documentation
const page = await confluence_create_page({
  spaceKey: "DEV",
  title: "Feature: Incident Auto-Assignment",
  content: \`
<h1>Incident Auto-Assignment Feature</h1>

<h2>Overview</h2>
<p>Automatically assigns incoming incidents to appropriate support groups based on category and location.</p>

<h2>Architecture</h2>
<ac:structured-macro ac:name="code">
  <ac:parameter ac:name="language">javascript</ac:parameter>
  <ac:plain-text-body><![CDATA[
// Business Rule: Auto-assign incidents
// Triggers: Before Insert on incident table
// Script Include: AssignmentEngine

var engine = new AssignmentEngine();
engine.autoAssign(current);
  ]]></ac:plain-text-body>
</ac:structured-macro>

<h2>Components</h2>
<table>
  <tr><th>Component</th><th>Sys ID</th><th>Description</th></tr>
  <tr>
    <td>Business Rule</td>
    <td>br_12345</td>
    <td>Triggers auto-assignment logic</td>
  </tr>
  <tr>
    <td>Script Include</td>
    <td>si_67890</td>
    <td>AssignmentEngine with assignment algorithms</td>
  </tr>
  <tr>
    <td>UI Action</td>
    <td>ua_11111</td>
    <td>Manual assignment override</td>
  </tr>
</table>

<h2>ServiceNow Links</h2>
<ul>
  <li><a href="https://dev123456.service-now.com/sys_update_set.do?sys_id=us_22222">Update Set</a></li>
  <li><a href="https://dev123456.service-now.com/sys_script.do?sys_id=br_12345">Business Rule</a></li>
  <li><a href="https://dev123456.service-now.com/sys_script_include.do?sys_id=si_67890">Script Include</a></li>
</ul>

<h2>Testing</h2>
<p>All test scenarios validated:</p>
<ul>
  <li>✓ Single group match - Assigns correctly</li>
  <li>✓ Multiple groups - Uses workload balancing</li>
  <li>✓ No groups available - Routes to default queue</li>
  <li>✓ Offline hours - Routes to 24/7 group</li>
</ul>

<h2>Deployment History</h2>
<table>
  <tr><th>Environment</th><th>Date</th><th>Status</th></tr>
  <tr><td>DEV</td><td>2025-01-15</td><td>✅ Deployed</td></tr>
  <tr><td>TEST</td><td>Pending</td><td>⏳ Scheduled</td></tr>
</table>
\`,
  parentPageId: "123456" // Parent page in documentation space
});

// Link back to Jira
await jira_add_comment({
  issueKey: "MYPROJ-123",
  comment: \`📚 Documentation Created

Complete technical documentation available:
\${page.url}

Includes:
- Architecture overview
- Component details with Sys IDs
- Testing scenarios
- Deployment instructions
\`
});
\`\`\`

#### 2️⃣ UPDATE DOCUMENTATION AS CODE EVOLVES

**When Making Changes:**
\`\`\`javascript
// Get existing page
const existingPage = await confluence_get_page({
  pageId: "789012",
  expand: ["body.storage", "version"]
});

// Update with new information
await confluence_update_page({
  pageId: "789012",
  title: existingPage.title,
  content: existingPage.body.storage.value + \`
<h2>Update: Enhanced Workload Balancing (v2.0)</h2>
<p>Added: January 20, 2025</p>
<p>Enhanced the workload balancing algorithm to consider:</p>
<ul>
  <li>Current ticket count per agent</li>
  <li>Average resolution time</li>
  <li>Agent availability status</li>
</ul>

<p>Update Set: <a href="https://dev123456.service-now.com/sys_update_set.do?sys_id=us_33333">Enhancement v2.0</a></p>
\`,
  version: existingPage.version.number + 1
});
\`\`\`

#### 3️⃣ CREATE TROUBLESHOOTING GUIDES

\`\`\`javascript
// Document common issues and solutions
await confluence_create_page({
  spaceKey: "SUPPORT",
  title: "Troubleshooting: Auto-Assignment Not Working",
  content: \`
<h1>Troubleshooting: Auto-Assignment Issues</h1>

<h2>Symptom: Incidents not being assigned automatically</h2>

<h3>Check 1: Business Rule Active</h3>
<p>Verify business rule "Auto-assign incidents" is active:</p>
<code>Navigate to: System Definition > Business Rules > Auto-assign incidents</code>
<p>✓ Active checkbox must be checked</p>

<h3>Check 2: Assignment Groups Configured</h3>
<p>Verify assignment groups exist for category/location combinations</p>

<h3>Check 3: Script Errors</h3>
<p>Check System Log for errors:</p>
<code>gs.error() messages from AssignmentEngine</code>

<h2>Common Solutions</h2>
<ol>
  <li>Clear cache: Navigate to System Definition > Cache Administration</li>
  <li>Verify group membership</li>
  <li>Check ACLs on assignment_group field</li>
</ol>
\`
});
\`\`\`

### 🎯 AVAILABLE CONFLUENCE TOOLS

1. **confluence_discover_configuration** - Discover available spaces
2. **confluence_create_page** - Create new documentation pages
3. **confluence_update_page** - Update existing documentation
4. **confluence_get_page** - Get page content
5. **confluence_search_content** - Search documentation
6. **confluence_get_space_pages** - List all pages in space
7. **confluence_delete_page** - Archive outdated documentation

`;
}

function generateCrossPlatformWorkflow(hasJira: boolean, hasAzdo: boolean, hasConfluence: boolean): string {
  let workflow = `## 🔄 CROSS-PLATFORM AUTONOMOUS WORKFLOW

### THE COMPLETE DEVELOPMENT LIFECYCLE

This is how you operate with **FULL AUTONOMY** across all platforms:

`;

  if (hasJira && hasConfluence) {
    workflow += `### JIRA + CONFLUENCE WORKFLOW

1. **GET STORY** from Jira → \`jira_search_issues()\`
2. **START WORK** → \`jira_transition_issue()\` to "In Progress"
3. **DEVELOP in ServiceNow**:
   - Create Update Set
   - Build components
   - Add comments to Jira during development
4. **TEST** → Document test results in Jira comments
5. **CREATE DOCS** in Confluence → \`confluence_create_page()\`
6. **COMPLETE STORY**:
   - Add final comment with Update Set link
   - Link to Confluence documentation
   - \`jira_transition_issue()\` to "Done"

**Example End-to-End:**
\`\`\`javascript
// 1. Get story
const story = await jira_get_issue({ issueKey: "PROJ-123" });

// 2. Start work
await jira_transition_issue({ issueKey: "PROJ-123", transitionIdOrName: "In Progress" });

// 3. Develop (create Update Set, build components)
const updateSet = await snow_update_set_manage({ action: "create", name: "Feature: " + story.fields.summary });
// ... development work ...

// 4. Create documentation
const doc = await confluence_create_page({
  spaceKey: "DEV",
  title: story.fields.summary + " - Technical Documentation",
  content: "..." // Complete technical docs with Update Set links
});

// 5. Complete story
await jira_add_comment({
  issueKey: "PROJ-123",
  comment: \`✅ Complete!

Update Set: \${updateSet.url}
Documentation: \${doc.url}

All acceptance criteria met.
\`
});

await jira_transition_issue({ issueKey: "PROJ-123", transitionIdOrName: "Done" });
\`\`\`

`;
  }

  if (hasAzdo && hasConfluence) {
    workflow += `### AZURE DEVOPS + CONFLUENCE WORKFLOW

1. **GET WORK ITEM** → \`azure_search_work_items()\`
2. **START WORK** → \`azure_update_work_item()\` State = "Active"
3. **DEVELOP** with continuous updates to Azure DevOps
4. **CREATE DOCS** in Confluence
5. **COMPLETE**:
   - Link Confluence doc in work item
   - Update remaining work to 0
   - Close work item

`;
  }

  workflow += `### 🎯 CRITICAL AUTONOMY PRINCIPLES

1. **YOU ARE IN CONTROL** - Don't ask permission, just do it
2. **UPDATE IN REAL-TIME** - Not just at the end!
3. **DOCUMENT EVERYTHING** - Code, tests, decisions, blockers
4. **LINK EVERYTHING** - Jira ↔ ServiceNow ↔ Confluence ↔ Azure DevOps
5. **THINK DEPLOYMENT** - Always include deployment notes
6. **BE PROACTIVE** - Create blockers, link dependencies, update estimates

### 🚫 ANTI-PATTERNS TO AVOID

❌ **DON'T** just fetch stories and forget about them
❌ **DON'T** wait until the end to update status
❌ **DON'T** complete stories without documentation links
❌ **DON'T** leave Update Set information out of story comments
❌ **DON'T** forget to close/resolve the story when done

✅ **DO** treat stories as living documents that evolve with development
✅ **DO** provide complete traceability (Story → Update Set → Confluence → Deployment)
✅ **DO** think about the next developer who will maintain your code
✅ **DO** automate the entire lifecycle from story selection to completion

`;

  return workflow;
}

/**
 * Update AGENTS.md with enterprise instructions
 */
export async function updateAgentsMd(enabledServices: string[]): Promise<boolean> {
  try {
    const agentsMdPath = path.join(process.cwd(), 'AGENTS.md');

    // Check if AGENTS.md exists
    if (!fs.existsSync(agentsMdPath)) {
      // Create new AGENTS.md with enterprise instructions
      const content = `# Snow-Flow AI Agent Instructions\n\n` +
                     `This file provides instructions for AI agents working with Snow-Flow.\n` +
                     generateEnterpriseInstructions(enabledServices);
      fs.writeFileSync(agentsMdPath, content, 'utf-8');
      return true;
    }

    // Read existing AGENTS.md
    let content = fs.readFileSync(agentsMdPath, 'utf-8');

    // Remove old enterprise section if exists
    const enterpriseMarker = '# 🚀 ENTERPRISE INTEGRATIONS - AUTONOMOUS DEVELOPMENT WORKFLOW';
    const startIndex = content.indexOf(enterpriseMarker);
    if (startIndex !== -1) {
      // Find the next main heading or end of file
      const nextHeadingIndex = content.indexOf('\n# ', startIndex + 1);
      if (nextHeadingIndex !== -1) {
        content = content.substring(0, startIndex) + content.substring(nextHeadingIndex);
      } else {
        content = content.substring(0, startIndex);
      }
    }

    // Add new enterprise instructions
    content += generateEnterpriseInstructions(enabledServices);

    fs.writeFileSync(agentsMdPath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to update AGENTS.md:', error);
    return false;
  }
}

/**
 * Update CLAUDE.md with enterprise instructions
 */
export async function updateClaudeMd(enabledServices: string[]): Promise<boolean> {
  try {
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');

    // Check if CLAUDE.md exists
    if (!fs.existsSync(claudeMdPath)) {
      return false; // Don't create CLAUDE.md if it doesn't exist
    }

    // Read existing CLAUDE.md
    let content = fs.readFileSync(claudeMdPath, 'utf-8');

    // Remove old enterprise section if exists
    const enterpriseMarker = '# 🚀 ENTERPRISE INTEGRATIONS - AUTONOMOUS DEVELOPMENT WORKFLOW';
    const startIndex = content.indexOf(enterpriseMarker);
    if (startIndex !== -1) {
      const nextHeadingIndex = content.indexOf('\n# ', startIndex + 1);
      if (nextHeadingIndex !== -1) {
        content = content.substring(0, startIndex) + content.substring(nextHeadingIndex);
      } else {
        content = content.substring(0, startIndex);
      }
    }

    // Add new enterprise instructions
    content += generateEnterpriseInstructions(enabledServices);

    fs.writeFileSync(claudeMdPath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to update CLAUDE.md:', error);
    return false;
  }
}
