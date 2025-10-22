/**
 * Jira Sync Engine
 *
 * Handles synchronization of Jira issues to ServiceNow.
 * This is an MVP implementation - full sync requires ServiceNow client integration.
 */

import { requireLicense } from '../../license/index.js';
import { JiraApiClient } from './api-client.js';
import { SyncOptions, SyncResult, JiraIssue } from './types.js';
import { ServiceNowMapper, ServiceNowMapper as Mapper, SyncConfiguration, DEFAULT_INCIDENT_CONFIG } from './servicenow-mapper.js';
import { ServiceNowClient, ServiceNowClientImpl, MockServiceNowClient } from './servicenow-client.js';

export class JiraSyncEngine {
  private mapper: ServiceNowMapper;
  private snowClient: ServiceNowClient;

  constructor(
    private jiraClient: JiraApiClient,
    syncConfig?: SyncConfiguration,
    snowClient?: ServiceNowClient
  ) {
    this.mapper = new ServiceNowMapper(syncConfig || DEFAULT_INCIDENT_CONFIG);
    this.snowClient = snowClient || new MockServiceNowClient();
  }

  /**
   * Sync backlog to ServiceNow
   */
  async syncBacklog(options: SyncOptions): Promise<SyncResult> {
    await requireLicense('jira');

    const result: SyncResult = {
      synced: 0,
      failed: 0,
      skipped: 0,
      issues: [],
      errors: [],
      warnings: []
    };

    try {
      // Build JQL query
      const jql = this.buildJQL(options);

      // Fetch issues from Jira
      const searchResult = await this.jiraClient.searchIssues(
        jql,
        options.maxResults || 100
      );

      result.warnings.push(`Found ${searchResult.total} issues to sync`);

      // Process each issue
      for (const issue of searchResult.issues) {
        try {
          if (options.dryRun) {
            result.issues.push(issue);
            result.skipped++;
            continue;
          }

          // TODO: Actual ServiceNow sync goes here
          // For now, just collect issues
          const syncedIssue = await this.syncIssue(issue);
          result.issues.push(syncedIssue);
          result.synced++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            issueKey: issue.key,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      if (result.failed > 0) {
        result.warnings.push(
          `${result.failed} issue(s) failed to sync - check errors array`
        );
      }

    } catch (error) {
      result.errors.push({
        issueKey: 'N/A',
        error: `Backlog fetch failed: ${error instanceof Error ? error.message : String(error)}`
      });
    }

    return result;
  }

  /**
   * Sync individual issue to ServiceNow
   */
  private async syncIssue(issue: JiraIssue): Promise<JiraIssue> {
    try {
      // Step 1: Map Jira issue to ServiceNow record
      const snowRecord = this.mapper.mapToServiceNow(issue);

      // Step 2: Lookup users (assignee and caller)
      if (snowRecord.assigned_to) {
        const assignee = await this.snowClient.lookupUser(snowRecord.assigned_to);
        if (assignee) {
          snowRecord.assigned_to = assignee.sys_id;
        } else {
          // Remove field if user not found
          delete snowRecord.assigned_to;
        }
      }

      if (snowRecord.caller_id) {
        const caller = await this.snowClient.lookupUser(snowRecord.caller_id);
        if (caller) {
          snowRecord.caller_id = caller.sys_id;
        } else {
          // Remove field if user not found
          delete snowRecord.caller_id;
        }
      }

      // Step 3: Check for duplicate
      const duplicateQuery = this.mapper.buildDuplicateQuery(issue);
      const existing = await this.snowClient.query(
        this.mapper.getTargetTable(),
        duplicateQuery
      );

      let syncedRecord;
      if (existing.length > 0) {
        // Update existing record
        const existingSysId = existing[0].sys_id;
        syncedRecord = await this.snowClient.update(
          this.mapper.getTargetTable(),
          existingSysId,
          snowRecord
        );
      } else {
        // Create new record
        syncedRecord = await this.snowClient.create(
          this.mapper.getTargetTable(),
          snowRecord
        );
      }

      // Step 4: Sync comments if enabled
      if (this.mapper.shouldSyncComments() && syncedRecord.sys_id) {
        try {
          const comments = await this.jiraClient.getComments(issue.key);
          for (const comment of comments) {
            const workNote = `[Jira Comment by ${comment.author.displayName}]\n${comment.body}`;
            await this.snowClient.addWorkNote(
              this.mapper.getTargetTable(),
              syncedRecord.sys_id,
              workNote
            );
          }
        } catch (error) {
          // Don't fail the whole sync if comments fail
          console.warn(`Failed to sync comments for ${issue.key}:`, error);
        }
      }

      // Step 5: TODO: Sync attachments if enabled
      if (this.mapper.shouldSyncAttachments()) {
        console.warn(`Attachment sync not yet implemented for ${issue.key}`);
      }

      return issue;
    } catch (error) {
      // Re-throw with context
      throw new Error(
        `Failed to sync issue ${issue.key}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Build JQL query from options
   */
  private buildJQL(options: SyncOptions): string {
    if (options.jql) {
      return options.jql;
    }

    const parts: string[] = [`project = ${options.projectKey}`];

    if (options.issueTypes && options.issueTypes.length > 0) {
      parts.push(`type in (${options.issueTypes.join(', ')})`);
    } else {
      parts.push('type in (Story, Task, Bug)');
    }

    if (options.sprint) {
      parts.push(`sprint = "${options.sprint}"`);
    }

    if (options.status && options.status.length > 0) {
      parts.push(`status in (${options.status.map(s => `"${s}"`).join(', ')})`);
    }

    parts.push('ORDER BY rank ASC');

    return parts.join(' AND ');
  }
}
