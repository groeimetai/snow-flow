/**
 * Jira Integration Types
 */

export interface JiraConfig {
  host: string;
  username: string;
  password: string; // API token for Jira Cloud
  protocol: 'https' | 'http';
  apiVersion: string;
  strictSSL: boolean;
  timeout?: number;
  maxRetries?: number;
}

export interface JiraIssue {
  key: string;
  id: string;
  fields: {
    summary: string;
    description?: string;
    status: {
      name: string;
      statusCategory: {
        key: string;
        name: string;
      };
    };
    priority?: {
      name: string;
      id: string;
    };
    assignee?: {
      displayName: string;
      emailAddress: string;
      accountId: string;
    };
    reporter?: {
      displayName: string;
      emailAddress: string;
      accountId: string;
    };
    created: string;
    updated: string;
    labels?: string[];
    components?: Array<{
      name: string;
      id: string;
    }>;
    attachment?: Array<{
      filename: string;
      content: string;
      size: number;
    }>;
    customfield_10000?: string; // Sprint field (example)
    [key: string]: unknown; // Allow custom fields
  };
}

export interface JiraSearchResult {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export interface SyncOptions {
  projectKey: string;
  sprint?: string;
  status?: string[];
  issueTypes?: string[];
  jql?: string;
  maxResults?: number;
  autoSync?: boolean;
  dryRun?: boolean;
}

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  issues: JiraIssue[];
  errors: Array<{
    issueKey: string;
    error: string;
  }>;
  warnings: string[];
}

export interface JiraComment {
  id: string;
  author: {
    displayName: string;
    emailAddress?: string;
  };
  body: string;
  created: string;
  updated: string;
}

export interface JiraTransition {
  id: string;
  name: string;
  to: {
    name: string;
    id: string;
  };
}

export class JiraError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public jiraResponse?: unknown
  ) {
    super(message);
    this.name = 'JiraError';
    Object.setPrototypeOf(this, JiraError.prototype);
  }
}
