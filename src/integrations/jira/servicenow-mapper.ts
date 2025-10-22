/**
 * ServiceNow Field Mapper
 *
 * Maps Jira fields to ServiceNow fields with customizable configuration.
 */

import { JiraIssue } from './types.js';

export interface FieldMapping {
  jiraField: string;
  snowField: string;
  transform?: (value: any) => any;
}

export interface SyncConfiguration {
  /**
   * Target ServiceNow table (default: incident)
   */
  targetTable: string;

  /**
   * Field mappings from Jira to ServiceNow
   */
  fieldMappings: FieldMapping[];

  /**
   * Fields to use for duplicate detection
   */
  duplicateDetectionFields: string[];

  /**
   * Additional fields to set on all synced records
   */
  defaultFields?: Record<string, any>;

  /**
   * Sync comments as work notes
   */
  syncComments?: boolean;

  /**
   * Sync attachments
   */
  syncAttachments?: boolean;
}

/**
 * Default configuration for Jira → ServiceNow Incident sync
 */
export const DEFAULT_INCIDENT_CONFIG: SyncConfiguration = {
  targetTable: 'incident',
  fieldMappings: [
    {
      jiraField: 'key',
      snowField: 'correlation_id', // Store Jira key for linking
    },
    {
      jiraField: 'fields.summary',
      snowField: 'short_description',
    },
    {
      jiraField: 'fields.description',
      snowField: 'description',
    },
    {
      jiraField: 'fields.priority.name',
      snowField: 'priority',
      transform: (value: string) => {
        // Map Jira priorities to ServiceNow (1-5)
        const mapping: Record<string, string> = {
          'Highest': '1',
          'High': '2',
          'Medium': '3',
          'Low': '4',
          'Lowest': '5'
        };
        return mapping[value] || '3';
      }
    },
    {
      jiraField: 'fields.status.name',
      snowField: 'state',
      transform: (value: string) => {
        // Map Jira status to ServiceNow incident state
        const mapping: Record<string, string> = {
          'To Do': '1', // New
          'In Progress': '2', // In Progress
          'Done': '6', // Resolved
          'Closed': '7', // Closed
          'Blocked': '2', // In Progress (awaiting)
        };
        return mapping[value] || '1';
      }
    },
    {
      jiraField: 'fields.assignee.displayName',
      snowField: 'assigned_to',
      transform: (value: string) => {
        // Returns display name - ServiceNow will need to lookup user
        return value;
      }
    },
    {
      jiraField: 'fields.reporter.displayName',
      snowField: 'caller_id',
      transform: (value: string) => {
        // Returns display name - ServiceNow will need to lookup user
        return value;
      }
    },
    {
      jiraField: 'fields.created',
      snowField: 'opened_at',
    },
    {
      jiraField: 'fields.updated',
      snowField: 'sys_updated_on',
    }
  ],
  duplicateDetectionFields: ['correlation_id'],
  defaultFields: {
    category: 'Software',
    subcategory: 'Application',
    u_source: 'Jira Integration'
  },
  syncComments: true,
  syncAttachments: false // TODO: Implement attachment sync
};

/**
 * ServiceNow Field Mapper
 */
export class ServiceNowMapper {
  constructor(private config: SyncConfiguration) {}

  /**
   * Map Jira issue to ServiceNow record
   */
  mapToServiceNow(jiraIssue: JiraIssue): Record<string, any> {
    const snowRecord: Record<string, any> = {};

    // Apply field mappings
    for (const mapping of this.config.fieldMappings) {
      const value = this.getNestedValue(jiraIssue, mapping.jiraField);

      if (value !== undefined && value !== null) {
        const transformedValue = mapping.transform ? mapping.transform(value) : value;
        snowRecord[mapping.snowField] = transformedValue;
      }
    }

    // Apply default fields
    if (this.config.defaultFields) {
      Object.assign(snowRecord, this.config.defaultFields);
    }

    return snowRecord;
  }

  /**
   * Get nested object value by path (e.g., 'fields.assignee.displayName')
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Build query for duplicate detection
   */
  buildDuplicateQuery(jiraIssue: JiraIssue): string {
    const conditions: string[] = [];

    for (const field of this.config.duplicateDetectionFields) {
      const mapping = this.config.fieldMappings.find(m => m.snowField === field);
      if (mapping) {
        const value = this.getNestedValue(jiraIssue, mapping.jiraField);
        if (value) {
          conditions.push(`${field}=${value}`);
        }
      }
    }

    return conditions.join('^');
  }

  /**
   * Get target table name
   */
  getTargetTable(): string {
    return this.config.targetTable;
  }

  /**
   * Check if comments should be synced
   */
  shouldSyncComments(): boolean {
    return this.config.syncComments || false;
  }

  /**
   * Check if attachments should be synced
   */
  shouldSyncAttachments(): boolean {
    return this.config.syncAttachments || false;
  }
}
