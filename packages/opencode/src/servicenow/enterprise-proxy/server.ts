#!/usr/bin/env node
/**
 * Snow-Flow Enterprise MCP Proxy
 *
 * Forwards MCP tool requests from Claude Code to the Enterprise License Server.
 * This allows the open source Snow-Flow to use enterprise-hosted tools.
 *
 * Architecture:
 * Claude Code → stdio → This Proxy → HTTPS → License Server → External APIs
 *
 * IMPORTANT: Credentials (Jira, Azure DevOps, Confluence, GitHub, GitLab) are
 * fetched by the enterprise MCP server from the Portal API using the JWT token.
 * No local credentials are needed - just SNOW_ENTERPRISE_URL and SNOW_LICENSE_KEY.
 *
 * TOKEN RESOLUTION:
 * The proxy reads tokens from (in order):
 * 1. ~/.snow-code/enterprise.json (most recent device auth token)
 * 2. SNOW_LICENSE_KEY environment variable (from .mcp.json)
 *
 * Usage:
 * node server.js
 *
 * Environment Variables:
 * - SNOW_ENTERPRISE_URL: License server URL (required)
 * - SNOW_LICENSE_KEY: JWT token for authentication (optional if enterprise.json exists)
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { listEnterpriseTools, proxyToolCall } from './proxy.js';

// Configuration from environment variables
const LICENSE_SERVER_URL = process.env.SNOW_ENTERPRISE_URL || 'https://enterprise.snow-flow.dev';

/**
 * Check if a valid token source exists
 * Either enterprise.json or SNOW_LICENSE_KEY env var
 */
function hasValidTokenSource(): boolean {
  // Check enterprise.json
  const enterpriseJsonPath = path.join(os.homedir(), '.snow-code', 'enterprise.json');
  try {
    if (fs.existsSync(enterpriseJsonPath)) {
      const content = fs.readFileSync(enterpriseJsonPath, 'utf-8');
      const config = JSON.parse(content);
      if (config.token) {
        return true;
      }
    }
  } catch {
    // Ignore errors, check env var next
  }

  // Check env var
  const envKey = process.env.SNOW_LICENSE_KEY || process.env.SNOW_ENTERPRISE_LICENSE_KEY;
  return !!envKey?.trim();
}

// NOTE: Credentials (Jira, Azure DevOps, Confluence, GitHub, GitLab) are fetched
// by the enterprise MCP server from the Portal API using the JWT token.
// No local credential configuration is needed.

class EnterpriseProxyServer {
  private server: Server;
  private availableTools: Tool[] = [];

  constructor() {
    // Validate required configuration
    if (!LICENSE_SERVER_URL) {
      throw new Error('SNOW_ENTERPRISE_URL environment variable is required');
    }
    if (!hasValidTokenSource()) {
      throw new Error(
        'No valid token found. Either:\n' +
        '  1. Run: snow-code auth login (to create ~/.snow-code/enterprise.json)\n' +
        '  2. Or set SNOW_LICENSE_KEY environment variable'
      );
    }

    // Create MCP server
    this.server = new Server(
      {
        name: 'snow-flow-enterprise-proxy',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {},
          prompts: {}
        }
      }
    );

    this.setupHandlers();
    this.logConfiguration();
  }

  private logConfiguration() {
    // Determine token source for logging
    let tokenSource = 'environment variable';
    let tokenPreview = '(none)';

    const enterpriseJsonPath = path.join(os.homedir(), '.snow-code', 'enterprise.json');
    try {
      if (fs.existsSync(enterpriseJsonPath)) {
        const content = fs.readFileSync(enterpriseJsonPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.token) {
          tokenSource = '~/.snow-code/enterprise.json';
          tokenPreview = config.token.substring(0, 20) + '...';
        }
      }
    } catch {
      // Fall back to env var
    }

    if (tokenSource === 'environment variable') {
      const envKey = process.env.SNOW_LICENSE_KEY || process.env.SNOW_ENTERPRISE_LICENSE_KEY;
      if (envKey?.trim()) {
        tokenPreview = envKey.trim().substring(0, 20) + '...';
      }
    }

    console.error('═══════════════════════════════════════════════════');
    console.error('Snow-Flow Enterprise MCP Proxy');
    console.error('═══════════════════════════════════════════════════');
    console.error(`License Server: ${LICENSE_SERVER_URL}`);
    console.error(`Token Source: ${tokenSource}`);
    console.error(`JWT Token: ${tokenPreview}`);
    console.error('');
    console.error('Credentials are fetched from Portal API by enterprise server');
    console.error('═══════════════════════════════════════════════════');
    console.error('');
  }

  private setupHandlers() {
    // List tools handler - uses proxy.ts with JWT auto-refresh
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      try {
        console.error('[Proxy] Fetching available tools from license server...');

        var tools = await listEnterpriseTools();
        this.availableTools = tools as Tool[];

        console.error(`[Proxy] ✓ ${this.availableTools.length} tools available`);

        return {
          tools: this.availableTools
        };
      } catch (error: any) {
        console.error('[Proxy] ✗ Failed to fetch tools:', error.message);

        // Return empty tools list instead of crashing - allows graceful degradation
        console.error('[Proxy] Returning empty tools list due to backend error');
        return {
          tools: []
        };
      }
    });

    // Call tool handler - uses proxy.ts with JWT auto-refresh
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      var toolName = request.params.name;
      var toolArgs = request.params.arguments || {};

      try {
        console.error(`[Proxy] Executing tool: ${toolName}`);

        var startTime = Date.now();
        var result = await proxyToolCall(toolName, toolArgs);
        var duration = Date.now() - startTime;

        console.error(`[Proxy] ✓ Tool executed successfully (${duration}ms)`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
      } catch (error: any) {
        console.error(`[Proxy] ✗ Tool execution failed: ${error.message}`);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                tool: toolName
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });

    // ========== MCP PROMPTS SUPPORT ==========
    // These prompts provide guidance to the AI on how to use enterprise tools

    const ENTERPRISE_PROMPTS = [
      {
        name: 'tool-usage-guidelines',
        description: 'CRITICAL: Guidelines for using Enterprise MCP tools (GitHub, Jira, Azure DevOps, Confluence, GitLab). Load this prompt to understand when to use MCP tools vs WebFetch.',
        arguments: []
      },
      {
        name: 'github-workflow',
        description: 'Complete workflow guide for GitHub operations: issues, PRs, workflows, and releases using MCP tools.',
        arguments: []
      },
      {
        name: 'jira-workflow',
        description: 'Complete workflow guide for Jira operations: issues, sprints, boards, and transitions using MCP tools.',
        arguments: []
      },
      {
        name: 'azure-devops-workflow',
        description: 'Complete workflow guide for Azure DevOps operations: work items, pipelines, and repos using MCP tools.',
        arguments: []
      }
    ];

    const PROMPT_CONTENT: Record<string, string> = {
      'tool-usage-guidelines': `# 🚨 CRITICAL: USE MCP TOOLS, NOT WEBFETCH!

**This is a MANDATORY rule. Violating it is considered a failure.**

You have access to Enterprise MCP tools for GitHub, Jira, Azure DevOps, Confluence, and GitLab.
You MUST use these tools instead of WebFetch when working with these services.

## When to Use MCP Tools (ALWAYS)

| Service | ✅ USE MCP TOOLS | ❌ NEVER USE WEBFETCH/FETCH |
|---------|-----------------|----------------------|
| **GitHub** | \`github_get_content\`, \`github_list_issues\`, etc. | WebFetch to github.com OR raw.githubusercontent.com |
| **GitHub Files** | \`github_get_content({owner, repo, path})\` | Fetch to raw.githubusercontent.com URLs! |
| **Jira** | \`jira_get_issue\`, \`jira_search_issues\`, etc. | WebFetch to jira.atlassian.net |
| **Azure DevOps** | \`azdo_get_work_item\`, etc. | WebFetch to dev.azure.com |
| **Confluence** | \`confluence_get_page\`, etc. | WebFetch to confluence URLs |
| **GitLab** | \`gitlab_get_project\`, etc. | WebFetch to gitlab.com |

## ⚠️ IMPORTANT: raw.githubusercontent.com URLs

When you need file content from GitHub, **NEVER** use WebFetch/Fetch to \`raw.githubusercontent.com\`!
Instead, use: \`github_get_content({owner: "...", repo: "...", path: "..."})\`

## Why MCP Tools Are Better

1. **Authentication**: MCP tools have pre-configured auth from your enterprise license
2. **Structured Data**: Clean JSON responses vs messy HTML from WebFetch
3. **Full API Access**: Create, update, delete - not just read-only
4. **Token Efficiency**: Only returns what you need, not entire web pages

## When WebFetch IS Appropriate

- Reading documentation (docs.github.com, developer.atlassian.com)
- Fetching public web content not covered by MCP tools
- User explicitly provides a URL to fetch

## Enterprise Tools Are Always Available

Enterprise tools (GitHub, Jira, Azure DevOps, Confluence, GitLab) are **always directly available** — no discovery needed. Call them by name:

\`\`\`
// GitHub — call directly:
github_list_issues({owner: "org", repo: "repo", state: "open"})
github_create_issue({owner: "org", repo: "repo", title: "Bug fix", body: "..."})

// Jira — call directly:
jira_search_issues({jql: "project = PROJ AND status = Open"})

// Azure DevOps — call directly:
azdo_search_work_items({wiql: "SELECT * FROM WorkItems WHERE ..."})

// Confluence — call directly:
confluence_search_content({query: "release notes"})

// GitLab — call directly:
gitlab_list_issues({projectId: "123", state: "opened"})
\`\`\`

For **ServiceNow** tools, use \`tool_search\` to discover them (they are lazy-loaded):
\`\`\`
tool_search({query: "incident"}) → then use the discovered snow_* tool
\`\`\`

**Remember: If MCP tools exist for a service, ALWAYS use them instead of WebFetch!**`,

      'github-workflow': `# GitHub Workflow with MCP Tools

## Available Operations

### Issues
- \`github_list_issues\` - List repository issues
- \`github_create_issue\` - Create new issue
- \`github_update_issue\` - Update existing issue
- \`github_add_comment\` - Add comment to issue

### Pull Requests
- \`github_list_prs\` - List pull requests
- \`github_create_pr\` - Create pull request
- \`github_merge_pr\` - Merge pull request
- \`github_review_pr\` - Add review to PR

### Workflows
- \`github_list_workflows\` - List GitHub Actions workflows
- \`github_trigger_workflow\` - Manually trigger workflow
- \`github_get_workflow_runs\` - Get workflow run status

### Releases
- \`github_list_releases\` - List releases
- \`github_create_release\` - Create new release

## Example Workflow

\`\`\`
1. List open issues: github_list_issues({repo: "owner/repo", state: "open"})
2. Create fix branch and PR: github_create_pr({...})
3. After review: github_merge_pr({...})
4. Create release: github_create_release({...})
\`\`\``,

      'jira-workflow': `# Jira Workflow with MCP Tools

## Available Operations

### Issues
- \`jira_search_issues\` - Search with JQL
- \`jira_get_issue\` - Get issue details
- \`jira_create_issue\` - Create new issue
- \`jira_update_issue\` - Update issue fields
- \`jira_transition_issue\` - Move issue to new status
- \`jira_add_comment\` - Add comment

### Boards & Sprints
- \`jira_list_boards\` - List agile boards
- \`jira_get_board\` - Get board details
- \`jira_list_sprints\` - List sprints for board
- \`jira_get_sprint\` - Get sprint details

## Example Workflow

\`\`\`
1. Find issues: jira_search_issues({jql: "project = PROJ AND status = 'To Do'"})
2. Start work: jira_transition_issue({issue: "PROJ-123", transition: "In Progress"})
3. Add update: jira_add_comment({issue: "PROJ-123", body: "Started implementation"})
4. Complete: jira_transition_issue({issue: "PROJ-123", transition: "Done"})
\`\`\``,

      'azure-devops-workflow': `# Azure DevOps Workflow with MCP Tools

## Available Operations

### Work Items
- \`azdo_list_work_items\` - List work items
- \`azdo_get_work_item\` - Get work item details
- \`azdo_create_work_item\` - Create new work item
- \`azdo_update_work_item\` - Update work item

### Pipelines
- \`azdo_list_pipelines\` - List pipelines
- \`azdo_get_pipeline\` - Get pipeline details
- \`azdo_trigger_pipeline\` - Run a pipeline
- \`azdo_get_pipeline_runs\` - Get run history

### Repos
- \`azdo_list_repos\` - List repositories
- \`azdo_list_prs\` - List pull requests
- \`azdo_create_pr\` - Create pull request

## Example Workflow

\`\`\`
1. Get backlog: azdo_list_work_items({query: "SELECT * FROM WorkItems WHERE [State] = 'New'"})
2. Update item: azdo_update_work_item({id: 123, fields: {state: "Active"}})
3. Check pipeline: azdo_get_pipeline_runs({pipeline: "build"})
\`\`\``
    };

    // List prompts handler
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      console.error(`[Proxy] Listing ${ENTERPRISE_PROMPTS.length} prompts`);
      return {
        prompts: ENTERPRISE_PROMPTS
      };
    });

    // Get prompt handler
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      var promptName = request.params.name;
      console.error(`[Proxy] Getting prompt: ${promptName}`);

      var content = PROMPT_CONTENT[promptName];
      if (!content) {
        throw new Error(`Prompt not found: ${promptName}`);
      }

      return {
        description: ENTERPRISE_PROMPTS.find(p => p.name === promptName)?.description || '',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: content
            }
          }
        ]
      };
    });
  }

  async run() {
    var transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[Proxy] ✓ Enterprise MCP Proxy running on stdio');
    console.error('[Proxy] Ready to receive requests from Claude Code');
  }
}

// Start server
try {
  var proxy = new EnterpriseProxyServer();
  proxy.run().catch(function(error) {
    console.error('[Proxy] Fatal error:', error);
    process.exit(1);
  });
} catch (error: any) {
  console.error('[Proxy] Failed to start:', error.message);
  process.exit(1);
}
