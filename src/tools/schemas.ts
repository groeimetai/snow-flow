/**
 * Zod Schemas for MCP Tool Validation
 *
 * Provides runtime validation for all MCP tool parameters.
 */

import { z } from 'zod';

/**
 * Base Jira credentials schema
 */
export const jiraCredentialsSchema = z.object({
  host: z.string().min(1, 'Jira host is required'),
  username: z.string().email('Valid email required for username'),
  apiToken: z.string().min(1, 'API token is required')
});

/**
 * Jira sync backlog schema
 */
export const jiraSyncBacklogSchema = jiraCredentialsSchema.extend({
  projectKey: z.string().min(1, 'Project key is required'),
  sprint: z.string().optional(),
  status: z.array(z.string()).optional(),
  issueTypes: z.array(z.string()).optional(),
  jql: z.string().optional(),
  maxResults: z.number().int().positive().max(1000).optional(),
  dryRun: z.boolean().optional()
});

/**
 * Jira get issue schema
 */
export const jiraGetIssueSchema = jiraCredentialsSchema.extend({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/, 'Invalid issue key format (expected: PROJ-123)')
});

/**
 * Jira search issues schema
 */
export const jiraSearchIssuesSchema = jiraCredentialsSchema.extend({
  jql: z.string().min(1, 'JQL query is required'),
  maxResults: z.number().int().positive().max(1000).default(50),
  startAt: z.number().int().nonnegative().default(0)
});

/**
 * Jira add comment schema
 */
export const jiraAddCommentSchema = jiraCredentialsSchema.extend({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/, 'Invalid issue key format'),
  comment: z.string().min(1, 'Comment text is required')
});

/**
 * Jira update issue schema
 */
export const jiraUpdateIssueSchema = jiraCredentialsSchema.extend({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/, 'Invalid issue key format'),
  fields: z.record(z.any()).refine(
    (fields) => Object.keys(fields).length > 0,
    'At least one field must be provided'
  )
});

/**
 * Jira transition issue schema
 */
export const jiraTransitionIssueSchema = jiraCredentialsSchema.extend({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/, 'Invalid issue key format'),
  transitionId: z.string().min(1, 'Transition ID is required')
});

/**
 * Jira get transitions schema
 */
export const jiraGetTransitionsSchema = jiraCredentialsSchema.extend({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/, 'Invalid issue key format')
});

/**
 * Jira get comments schema
 */
export const jiraGetCommentsSchema = jiraCredentialsSchema.extend({
  issueKey: z.string().regex(/^[A-Z]+-\d+$/, 'Invalid issue key format')
});

/**
 * Type exports for validated parameters
 */
export type JiraCredentials = z.infer<typeof jiraCredentialsSchema>;
export type JiraSyncBacklogParams = z.infer<typeof jiraSyncBacklogSchema>;
export type JiraGetIssueParams = z.infer<typeof jiraGetIssueSchema>;
export type JiraSearchIssuesParams = z.infer<typeof jiraSearchIssuesSchema>;
export type JiraAddCommentParams = z.infer<typeof jiraAddCommentSchema>;
export type JiraUpdateIssueParams = z.infer<typeof jiraUpdateIssueSchema>;
export type JiraTransitionIssueParams = z.infer<typeof jiraTransitionIssueSchema>;
export type JiraGetTransitionsParams = z.infer<typeof jiraGetTransitionsSchema>;
export type JiraGetCommentsParams = z.infer<typeof jiraGetCommentsSchema>;

/**
 * Validation helper
 */
export function validateParams<T>(schema: z.ZodSchema<T>, params: unknown): T {
  try {
    return schema.parse(params);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      throw new Error(`Invalid parameters:\n${messages.join('\n')}`);
    }
    throw error;
  }
}
