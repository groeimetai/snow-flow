/**
 * Enterprise MCP Tools
 *
 * Exposes enterprise features through Model Context Protocol (MCP) tools.
 * These tools integrate with AI assistants to provide advanced capabilities.
 */

import { JiraApiClient, JiraSyncEngine, SyncOptions } from '../integrations/jira/index.js';
import { requireLicense } from '../license/index.js';
import {
  validateParams,
  jiraSyncBacklogSchema,
  jiraGetIssueSchema,
  jiraSearchIssuesSchema,
  jiraAddCommentSchema,
  jiraUpdateIssueSchema,
  jiraTransitionIssueSchema,
  jiraGetTransitionsSchema,
  type JiraSyncBacklogParams,
  type JiraGetIssueParams,
  type JiraSearchIssuesParams,
  type JiraAddCommentParams,
  type JiraUpdateIssueParams,
  type JiraTransitionIssueParams,
  type JiraGetTransitionsParams
} from './schemas.js';

/**
 * MCP Tool Definitions for Enterprise Features
 */
export const enterpriseMcpTools = {
  /**
   * Jira Integration Tools
   */
  snow_jira_sync_backlog: {
    name: 'snow_jira_sync_backlog',
    description: 'Sync Jira backlog issues to ServiceNow. Requires enterprise license with Jira feature.',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Jira instance host (e.g., your-domain.atlassian.net)'
        },
        username: {
          type: 'string',
          description: 'Jira username or email'
        },
        apiToken: {
          type: 'string',
          description: 'Jira API token (from Atlassian account settings)'
        },
        projectKey: {
          type: 'string',
          description: 'Jira project key (e.g., PROJ, TEAM, etc.)'
        },
        sprint: {
          type: 'string',
          description: 'Optional: Sprint name to sync specific sprint'
        },
        status: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Filter by status (e.g., ["To Do", "In Progress"])'
        },
        issueTypes: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional: Filter by issue types (defaults to Story, Task, Bug)'
        },
        jql: {
          type: 'string',
          description: 'Optional: Custom JQL query (overrides other filters)'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of issues to sync (default: 100)'
        },
        dryRun: {
          type: 'boolean',
          description: 'If true, only fetch issues without syncing to ServiceNow'
        }
      },
      required: ['host', 'username', 'apiToken', 'projectKey']
    },
    handler: async (params: unknown) => {
      // Validate parameters with Zod
      const validated = validateParams(jiraSyncBacklogSchema, params);

      // Validate license
      await requireLicense('jira');

      // Create Jira client
      const jiraClient = new JiraApiClient({
        host: validated.host,
        username: validated.username,
        password: validated.apiToken,
        protocol: 'https',
        apiVersion: '2',
        strictSSL: true
      });

      // Create sync engine
      const syncEngine = new JiraSyncEngine(jiraClient);

      // Build sync options
      const syncOptions: SyncOptions = {
        projectKey: validated.projectKey,
        sprint: validated.sprint,
        status: validated.status,
        issueTypes: validated.issueTypes,
        jql: validated.jql,
        maxResults: validated.maxResults,
        dryRun: validated.dryRun
      };

      // Execute sync
      const result = await syncEngine.syncBacklog(syncOptions);

      return {
        success: true,
        data: result,
        message: validated.dryRun
          ? `Fetched ${result.issues.length} issues (dry run - no sync performed)`
          : `Synced ${result.synced} issues, ${result.failed} failed, ${result.skipped} skipped`
      };
    }
  },

  snow_jira_get_issue: {
    name: 'snow_jira_get_issue',
    description: 'Get detailed information about a specific Jira issue. Requires enterprise license with Jira feature.',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Jira instance host (e.g., your-domain.atlassian.net)'
        },
        username: {
          type: 'string',
          description: 'Jira username or email'
        },
        apiToken: {
          type: 'string',
          description: 'Jira API token (from Atlassian account settings)'
        },
        issueKey: {
          type: 'string',
          description: 'Jira issue key (e.g., PROJ-123)'
        }
      },
      required: ['host', 'username', 'apiToken', 'issueKey']
    },
    handler: async (params: unknown) => {
      // Validate parameters
      const validated = validateParams(jiraGetIssueSchema, params);

      // Validate license
      await requireLicense('jira');

      // Create Jira client
      const jiraClient = new JiraApiClient({
        host: validated.host,
        username: validated.username,
        password: validated.apiToken,
        protocol: 'https',
        apiVersion: '2',
        strictSSL: true
      });

      // Fetch issue
      const issue = await jiraClient.getIssue(validated.issueKey);

      return {
        success: true,
        data: issue,
        message: `Retrieved issue ${validated.issueKey}`
      };
    }
  },

  snow_jira_search_issues: {
    name: 'snow_jira_search_issues',
    description: 'Search Jira issues using JQL query. Requires enterprise license with Jira feature.',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Jira instance host (e.g., your-domain.atlassian.net)'
        },
        username: {
          type: 'string',
          description: 'Jira username or email'
        },
        apiToken: {
          type: 'string',
          description: 'Jira API token (from Atlassian account settings)'
        },
        jql: {
          type: 'string',
          description: 'JQL query (e.g., "project = PROJ AND status = Open")'
        },
        maxResults: {
          type: 'number',
          description: 'Maximum results to return (default: 50)'
        },
        startAt: {
          type: 'number',
          description: 'Starting index for pagination (default: 0)'
        }
      },
      required: ['host', 'username', 'apiToken', 'jql']
    },
    handler: async (params: any) => {
      // Validate license
      await requireLicense('jira');

      // Create Jira client
      const jiraClient = new JiraApiClient({
        host: params.host,
        username: params.username,
        password: params.apiToken,
        protocol: 'https',
        apiVersion: '2',
        strictSSL: true
      });

      // Search issues
      const result = await jiraClient.searchIssues(
        params.jql,
        params.maxResults || 50,
        params.startAt || 0
      );

      return {
        success: true,
        data: result,
        message: `Found ${result.total} issues (showing ${result.issues.length})`
      };
    }
  },

  snow_jira_add_comment: {
    name: 'snow_jira_add_comment',
    description: 'Add comment to a Jira issue. Requires enterprise license with Jira feature.',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Jira instance host (e.g., your-domain.atlassian.net)'
        },
        username: {
          type: 'string',
          description: 'Jira username or email'
        },
        apiToken: {
          type: 'string',
          description: 'Jira API token (from Atlassian account settings)'
        },
        issueKey: {
          type: 'string',
          description: 'Jira issue key (e.g., PROJ-123)'
        },
        comment: {
          type: 'string',
          description: 'Comment text to add'
        }
      },
      required: ['host', 'username', 'apiToken', 'issueKey', 'comment']
    },
    handler: async (params: any) => {
      // Validate license
      await requireLicense('jira');

      // Create Jira client
      const jiraClient = new JiraApiClient({
        host: params.host,
        username: params.username,
        password: params.apiToken,
        protocol: 'https',
        apiVersion: '2',
        strictSSL: true
      });

      // Add comment
      const result = await jiraClient.addComment(params.issueKey, params.comment);

      return {
        success: true,
        data: result,
        message: `Comment added to ${params.issueKey}`
      };
    }
  },

  snow_jira_update_issue: {
    name: 'snow_jira_update_issue',
    description: 'Update a Jira issue fields. Requires enterprise license with Jira feature.',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Jira instance host (e.g., your-domain.atlassian.net)'
        },
        username: {
          type: 'string',
          description: 'Jira username or email'
        },
        apiToken: {
          type: 'string',
          description: 'Jira API token (from Atlassian account settings)'
        },
        issueKey: {
          type: 'string',
          description: 'Jira issue key (e.g., PROJ-123)'
        },
        fields: {
          type: 'object',
          description: 'Fields to update (e.g., {summary: "New summary", description: "New desc"})'
        }
      },
      required: ['host', 'username', 'apiToken', 'issueKey', 'fields']
    },
    handler: async (params: any) => {
      // Validate license
      await requireLicense('jira');

      // Create Jira client
      const jiraClient = new JiraApiClient({
        host: params.host,
        username: params.username,
        password: params.apiToken,
        protocol: 'https',
        apiVersion: '2',
        strictSSL: true
      });

      // Update issue
      await jiraClient.updateIssue(params.issueKey, params.fields);

      return {
        success: true,
        message: `Updated issue ${params.issueKey}`
      };
    }
  },

  snow_jira_transition_issue: {
    name: 'snow_jira_transition_issue',
    description: 'Transition a Jira issue to a new status. Requires enterprise license with Jira feature.',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Jira instance host (e.g., your-domain.atlassian.net)'
        },
        username: {
          type: 'string',
          description: 'Jira username or email'
        },
        apiToken: {
          type: 'string',
          description: 'Jira API token (from Atlassian account settings)'
        },
        issueKey: {
          type: 'string',
          description: 'Jira issue key (e.g., PROJ-123)'
        },
        transitionId: {
          type: 'string',
          description: 'Transition ID to execute (use snow_jira_get_transitions to find available transitions)'
        }
      },
      required: ['host', 'username', 'apiToken', 'issueKey', 'transitionId']
    },
    handler: async (params: any) => {
      // Validate license
      await requireLicense('jira');

      // Create Jira client
      const jiraClient = new JiraApiClient({
        host: params.host,
        username: params.username,
        password: params.apiToken,
        protocol: 'https',
        apiVersion: '2',
        strictSSL: true
      });

      // Transition issue
      await jiraClient.transitionIssue(params.issueKey, params.transitionId);

      return {
        success: true,
        message: `Transitioned issue ${params.issueKey}`
      };
    }
  },

  snow_jira_get_transitions: {
    name: 'snow_jira_get_transitions',
    description: 'Get available transitions for a Jira issue. Requires enterprise license with Jira feature.',
    inputSchema: {
      type: 'object',
      properties: {
        host: {
          type: 'string',
          description: 'Jira instance host (e.g., your-domain.atlassian.net)'
        },
        username: {
          type: 'string',
          description: 'Jira username or email'
        },
        apiToken: {
          type: 'string',
          description: 'Jira API token (from Atlassian account settings)'
        },
        issueKey: {
          type: 'string',
          description: 'Jira issue key (e.g., PROJ-123)'
        }
      },
      required: ['host', 'username', 'apiToken', 'issueKey']
    },
    handler: async (params: any) => {
      // Validate license
      await requireLicense('jira');

      // Create Jira client
      const jiraClient = new JiraApiClient({
        host: params.host,
        username: params.username,
        password: params.apiToken,
        protocol: 'https',
        apiVersion: '2',
        strictSSL: true
      });

      // Get transitions
      const transitions = await jiraClient.getTransitions(params.issueKey);

      return {
        success: true,
        data: transitions,
        message: `Found ${transitions.length} available transitions`
      };
    }
  }
};

/**
 * Register enterprise tools with MCP server
 */
export function registerEnterpriseTools(server: any): void {
  Object.values(enterpriseMcpTools).forEach(tool => {
    server.addTool(tool.name, tool.description, tool.inputSchema, tool.handler);
  });
}
