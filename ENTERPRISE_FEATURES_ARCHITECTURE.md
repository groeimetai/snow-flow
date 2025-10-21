# Snow-Flow Enterprise Features - Technical Architecture

**Complete Architecture for Jira, Azure DevOps, and Confluence Integration**

This document provides detailed technical specifications for Snow-Flow's enterprise features, designed for co-development with Capgemini or independent implementation.

---

## Table of Contents

1. [Overview](#overview)
2. [Jira Integration Suite](#jira-integration-suite)
3. [Azure DevOps Integration Suite](#azure-devops-integration-suite)
4. [Confluence Integration Suite](#confluence-integration-suite)
5. [Enterprise SSO/SAML](#enterprise-ssosaml)
6. [Advanced Audit Logging](#advanced-audit-logging)
7. [License Validation System](#license-validation-system)
8. [Deployment Architecture](#deployment-architecture)

---

## Overview

### Enterprise Features Philosophy

**Core Principles:**
1. **Extend, Don't Fork** - Enterprise features extend `@snow-flow/core`, never modify it
2. **Modular Architecture** - Each integration is independent, can be enabled/disabled
3. **API-First** - All features exposed as MCP tools for AI assistant integration
4. **Secure by Default** - License validation, encryption, audit logging built-in

### Technology Stack

**Core Dependencies** (from `@snow-flow/core`):
- TypeScript 5.9+
- Node.js 20+
- Axios (HTTP client)
- MCP SDK 1.0+ (Model Context Protocol)

**Enterprise-Specific Dependencies**:
- `jira-client` 8.2+ - Jira REST API wrapper
- `azure-devops-node-api` 12.5+ - Azure DevOps API wrapper
- `@atlassian/confluence` 2.0+ - Confluence REST API wrapper
- `jsonwebtoken` 9.0+ - JWT for license validation
- `saml2-js` 4.0+ - SAML 2.0 SSO
- `ldapjs` 3.0+ - LDAP/Active Directory
- `winston` 4.0+ - Structured logging

---

## Jira Integration Suite

### Feature Overview

**Bi-Directional Synchronization:**
- Jira → ServiceNow: Import stories/epics/tasks
- ServiceNow → Jira: Update status, comments, attachments
- Real-time: Webhooks for instant updates
- AI-Powered: Extract requirements, acceptance criteria, technical specs

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Developer                                │
│                                                                   │
│  snow-flow dev start SNOW-456                                   │
│                                                                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Snow-Flow Enterprise                             │
│                 Jira Sync Engine                                 │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Backlog     │  │   AI Parser  │  │   Webhook    │         │
│  │  Importer    │  │  (Claude)    │  │   Handler    │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Jira REST API   │  │ Claude API      │  │ Jira Webhooks   │
│                 │  │ (Requirement    │  │ (Real-time)     │
│ - Stories       │  │  Parsing)       │  │                 │
│ - Epics         │  │                 │  │ - Status change │
│ - Tasks         │  └─────────────────┘  │ - Comments      │
│ - Comments      │                        │ - Attachments   │
└────────┬────────┘                        └────────┬────────┘
         │                                          │
         │                                          │
         ▼                                          ▼
┌─────────────────────────────────────────────────────────────────┐
│               ServiceNow Instance                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Tasks       │  │  Attachments │  │  Work Notes  │         │
│  │  (imported)  │  │  (synced)    │  │  (comments)  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

### Component 1: Backlog Importer

**Purpose:** Import Jira stories/epics/tasks into ServiceNow

**File:** `src/integrations/jira/backlog-importer.ts`

```typescript
/**
 * Jira Backlog Importer
 * Imports stories, epics, tasks from Jira to ServiceNow
 */

import { JiraClient } from './jira-client.js';
import { ServiceNowClient } from '@snow-flow/core';
import { AIParser } from './ai-parser.js';

export interface JiraStory {
  key: string;              // PROJ-123
  summary: string;          // Story title
  description: string;      // Story description
  storyPoints?: number;     // Estimate
  priority: string;         // High, Medium, Low
  status: string;           // To Do, In Progress, Done
  assignee?: string;        // Email or username
  reporter: string;
  labels: string[];
  components: string[];
  epic?: string;            // Epic key (PROJ-100)
  acceptanceCriteria?: string;
  attachments: JiraAttachment[];
  comments: JiraComment[];
  created: Date;
  updated: Date;
}

export interface JiraAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;  // Download URL
}

export interface JiraComment {
  id: string;
  author: string;
  body: string;
  created: Date;
}

export interface ServiceNowTask {
  short_description: string;
  description: string;
  priority: number;         // 1-5 (ServiceNow)
  state: number;            // 1=New, 2=In Progress, 3=Complete
  assigned_to?: string;     // sys_id of user
  work_notes: string;
  u_jira_key: string;       // Custom field: Jira story key
  u_story_points?: number;  // Custom field
  u_acceptance_criteria?: string; // Custom field
}

export class JiraBacklogImporter {
  constructor(
    private jira: JiraClient,
    private snow: ServiceNowClient,
    private aiParser: AIParser
  ) {}

  /**
   * Import entire backlog for a Jira project
   */
  async importBacklog(projectKey: string, sprint?: string): Promise<ImportResult> {
    // 1. Fetch stories from Jira
    const stories = await this.jira.getBacklog(projectKey, sprint);

    // 2. Parse each story with AI
    const parsedStories = await Promise.all(
      stories.map(story => this.aiParser.parseRequirements(story))
    );

    // 3. Create ServiceNow tasks
    const snowTasks: ServiceNowTask[] = [];
    for (const parsed of parsedStories) {
      const task = await this.createServiceNowTask(parsed);
      snowTasks.push(task);
    }

    // 4. Setup webhooks for real-time sync
    await this.setupWebhooks(stories, snowTasks);

    return {
      imported: snowTasks.length,
      stories: snowTasks,
      webhooksConfigured: true
    };
  }

  /**
   * Create a ServiceNow task from Jira story
   */
  private async createServiceNowTask(story: ParsedStory): Promise<ServiceNowTask> {
    // Map Jira priority to ServiceNow priority
    const priorityMap = {
      'Highest': 1,
      'High': 2,
      'Medium': 3,
      'Low': 4,
      'Lowest': 5
    };

    // Map Jira status to ServiceNow state
    const stateMap = {
      'To Do': 1,        // New
      'In Progress': 2,  // In Progress
      'In Review': 2,    // In Progress
      'Done': 3          // Complete
    };

    // Find or create ServiceNow user
    const assignee = story.assignee
      ? await this.snow.findUserByEmail(story.assignee)
      : null;

    // Prepare task data
    const taskData: ServiceNowTask = {
      short_description: `[${story.jiraKey}] ${story.summary}`,
      description: this.formatDescription(story),
      priority: priorityMap[story.priority] || 3,
      state: stateMap[story.status] || 1,
      assigned_to: assignee?.sys_id,
      work_notes: this.formatComments(story.comments),
      u_jira_key: story.jiraKey,
      u_story_points: story.storyPoints,
      u_acceptance_criteria: story.acceptanceCriteria
    };

    // Create task in ServiceNow
    const response = await this.snow.create('task', taskData);

    // Upload attachments
    if (story.attachments.length > 0) {
      await this.uploadAttachments(response.sys_id, story.attachments);
    }

    return response;
  }

  /**
   * Format description with requirements and technical specs
   */
  private formatDescription(story: ParsedStory): string {
    let desc = `## Story\n${story.description}\n\n`;

    if (story.requirements.length > 0) {
      desc += `## Requirements\n`;
      story.requirements.forEach((req, i) => {
        desc += `${i + 1}. ${req}\n`;
      });
      desc += `\n`;
    }

    if (story.technicalSpecs.length > 0) {
      desc += `## Technical Specifications\n`;
      story.technicalSpecs.forEach(spec => {
        desc += `- ${spec}\n`;
      });
      desc += `\n`;
    }

    if (story.acceptanceCriteria) {
      desc += `## Acceptance Criteria\n${story.acceptanceCriteria}\n`;
    }

    desc += `\n---\n`;
    desc += `Imported from Jira: ${story.jiraKey}\n`;
    desc += `Original URL: https://your-jira.atlassian.net/browse/${story.jiraKey}`;

    return desc;
  }

  /**
   * Upload Jira attachments to ServiceNow
   */
  private async uploadAttachments(
    taskSysId: string,
    attachments: JiraAttachment[]
  ): Promise<void> {
    for (const attachment of attachments) {
      // Download from Jira
      const fileData = await this.jira.downloadAttachment(attachment.url);

      // Upload to ServiceNow
      await this.snow.uploadAttachment({
        table: 'task',
        sys_id: taskSysId,
        filename: attachment.filename,
        data: fileData,
        content_type: attachment.mimeType
      });
    }
  }
}
```

### Component 2: AI-Powered Requirement Parser

**Purpose:** Extract structured requirements from free-text Jira descriptions

**File:** `src/integrations/jira/ai-parser.ts`

```typescript
/**
 * AI-Powered Requirement Parser
 * Uses Claude/GPT to extract requirements, acceptance criteria, technical specs
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ParsedStory {
  jiraKey: string;
  summary: string;
  description: string;
  priority: string;
  status: string;
  assignee?: string;
  storyPoints?: number;

  // AI-parsed fields
  requirements: string[];        // Extracted functional requirements
  technicalSpecs: string[];      // Technical specifications
  acceptanceCriteria: string;    // Formatted acceptance criteria
  suggestedTasks: string[];      // AI-suggested implementation tasks
  estimatedComplexity: 'Low' | 'Medium' | 'High';
  tags: string[];                // Auto-generated tags for categorization

  // Original data
  attachments: JiraAttachment[];
  comments: JiraComment[];
}

export class AIParser {
  private claude: Anthropic;

  constructor(apiKey: string) {
    this.claude = new Anthropic({ apiKey });
  }

  /**
   * Parse Jira story with AI
   */
  async parseRequirements(story: JiraStory): Promise<ParsedStory> {
    const prompt = this.buildPrompt(story);

    const response = await this.claude.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const parsed = JSON.parse(response.content[0].text);

    return {
      jiraKey: story.key,
      summary: story.summary,
      description: story.description,
      priority: story.priority,
      status: story.status,
      assignee: story.assignee,
      storyPoints: story.storyPoints,
      attachments: story.attachments,
      comments: story.comments,
      ...parsed
    };
  }

  /**
   * Build AI prompt for requirement extraction
   */
  private buildPrompt(story: JiraStory): string {
    return `You are a technical requirements analyst. Parse this Jira story and extract structured information.

**Jira Story:**
Key: ${story.key}
Summary: ${story.summary}
Description:
${story.description}

Priority: ${story.priority}
Story Points: ${story.storyPoints || 'Not estimated'}
Labels: ${story.labels.join(', ')}

${story.acceptanceCriteria ? `Acceptance Criteria:\n${story.acceptanceCriteria}` : ''}

**Comments:**
${story.comments.map(c => `${c.author}: ${c.body}`).join('\n')}

---

Extract the following information as JSON:

{
  "requirements": [
    // List of functional requirements (what the system should do)
    // Extract from description, acceptance criteria, comments
  ],
  "technicalSpecs": [
    // Technical implementation details
    // Examples: "Use REST API", "Create ServiceNow widget", "Store in custom table"
  ],
  "acceptanceCriteria": "Formatted acceptance criteria (clear bullet points)",
  "suggestedTasks": [
    // Breakdown into specific developer tasks
    // Examples: "Create database table", "Implement API endpoint", "Build UI component"
  ],
  "estimatedComplexity": "Low|Medium|High",
  "tags": [
    // Auto-generated tags for categorization
    // Examples: "api", "ui", "database", "integration"
  ]
}

Return ONLY the JSON, no additional text.`;
  }
}
```

### Component 3: Webhook Handler (Real-Time Sync)

**Purpose:** Real-time updates from Jira to ServiceNow

**File:** `src/integrations/jira/webhook-handler.ts`

```typescript
/**
 * Jira Webhook Handler
 * Listens for Jira webhooks and updates ServiceNow in real-time
 */

import express, { Request, Response } from 'express';
import { ServiceNowClient } from '@snow-flow/core';
import crypto from 'crypto';

export interface JiraWebhookEvent {
  webhookEvent: string;     // 'jira:issue_updated', 'jira:issue_created', etc.
  issue: JiraIssue;
  user: JiraUser;
  changelog?: JiraChangelog;
  timestamp: number;
}

export class JiraWebhookHandler {
  private app: express.Application;
  private snow: ServiceNowClient;
  private webhookSecret: string;

  constructor(snow: ServiceNowClient, webhookSecret: string) {
    this.snow = snow;
    this.webhookSecret = webhookSecret;
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Setup Express routes for webhooks
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    // Jira webhook endpoint
    this.app.post('/webhooks/jira', async (req: Request, res: Response) => {
      try {
        // Verify webhook signature
        if (!this.verifySignature(req)) {
          res.status(401).send('Invalid signature');
          return;
        }

        const event: JiraWebhookEvent = req.body;
        await this.handleWebhook(event);

        res.status(200).send('OK');
      } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).send('Internal error');
      }
    });
  }

  /**
   * Verify Jira webhook signature
   */
  private verifySignature(req: Request): boolean {
    const signature = req.headers['x-hub-signature'] as string;
    if (!signature) return false;

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(JSON.stringify(req.body));
    const computed = 'sha256=' + hmac.digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(computed)
    );
  }

  /**
   * Handle webhook event
   */
  private async handleWebhook(event: JiraWebhookEvent): Promise<void> {
    switch (event.webhookEvent) {
      case 'jira:issue_updated':
        await this.handleIssueUpdated(event);
        break;

      case 'jira:issue_created':
        await this.handleIssueCreated(event);
        break;

      case 'comment_created':
        await this.handleCommentCreated(event);
        break;

      case 'attachment_created':
        await this.handleAttachmentCreated(event);
        break;
    }
  }

  /**
   * Handle issue updated event
   */
  private async handleIssueUpdated(event: JiraWebhookEvent): Promise<void> {
    const jiraKey = event.issue.key;

    // Find ServiceNow task by Jira key
    const task = await this.snow.query('task', `u_jira_key=${jiraKey}`);
    if (!task || task.length === 0) {
      console.log(`No ServiceNow task found for ${jiraKey}`);
      return;
    }

    const taskSysId = task[0].sys_id;
    const updates: any = {};

    // Check what changed
    if (event.changelog) {
      for (const change of event.changelog.items) {
        switch (change.field) {
          case 'status':
            // Update ServiceNow state
            const stateMap = {
              'To Do': 1,
              'In Progress': 2,
              'Done': 3
            };
            updates.state = stateMap[change.toString] || 1;
            break;

          case 'assignee':
            // Update ServiceNow assigned_to
            const user = await this.snow.findUserByEmail(change.toString);
            updates.assigned_to = user?.sys_id;
            break;

          case 'priority':
            // Update ServiceNow priority
            const priorityMap = {
              'Highest': 1,
              'High': 2,
              'Medium': 3,
              'Low': 4
            };
            updates.priority = priorityMap[change.toString] || 3;
            break;
        }
      }
    }

    // Update ServiceNow task
    if (Object.keys(updates).length > 0) {
      await this.snow.update('task', taskSysId, updates);
      console.log(`Updated ServiceNow task ${taskSysId} from Jira ${jiraKey}`);
    }
  }

  /**
   * Start webhook server
   */
  start(port: number = 3000): void {
    this.app.listen(port, () => {
      console.log(`Jira webhook server listening on port ${port}`);
      console.log(`Webhook URL: http://your-server:${port}/webhooks/jira`);
    });
  }
}
```

### MCP Tools for Jira Integration

**File:** `src/integrations/jira/tools/snow_jira_sync_backlog.ts`

```typescript
/**
 * MCP Tool: snow_jira_sync_backlog
 * Sync Jira backlog to ServiceNow
 */

import { z } from 'zod';

export const toolDefinition = {
  name: 'snow_jira_sync_backlog',
  description: 'Import Jira backlog (stories/epics/tasks) into ServiceNow with AI-powered requirement parsing',
  inputSchema: z.object({
    projectKey: z.string().describe('Jira project key (e.g., PROJ, SNOW)'),
    sprint: z.string().optional().describe('Specific sprint name (optional, imports all if not specified)'),
    aiParse: z.boolean().default(true).describe('Use AI to parse requirements and acceptance criteria'),
    setupWebhooks: z.boolean().default(true).describe('Setup real-time webhooks for sync')
  })
};

export async function execute(params: z.infer<typeof toolDefinition.inputSchema>) {
  const { projectKey, sprint, aiParse, setupWebhooks } = params;

  // Implementation using JiraBacklogImporter
  const importer = new JiraBacklogImporter(jiraClient, snowClient, aiParser);

  const result = await importer.importBacklog(projectKey, sprint);

  return {
    success: true,
    imported: result.imported,
    stories: result.stories.map(s => ({
      jiraKey: s.u_jira_key,
      snowSysId: s.sys_id,
      summary: s.short_description
    })),
    webhooksConfigured: result.webhooksConfigured,
    message: `Imported ${result.imported} stories from Jira project ${projectKey}`
  };
}
```

**Developer Workflow with Jira Integration:**

```bash
# 1. Sync entire Jira backlog to ServiceNow
$ snow-flow jira sync --project SNOW

🔄 Syncing Jira backlog...
✅ Imported 25 stories from SNOW project
   • SNOW-123: Create Incident Dashboard Widget
   • SNOW-124: Add Priority Charts
   • SNOW-125: Implement SLA Timers
   ...

# 2. Start working on a specific story
$ snow-flow dev start SNOW-123

📖 Loading context from Jira SNOW-123...
   ✅ Story: "Create Incident Dashboard Widget"
   ✅ Requirements:
      1. Display active incidents in real-time
      2. Mobile-responsive design
      3. Filter by priority and category
   ✅ Acceptance Criteria:
      - Widget loads in < 2 seconds
      - Works on mobile (viewport < 768px)
      - Filters persist across sessions
   ✅ Technical Specs:
      - Use Service Portal widget framework
      - REST API for data fetching
      - AngularJS for UI
   ✅ Attachments: 3 mockups synced to local /tmp/attachments/

🤖 AI Assistant Ready - generating widget...
   Suggested tasks:
   1. Create sp_widget record
   2. Implement server script (data fetching)
   3. Build HTML template (responsive layout)
   4. Add client script (filtering logic)
   5. Create CSS (mobile breakpoints)

🚀 Ready to code! Use: snow-flow swarm "create incident dashboard widget"
```

---

## Azure DevOps Integration Suite

### Feature Overview

**Work Item Synchronization:**
- Azure DevOps → ServiceNow: Import User Stories, Tasks, Bugs
- ServiceNow → Azure DevOps: Update status, hours worked
- Pull Request Tracking: Link PRs to ServiceNow tasks
- Build Pipeline Integration: Show build status in ServiceNow

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Azure DevOps                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Work Items  │  │  Pull        │  │  Pipelines   │         │
│  │              │  │  Requests    │  │              │         │
│  │ - User Story │  │              │  │ - Build      │         │
│  │ - Task       │  │ - Code       │  │ - Test       │         │
│  │ - Bug        │  │   Review     │  │ - Deploy     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│           Snow-Flow Enterprise - Azure DevOps Sync              │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  WorkItem    │  │  PR Tracker  │  │  Pipeline    │         │
│  │  Mapper      │  │              │  │  Monitor     │         │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘         │
│         │                  │                  │                  │
└─────────┼──────────────────┼──────────────────┼─────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│               ServiceNow Instance                                │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │  Tasks       │  │  Work Notes  │  │  Build Info  │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

*(Due to token limits, I'll provide the complete implementation in a summary format)*

### Key Components

**1. WorkItem Mapper** (`src/integrations/azure-devops/workitem-mapper.ts`)
- Maps Azure DevOps User Stories → ServiceNow Tasks
- Syncs status, priority, assigned user
- Handles custom fields and tags

**2. PR Tracker** (`src/integrations/azure-devops/pr-tracker.ts`)
- Tracks pull requests linked to work items
- Updates ServiceNow with PR status (Open, Merged, Closed)
- Adds PR review comments to ServiceNow work notes

**3. Pipeline Monitor** (`src/integrations/azure-devops/pipeline-integrator.ts`)
- Shows build/test/deploy status in ServiceNow
- Alerts on pipeline failures
- Links test results to ServiceNow tasks

**MCP Tools:**
- `snow_azure_sync_workitems` - Import work items
- `snow_azure_track_pr` - Track pull requests
- `snow_azure_pipeline_status` - Get pipeline status

---

## Confluence Integration Suite

### Feature Overview

**Documentation Synchronization:**
- Confluence Pages → ServiceNow Knowledge Articles
- Technical Specs → Implementation Guides
- Architecture Diagrams → Attachments
- Auto-update when Confluence pages change

### Key Components

**1. Document Syncer** (`src/integrations/confluence/doc-syncer.ts`)
- Converts Confluence wiki markup to ServiceNow HTML
- Maintains formatting, tables, code blocks
- Syncs attachments (images, PDFs, diagrams)

**2. Page Importer** (`src/integrations/confluence/page-importer.ts`)
- Imports Confluence pages as ServiceNow knowledge articles
- Preserves hierarchy (parent/child pages)
- Updates categories and tags

**MCP Tools:**
- `snow_confluence_sync_docs` - Sync documentation
- `snow_confluence_import_page` - Import specific page
- `snow_confluence_sync_attachments` - Sync attachments

---

## Enterprise SSO/SAML

### SAML 2.0 Integration

**Components:**
- SAML Provider (`src/security/sso/saml-provider.ts`)
- OAuth Provider (`src/security/sso/oauth-provider.ts`)
- LDAP Connector (`src/security/sso/ldap-connector.ts`)
- RBAC Manager (`src/security/sso/rbac-manager.ts`)

**Supported Identity Providers:**
- Azure Active Directory
- Okta
- OneLogin
- Google Workspace
- Custom SAML 2.0 providers

---

## Advanced Audit Logging

### Comprehensive Activity Tracking

**What's Logged:**
- Every AI action (tool call, parameters, results)
- User authentication events
- Data modifications (create, update, delete)
- Integration sync events (Jira, Azure DevOps, Confluence)
- License validation checks

**Log Format:**
```json
{
  "timestamp": "2025-01-21T10:30:45Z",
  "user": "john.doe@capgemini.com",
  "action": "snow_jira_sync_backlog",
  "parameters": {
    "projectKey": "SNOW",
    "aiParse": true
  },
  "result": {
    "success": true,
    "imported": 25
  },
  "auditId": "aud_1234567890",
  "ipAddress": "10.0.1.50",
  "userAgent": "Snow-Flow/7.5.0"
}
```

**Compliance Reports:**
- SOX: Financial systems access
- GDPR: Personal data processing
- HIPAA: Healthcare data access

---

## License Validation System

### JWT-Based License Keys

**License Key Format:**
```
SNOW-[TIER]-[ORG-ID]-[EXPIRY]-[CHECKSUM]

Example:
SNOW-ENT-CAPGEMINI-20261231-A3F2E9C1
```

**Validation Process:**
1. **Offline Validation:** Verify checksum and expiry locally
2. **Online Validation:** Phone home to license server (daily)
3. **Grace Period:** 7 days offline before features disable
4. **Enforcement:** Feature flags based on tier

**Implementation:**
```typescript
// src/license/validator.ts
export class LicenseValidator {
  async validate(key: string): Promise<LicenseInfo> {
    // Parse key
    const parts = key.split('-');

    // Verify checksum (offline)
    if (!this.verifyChecksum(key)) {
      throw new Error('Invalid license');
    }

    // Check expiry
    if (new Date(parts[3]) < new Date()) {
      throw new Error('License expired');
    }

    // Online validation
    const response = await fetch('https://license.snow-flow.dev/validate', {
      method: 'POST',
      body: JSON.stringify({ key })
    });

    return response.json();
  }
}
```

---

## Deployment Architecture

### Production Deployment

**Hosting Options:**
1. **Self-Hosted:** Customer runs on own infrastructure
2. **Cloud-Hosted:** Snow-Flow manages AWS/Azure deployment
3. **Hybrid:** Core self-hosted, enterprise features cloud-hosted

**Infrastructure Requirements:**
- Node.js 20+ runtime
- PostgreSQL/MySQL (for audit logs)
- Redis (for caching)
- SSL/TLS certificates
- Reverse proxy (nginx/Apache)

**Scaling:**
- Horizontal scaling: Multiple enterprise servers
- Load balancing: Distribute webhook traffic
- Caching: Redis for license validation
- Monitoring: Prometheus + Grafana

---

## Summary

This enterprise architecture enables:

1. **Bi-Directional Sync** - Jira, Azure DevOps, Confluence → ServiceNow
2. **AI-Powered Parsing** - Extract requirements automatically
3. **Real-Time Updates** - Webhooks for instant synchronization
4. **Enterprise Security** - SSO/SAML, audit logging, license validation
5. **Scalable Deployment** - Production-ready infrastructure

**Next Steps for Development:**
1. Implement Jira integration first (highest value)
2. Add Azure DevOps support (common in enterprises)
3. Build Confluence sync (documentation critical)
4. Implement license system (protect IP)
5. Add SSO/SAML (enterprise requirement)

**Estimated Development Timeline:**
- Jira Integration: 4-6 weeks (1 developer)
- Azure DevOps Integration: 3-4 weeks
- Confluence Integration: 2-3 weeks
- License System: 2 weeks
- SSO/SAML: 3-4 weeks

**Total:** 14-19 weeks (3.5-4.5 months) for full enterprise suite

---

**Questions?** See [MONETIZATION_STRATEGY.md](./MONETIZATION_STRATEGY.md) and [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) for more details.
