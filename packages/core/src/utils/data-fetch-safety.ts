/**
 * Data Fetch Safety - User confirmation for large data fetches
 * Prevents accidentally downloading thousands of records without warning
 */

import { Logger } from './logger.js';

const logger = new Logger('DataFetchSafety');

export interface DataFetchPlan {
  table: string;
  estimatedRecords: number;
  query?: string;
  purpose: string;
}

export interface DataFetchApproval {
  approved: boolean;
  reason?: string;
}

/**
 * Check if user approval is needed based on record count
 */
export function needsApproval(recordCount: number): boolean {
  const APPROVAL_THRESHOLD = 1000;
  return recordCount >= APPROVAL_THRESHOLD;
}

/**
 * Request user approval for large data fetch
 *
 * ⚠️ IMPORTANT: This is informational logging only.
 * In MCP tools, we can't pause for interactive confirmation.
 * Instead, we log warnings and let users cancel if needed.
 */
export function requestApproval(plan: DataFetchPlan): DataFetchApproval {
  if (!needsApproval(plan.estimatedRecords)) {
    return { approved: true };
  }

  // Log warning (MCP tools can't do interactive prompts)
  const warning = `
┌─────────────────────────────────────────────────────────┐
│  ⚠️  LARGE DATA FETCH WARNING                           │
├─────────────────────────────────────────────────────────┤
│  Table: ${plan.table}
│  Records: ${plan.estimatedRecords}
│  Purpose: ${plan.purpose.substring(0, 50)}
├─────────────────────────────────────────────────────────┤
│  This will fetch ${plan.estimatedRecords} records from ServiceNow.
│  ${plan.estimatedRecords > 2000 ? 'This may take several minutes.' : 'This may take up to a minute.'}
│
│  API Rate Limits:
│  - ServiceNow may throttle large requests
│  - Your instance may have custom rate limits
│
│  💡 To cancel: Press Ctrl+C now
└─────────────────────────────────────────────────────────┘
  `.trim();

  logger.warn(warning);

  // In production, user would have time to cancel
  // For now, auto-approve with warning logged
  return {
    approved: true,
    reason: 'Auto-approved with warning logged. User can cancel with Ctrl+C.'
  };
}

/**
 * Format data fetch summary for logging
 */
export function formatFetchSummary(plan: DataFetchPlan, timeMs: number, actualRecords: number): string {
  const status = actualRecords === plan.estimatedRecords ? '✅' : '⚠️';

  return `
${status} Data Fetch Complete
   Table: ${plan.table}
   Requested: ${plan.estimatedRecords} records
   Fetched: ${actualRecords} records
   Time: ${(timeMs / 1000).toFixed(1)}s
   ${actualRecords !== plan.estimatedRecords ? '⚠️  Mismatch between estimated and actual' : ''}
  `.trim();
}
