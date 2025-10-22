/**
 * Jira API Client
 *
 * Provides methods to interact with Jira REST API with proper
 * error handling and license validation.
 */

import JiraClient from 'jira-client';
import { requireLicense } from '../../license/index.js';
import {
  JiraConfig,
  JiraError,
  JiraIssue,
  JiraSearchResult,
  JiraComment,
  JiraTransition
} from './types.js';

export class JiraApiClient {
  private client: JiraClient;
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = {
      timeout: 30000,
      maxRetries: 3,
      ...config
    };

    this.client = new JiraClient({
      protocol: this.config.protocol,
      host: this.config.host,
      username: this.config.username,
      password: this.config.password,
      apiVersion: this.config.apiVersion,
      strictSSL: this.config.strictSSL,
      timeout: this.config.timeout
    });
  }

  /**
   * Get a single Jira issue by key
   */
  async getIssue(issueKey: string): Promise<JiraIssue> {
    await requireLicense('jira');

    try {
      const issue = await this.client.findIssue(issueKey);
      return issue as JiraIssue;
    } catch (error) {
      throw this.handleError(error, `Failed to get issue ${issueKey}`);
    }
  }

  /**
   * Search for issues using JQL
   */
  async searchIssues(jql: string, maxResults = 50, startAt = 0): Promise<JiraSearchResult> {
    await requireLicense('jira');

    try {
      const result = await this.client.searchJira(jql, {
        startAt,
        maxResults,
        fields: [
          'summary',
          'description',
          'status',
          'priority',
          'assignee',
          'reporter',
          'created',
          'updated',
          'labels',
          'components',
          'attachment',
          'customfield_10000' // Sprint field
        ]
      });

      return result as JiraSearchResult;
    } catch (error) {
      throw this.handleError(error, 'Failed to search issues');
    }
  }

  /**
   * Update a Jira issue
   */
  async updateIssue(issueKey: string, update: Partial<JiraIssue['fields']>): Promise<void> {
    await requireLicense('jira');

    try {
      await this.client.updateIssue(issueKey, { fields: update });
    } catch (error) {
      throw this.handleError(error, `Failed to update issue ${issueKey}`);
    }
  }

  /**
   * Add comment to an issue
   */
  async addComment(issueKey: string, comment: string): Promise<JiraComment> {
    await requireLicense('jira');

    try {
      const result = await this.client.addComment(issueKey, comment);
      return result as JiraComment;
    } catch (error) {
      throw this.handleError(error, `Failed to add comment to ${issueKey}`);
    }
  }

  /**
   * Get backlog issues for a project
   */
  async getBacklog(projectKey: string, sprint?: string, maxResults = 100): Promise<JiraSearchResult> {
    await requireLicense('jira');

    let jql = `project = ${projectKey} AND type in (Story, Task, Bug)`;

    if (sprint) {
      jql += ` AND sprint = "${sprint}"`;
    } else {
      jql += ` AND sprint is EMPTY`;
    }

    jql += ` ORDER BY rank ASC`;

    return this.searchIssues(jql, maxResults);
  }

  /**
   * Get available transitions for an issue
   */
  async getTransitions(issueKey: string): Promise<JiraTransition[]> {
    await requireLicense('jira');

    try {
      const result = await this.client.listTransitions(issueKey);
      return result.transitions as JiraTransition[];
    } catch (error) {
      throw this.handleError(error, `Failed to get transitions for ${issueKey}`);
    }
  }

  /**
   * Transition an issue to a new status
   */
  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await requireLicense('jira');

    try {
      await this.client.transitionIssue(issueKey, {
        transition: { id: transitionId }
      });
    } catch (error) {
      throw this.handleError(error, `Failed to transition issue ${issueKey}`);
    }
  }

  /**
   * Get comments for an issue
   */
  async getComments(issueKey: string): Promise<JiraComment[]> {
    await requireLicense('jira');

    try {
      const result = await this.client.getComments(issueKey);
      return (result.comments || []) as JiraComment[];
    } catch (error) {
      throw this.handleError(error, `Failed to get comments for ${issueKey}`);
    }
  }

  /**
   * Handle Jira API errors
   */
  private handleError(error: unknown, context: string): JiraError {
    if (error instanceof Error) {
      const statusCode = (error as any).statusCode;
      const response = (error as any).response;

      if (statusCode === 401) {
        return new JiraError(
          `Authentication failed: Check your Jira credentials`,
          401,
          response
        );
      }

      if (statusCode === 403) {
        return new JiraError(
          `Permission denied: Check your Jira permissions`,
          403,
          response
        );
      }

      if (statusCode === 404) {
        return new JiraError(
          `Resource not found: ${context}`,
          404,
          response
        );
      }

      if (statusCode === 429) {
        return new JiraError(
          `Rate limit exceeded: Jira API rate limit reached`,
          429,
          response
        );
      }

      if (statusCode >= 500) {
        return new JiraError(
          `Jira server error: ${error.message}`,
          statusCode,
          response
        );
      }

      return new JiraError(
        `${context}: ${error.message}`,
        statusCode,
        response
      );
    }

    return new JiraError(`${context}: ${String(error)}`);
  }
}
