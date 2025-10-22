/**
 * Jira API Client Wrapper
 *
 * Provides a typed interface for Jira Cloud API operations.
 * Handles authentication, field mapping, and error handling.
 */

import JiraApi from 'jira-client';
import axios, { AxiosInstance } from 'axios';

// ===== TYPES =====

export interface JiraCredentials {
  host: string;           // e.g., "company.atlassian.net"
  email: string;          // User email
  apiToken: string;       // API token from Atlassian
}

export interface JiraIssue {
  id: string;
  key: string;
  self: string;
  fields: {
    summary: string;
    description?: string;
    issuetype: {
      id: string;
      name: string;
      iconUrl: string;
    };
    project: {
      id: string;
      key: string;
      name: string;
    };
    status: {
      id: string;
      name: string;
      statusCategory: {
        id: number;
        key: string;
        name: string;
      };
    };
    priority?: {
      id: string;
      name: string;
      iconUrl: string;
    };
    assignee?: {
      accountId: string;
      displayName: string;
      emailAddress: string;
    };
    reporter?: {
      accountId: string;
      displayName: string;
      emailAddress: string;
    };
    created: string;
    updated: string;
    labels?: string[];
    components?: Array<{
      id: string;
      name: string;
    }>;
    customfield_10000?: string; // Sprint field (varies by instance)
    [key: string]: any;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
  description?: string;
  lead: {
    accountId: string;
    displayName: string;
  };
  projectTypeKey: string;
  style: string;
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  maxResults: number;
  startAt: number;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    id: string;
    name: string;
  };
}

export interface JiraIssueLink {
  id: string;
  type: {
    id: string;
    name: string;
    inward: string;
    outward: string;
  };
  inwardIssue?: JiraIssue;
  outwardIssue?: JiraIssue;
}

// ===== CLIENT =====

export class JiraClient {
  private client: JiraApi;
  private axiosClient: AxiosInstance;
  private credentials: JiraCredentials;

  constructor(credentials: JiraCredentials) {
    this.credentials = credentials;

    // Initialize jira-client for basic operations
    this.client = new JiraApi({
      protocol: 'https',
      host: credentials.host,
      username: credentials.email,
      password: credentials.apiToken,
      apiVersion: '3',
      strictSSL: true
    });

    // Initialize axios for custom requests
    this.axiosClient = axios.create({
      baseURL: `https://${credentials.host}/rest/api/3`,
      auth: {
        username: credentials.email,
        password: credentials.apiToken
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  // ===== ISSUE OPERATIONS =====

  /**
   * Get a single issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    try {
      const issue = await this.client.findIssue(issueKey);
      return issue as JiraIssue;
    } catch (error: any) {
      throw new Error(`Failed to get Jira issue ${issueKey}: ${error.message}`);
    }
  }

  /**
   * Search issues with JQL
   */
  async searchIssues(
    jql: string,
    options: {
      startAt?: number;
      maxResults?: number;
      fields?: string[];
      expand?: string[];
    } = {}
  ): Promise<JiraSearchResult> {
    try {
      const result = await this.client.searchJira(jql, {
        startAt: options.startAt || 0,
        maxResults: options.maxResults || 100,
        fields: options.fields || ['*all'],
        expand: options.expand || []
      });

      return {
        issues: result.issues as JiraIssue[],
        total: result.total,
        maxResults: result.maxResults,
        startAt: result.startAt
      };
    } catch (error: any) {
      throw new Error(`Failed to search Jira issues: ${error.message}`);
    }
  }

  /**
   * Get project backlog (issues in backlog status)
   */
  async getBacklog(
    projectKey: string,
    options: {
      sprint?: string;
      status?: string[];
      issueTypes?: string[];
      maxResults?: number;
    } = {}
  ): Promise<JiraSearchResult> {
    var jqlParts = [`project = ${projectKey}`];

    // Add status filter
    if (options.status && options.status.length > 0) {
      var statusList = options.status.map(function(s) { return '"' + s + '"'; }).join(', ');
      jqlParts.push('status IN (' + statusList + ')');
    } else {
      // Default backlog statuses
      jqlParts.push('status IN ("To Do", "Backlog", "Selected for Development")');
    }

    // Add issue type filter
    if (options.issueTypes && options.issueTypes.length > 0) {
      var typeList = options.issueTypes.map(function(t) { return '"' + t + '"'; }).join(', ');
      jqlParts.push('issuetype IN (' + typeList + ')');
    }

    // Add sprint filter if provided
    if (options.sprint) {
      jqlParts.push('sprint = "' + options.sprint + '"');
    }

    // Order by rank (backlog order)
    jqlParts.push('ORDER BY Rank ASC');

    var jql = jqlParts.join(' AND ');

    return this.searchIssues(jql, {
      maxResults: options.maxResults || 100
    });
  }

  /**
   * Create a new issue
   */
  async createIssue(issueData: {
    projectKey: string;
    summary: string;
    description?: string;
    issueType: string;
    priority?: string;
    assignee?: string;
    labels?: string[];
    components?: string[];
    customFields?: Record<string, any>;
  }): Promise<JiraIssue> {
    try {
      var fields: any = {
        project: { key: issueData.projectKey },
        summary: issueData.summary,
        issuetype: { name: issueData.issueType }
      };

      if (issueData.description) {
        fields.description = {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: issueData.description
                }
              ]
            }
          ]
        };
      }

      if (issueData.priority) {
        fields.priority = { name: issueData.priority };
      }

      if (issueData.assignee) {
        fields.assignee = { accountId: issueData.assignee };
      }

      if (issueData.labels) {
        fields.labels = issueData.labels;
      }

      if (issueData.components) {
        fields.components = issueData.components.map(function(name) {
          return { name: name };
        });
      }

      // Add custom fields
      if (issueData.customFields) {
        for (var key in issueData.customFields) {
          if (issueData.customFields.hasOwnProperty(key)) {
            fields[key] = issueData.customFields[key];
          }
        }
      }

      var issue = await this.client.addNewIssue({ fields: fields });
      return this.getIssue(issue.key);
    } catch (error: any) {
      throw new Error(`Failed to create Jira issue: ${error.message}`);
    }
  }

  /**
   * Update an existing issue
   */
  async updateIssue(
    issueKey: string,
    updates: {
      summary?: string;
      description?: string;
      priority?: string;
      assignee?: string;
      labels?: string[];
      customFields?: Record<string, any>;
    }
  ): Promise<JiraIssue> {
    try {
      var fields: any = {};

      if (updates.summary) {
        fields.summary = updates.summary;
      }

      if (updates.description) {
        fields.description = {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: updates.description
                }
              ]
            }
          ]
        };
      }

      if (updates.priority) {
        fields.priority = { name: updates.priority };
      }

      if (updates.assignee) {
        fields.assignee = { accountId: updates.assignee };
      }

      if (updates.labels) {
        fields.labels = updates.labels;
      }

      if (updates.customFields) {
        for (var key in updates.customFields) {
          if (updates.customFields.hasOwnProperty(key)) {
            fields[key] = updates.customFields[key];
          }
        }
      }

      await this.client.updateIssue(issueKey, { fields: fields });
      return this.getIssue(issueKey);
    } catch (error: any) {
      throw new Error(`Failed to update Jira issue ${issueKey}: ${error.message}`);
    }
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    try {
      var response = await this.client.listTransitions(issueKey);
      return response.transitions as JiraTransition[];
    } catch (error: any) {
      throw new Error(`Failed to get transitions for ${issueKey}: ${error.message}`);
    }
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(
    issueKey: string,
    transitionIdOrName: string,
    options: {
      comment?: string;
      fields?: Record<string, any>;
    } = {}
  ): Promise<JiraIssue> {
    try {
      // Get available transitions
      var transitions = await this.getTransitions(issueKey);

      // Find transition by ID or name
      var transition = transitions.find(function(t) {
        return t.id === transitionIdOrName || t.name === transitionIdOrName;
      });

      if (!transition) {
        throw new Error('Transition "' + transitionIdOrName + '" not found. Available: ' +
          transitions.map(function(t) { return t.name; }).join(', '));
      }

      var payload: any = {
        transition: { id: transition.id }
      };

      if (options.comment) {
        payload.update = {
          comment: [
            {
              add: {
                body: {
                  type: 'doc',
                  version: 1,
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        {
                          type: 'text',
                          text: options.comment
                        }
                      ]
                    }
                  ]
                }
              }
            }
          ]
        };
      }

      if (options.fields) {
        payload.fields = options.fields;
      }

      await this.client.transitionIssue(issueKey, payload);
      return this.getIssue(issueKey);
    } catch (error: any) {
      throw new Error(`Failed to transition issue ${issueKey}: ${error.message}`);
    }
  }

  /**
   * Link two issues
   */
  async linkIssues(
    inwardIssueKey: string,
    outwardIssueKey: string,
    linkType: string
  ): Promise<void> {
    try {
      await this.axiosClient.post('/issueLink', {
        type: { name: linkType },
        inwardIssue: { key: inwardIssueKey },
        outwardIssue: { key: outwardIssueKey }
      });
    } catch (error: any) {
      throw new Error(`Failed to link issues: ${error.message}`);
    }
  }

  // ===== PROJECT OPERATIONS =====

  /**
   * Get project details
   */
  async getProject(projectKey: string): Promise<JiraProject> {
    try {
      var project = await this.client.getProject(projectKey);
      return project as JiraProject;
    } catch (error: any) {
      throw new Error(`Failed to get Jira project ${projectKey}: ${error.message}`);
    }
  }

  /**
   * List all projects
   */
  async listProjects(): Promise<JiraProject[]> {
    try {
      var projects = await this.client.listProjects();
      return projects as JiraProject[];
    } catch (error: any) {
      throw new Error(`Failed to list Jira projects: ${error.message}`);
    }
  }

  // ===== FIELD MAPPING =====

  /**
   * Map Jira issue to ServiceNow incident/task fields
   */
  mapToServiceNow(issue: JiraIssue): {
    short_description: string;
    description: string;
    priority: number;
    state: number;
    assigned_to?: string;
    category?: string;
    subcategory?: string;
    u_jira_issue_key: string;
    u_jira_issue_type: string;
    u_jira_project: string;
    u_jira_status: string;
    u_jira_url: string;
  } {
    // Map Jira priority to ServiceNow priority (1-5)
    var priorityMap: Record<string, number> = {
      'Highest': 1,
      'High': 2,
      'Medium': 3,
      'Low': 4,
      'Lowest': 5
    };

    var priority = issue.fields.priority ?
      (priorityMap[issue.fields.priority.name] || 3) : 3;

    // Map Jira status to ServiceNow state
    var statusCategory = issue.fields.status.statusCategory.key;
    var state = statusCategory === 'done' ? 6 :
                statusCategory === 'indeterminate' ? 2 : 1;

    // Extract description (handle different formats)
    var description = '';
    if (issue.fields.description) {
      if (typeof issue.fields.description === 'string') {
        description = issue.fields.description;
      } else {
        // Extract text from ADF format
        var desc = issue.fields.description as any;
        if (desc && desc.content) {
          description = this.extractTextFromADF(desc);
        }
      }
    }

    return {
      short_description: issue.fields.summary,
      description: description || 'Synced from Jira: ' + issue.key,
      priority: priority,
      state: state,
      category: issue.fields.issuetype.name,
      u_jira_issue_key: issue.key,
      u_jira_issue_type: issue.fields.issuetype.name,
      u_jira_project: issue.fields.project.key,
      u_jira_status: issue.fields.status.name,
      u_jira_url: 'https://' + this.credentials.host + '/browse/' + issue.key
    };
  }

  /**
   * Extract plain text from Atlassian Document Format (ADF)
   */
  private extractTextFromADF(adf: any): string {
    if (!adf || !adf.content || !Array.isArray(adf.content)) {
      return '';
    }

    var text = '';
    var content = adf.content as Array<any>;

    for (var i = 0; i < content.length; i++) {
      var node = content[i];

      if (node && node.type === 'paragraph' && node.content && Array.isArray(node.content)) {
        var nodeContent = node.content as Array<any>;
        for (var j = 0; j < nodeContent.length; j++) {
          var contentNode = nodeContent[j];
          if (contentNode && contentNode.type === 'text' && contentNode.text) {
            text += contentNode.text;
          }
        }
        text += '\n';
      }
    }

    return text.trim();
  }
}

export default JiraClient;
