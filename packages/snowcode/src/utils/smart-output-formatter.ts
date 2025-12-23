/**
 * Smart Output Formatter - Auto-generates human-readable summaries for MCP tool output
 *
 * This module automatically detects the type of MCP tool output and generates
 * a concise, scannable summary that is displayed to users instead of raw JSON.
 *
 * Supports:
 * - ServiceNow: incidents, workflows, scheduled jobs, notifications, records
 * - Jira: issues, issue lists
 * - Azure DevOps: work items
 * - Confluence: pages
 * - Generic: any tool output with common fields
 */

const SYMBOLS = {
  success: '✓',
  error: '✗',
  warning: '⚠',
  info: 'ℹ',
  bullet: '•',
  indent: '  '
};

interface FormattedOutput {
  summary: string;
  hasData: boolean;
}

/**
 * Auto-detect output type and generate appropriate summary
 */
export function formatToolOutput(toolName: string, output: any): FormattedOutput {
  // Handle null/undefined
  if (output === null || output === undefined) {
    return { summary: `${SYMBOLS.success} ${toolName} completed`, hasData: false };
  }

  // Handle string output
  if (typeof output === 'string') {
    // Try to parse JSON strings
    try {
      output = JSON.parse(output);
    } catch {
      return { summary: output.substring(0, 500), hasData: true };
    }
  }

  // Handle non-object
  if (typeof output !== 'object') {
    return { summary: String(output), hasData: false };
  }

  // Error handling - check first
  if (output.error || output.success === false) {
    return formatError(output);
  }

  // Unwrap common { success: true, data: {...} } wrapper pattern
  // Many MCP tools return this structure
  let data = output;
  if (output.success === true && output.data && typeof output.data === 'object') {
    data = output.data;
  }

  // ServiceNow Artifact Creation (snow_create_artifact, snow_deploy, etc.)
  if (data.created === true && data.sys_id && data.type) {
    return formatArtifactCreated(data);
  }

  // ServiceNow Artifact Update
  if (data.updated === true && data.sys_id) {
    return formatArtifactUpdated(data);
  }

  // Pattern matching for known output types
  // Use unwrapped data for pattern matching

  // Jira (check both output and data)
  if (data.issue && data.issue.key) return formatJiraIssue(data);
  if (output.issue && output.issue.key) return formatJiraIssue(output);
  if (data.issues && Array.isArray(data.issues)) return formatJiraIssueList(data);
  if (output.issues && Array.isArray(output.issues)) return formatJiraIssueList(output);

  // ServiceNow Workflows (check both output and data)
  if (data.workflow && data.workflow.sys_id) return formatWorkflow(data);
  if (output.workflow && output.workflow.sys_id) return formatWorkflow(output);
  if (data.workflows && Array.isArray(data.workflows)) return formatWorkflowList(data);
  if (output.workflows && Array.isArray(output.workflows)) return formatWorkflowList(output);

  // ServiceNow Incidents (check both output and data)
  if (data.incidents && Array.isArray(data.incidents)) return formatIncidentList(data);
  if (output.incidents && Array.isArray(output.incidents)) return formatIncidentList(output);
  if (data.incident && data.incident.number) return formatIncident(data);
  if (output.incident && output.incident.number) return formatIncident(output);

  // ServiceNow Notifications (check both output and data)
  if (data.notifications && Array.isArray(data.notifications)) return formatNotificationList(data);
  if (output.notifications && Array.isArray(output.notifications)) return formatNotificationList(output);
  if (data.notification && data.notification.sys_id) return formatNotification(data);
  if (output.notification && output.notification.sys_id) return formatNotification(output);

  // ServiceNow Scheduled Jobs (check both output and data)
  if (data.jobs && Array.isArray(data.jobs)) return formatScheduledJobList(data);
  if (output.jobs && Array.isArray(output.jobs)) return formatScheduledJobList(output);
  if (data.job && data.job.sys_id) return formatScheduledJob(data);
  if (output.job && output.job.sys_id) return formatScheduledJob(output);

  // ServiceNow Created Record (fallback if no type specified)
  if (data.created && data.sys_id) return formatCreatedRecord(data);
  if (output.created && output.sys_id) return formatCreatedRecord(output);

  // ServiceNow Update Set (check both output and data)
  if (data.update_set || data.updateSet) return formatUpdateSet(data);
  if (output.update_set || output.updateSet) return formatUpdateSet(output);

  // Generic list results (check both output and data)
  if (data.count !== undefined && (data.items || data.results || data.records)) {
    return formatListResult(data);
  }
  if (output.count !== undefined && (output.items || output.results || output.records)) {
    return formatListResult(output);
  }

  // Azure DevOps (check both output and data)
  if (data.workItem && data.workItem.id) return formatAzureWorkItem(data);
  if (output.workItem && output.workItem.id) return formatAzureWorkItem(output);
  if (data.workItems && Array.isArray(data.workItems)) return formatAzureWorkItemList(data);
  if (output.workItems && Array.isArray(output.workItems)) return formatAzureWorkItemList(output);

  // Confluence (check both output and data)
  if (data.page && data.page.id) return formatConfluencePage(data);
  if (output.page && output.page.id) return formatConfluencePage(output);
  if (data.pages && Array.isArray(data.pages)) return formatConfluencePageList(data);
  if (output.pages && Array.isArray(output.pages)) return formatConfluencePageList(output);

  // ServiceNow Query Results (check both output and data)
  if (data.result && Array.isArray(data.result)) return formatQueryResult(data);
  if (output.result && Array.isArray(output.result)) return formatQueryResult(output);

  // Generic fallback - use unwrapped data for better field extraction
  return formatGeneric(toolName, data);
}

// ============================================================================
// Error Formatting
// ============================================================================

function formatError(output: any): FormattedOutput {
  const msg = output.error || output.message || 'Unknown error';
  const lines = [`${SYMBOLS.error} Error: ${msg}`];

  if (output.details) {
    lines.push(`${SYMBOLS.indent}Details: ${output.details}`);
  }
  if (output.errorType) {
    lines.push(`${SYMBOLS.indent}Type: ${output.errorType}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// ServiceNow Artifact Formatting
// ============================================================================

function formatArtifactCreated(data: any): FormattedOutput {
  const typeName = getArtifactTypeName(data.type);
  const lines = [`${SYMBOLS.success} Created ${typeName}: ${data.name || data.title || 'Untitled'}`];

  lines.push(`${SYMBOLS.indent}sys_id: ${data.sys_id}`);

  if (data.table) {
    lines.push(`${SYMBOLS.indent}Table: ${data.table}`);
  }
  if (data.application_scope) {
    lines.push(`${SYMBOLS.indent}Scope: ${data.application_scope}`);
  }
  if (data.url) {
    lines.push(`${SYMBOLS.indent}URL: ${data.url}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatArtifactUpdated(data: any): FormattedOutput {
  const typeName = data.type ? getArtifactTypeName(data.type) : 'Record';
  const lines = [`${SYMBOLS.success} Updated ${typeName}: ${data.name || data.title || data.sys_id}`];

  lines.push(`${SYMBOLS.indent}sys_id: ${data.sys_id}`);

  if (data.table) {
    lines.push(`${SYMBOLS.indent}Table: ${data.table}`);
  }
  if (data.url) {
    lines.push(`${SYMBOLS.indent}URL: ${data.url}`);
  }
  if (data.changes && Array.isArray(data.changes)) {
    lines.push(`${SYMBOLS.indent}Changes: ${data.changes.length} field(s) updated`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function getArtifactTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    'sp_widget': 'Widget',
    'sp_page': 'Page',
    'sp_portal': 'Portal',
    'sp_theme': 'Theme',
    'sp_css': 'CSS Include',
    'sp_js_include': 'JS Include',
    'sp_header_footer': 'Header/Footer',
    'sp_instance': 'Widget Instance',
    'sp_column': 'Column',
    'sp_container': 'Container',
    'sp_row': 'Row',
    'sys_script': 'Business Rule',
    'sys_script_include': 'Script Include',
    'sys_ui_script': 'UI Script',
    'sys_ui_page': 'UI Page',
    'sys_ui_action': 'UI Action',
    'sys_ui_policy': 'UI Policy',
    'sys_dictionary': 'Dictionary Entry',
    'sys_db_object': 'Table',
    'sys_choice': 'Choice',
    'sysauto_script': 'Scheduled Job',
    'sysevent_email_action': 'Email Notification',
    'sysevent_in_email_action': 'Inbound Email Action',
    'wf_workflow': 'Workflow',
    'sys_ws_operation': 'REST Operation',
    'sys_rest_message': 'REST Message',
    'sys_transform_map': 'Transform Map',
    'sys_atf_test': 'ATF Test',
    'sys_atf_test_suite': 'ATF Test Suite'
  };
  return typeNames[type] || type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ============================================================================
// Jira Formatting
// ============================================================================

function formatJiraIssue(output: any): FormattedOutput {
  const issue = output.issue;
  const fields = issue.fields || {};
  const lines = [
    `${SYMBOLS.success} Jira Issue: ${issue.key}`,
    `${SYMBOLS.indent}Summary: ${fields.summary || 'N/A'}`,
    `${SYMBOLS.indent}Type: ${fields.issuetype?.name || 'N/A'}`,
    `${SYMBOLS.indent}Status: ${fields.status?.name || 'N/A'}`,
    `${SYMBOLS.indent}Assignee: ${fields.assignee?.displayName || 'Unassigned'}`,
    `${SYMBOLS.indent}Priority: ${fields.priority?.name || 'N/A'}`
  ];

  if (fields.labels && fields.labels.length > 0) {
    lines.push(`${SYMBOLS.indent}Labels: ${fields.labels.join(', ')}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatJiraIssueList(output: any): FormattedOutput {
  const issues = output.issues || [];
  const total = output.total || issues.length;
  const lines = [`${SYMBOLS.success} Found ${total} Jira issue${total === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(issues.length, 10); i++) {
    const issue = issues[i];
    const status = issue.fields?.status?.name || '';
    const summary = issue.fields?.summary || 'N/A';
    const truncatedSummary = summary.length > 50 ? summary.substring(0, 47) + '...' : summary;
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${issue.key}: ${truncatedSummary} [${status}]`);
  }

  if (issues.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${total - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// ServiceNow Workflow Formatting
// ============================================================================

function formatWorkflow(output: any): FormattedOutput {
  const wf = output.workflow;
  const lines = [
    `${SYMBOLS.success} Workflow: ${wf.name}`,
    `${SYMBOLS.indent}sys_id: ${wf.sys_id}`,
    `${SYMBOLS.indent}Table: ${wf.table || 'N/A'}`,
    `${SYMBOLS.indent}Status: ${wf.active === true || wf.active === 'true' ? 'Active' : 'Inactive'}`
  ];

  if (output.activities) {
    lines.push(`${SYMBOLS.indent}Activities: ${output.activities.length}`);
  }
  if (output.transitions) {
    lines.push(`${SYMBOLS.indent}Transitions: ${output.transitions.length}`);
  }
  if (output.recent_executions && output.recent_executions.length > 0) {
    lines.push(`${SYMBOLS.indent}Recent executions: ${output.recent_executions.length}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatWorkflowList(output: any): FormattedOutput {
  const workflows = output.workflows || [];
  const count = output.count || workflows.length;
  const lines = [`${SYMBOLS.success} Found ${count} workflow${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(workflows.length, 10); i++) {
    const wf = workflows[i];
    const status = wf.active === true || wf.active === 'true' ? '' : ' [inactive]';
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${wf.name} (${wf.table || 'N/A'})${status}`);
  }

  if (workflows.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// ServiceNow Incident Formatting
// ============================================================================

function formatIncident(output: any): FormattedOutput {
  const inc = output.incident;
  const lines = [
    `${SYMBOLS.success} Incident: ${inc.number}`,
    `${SYMBOLS.indent}Short Description: ${inc.short_description || 'N/A'}`,
    `${SYMBOLS.indent}State: ${inc.state || 'N/A'}`,
    `${SYMBOLS.indent}Priority: ${inc.priority || 'N/A'}`,
    `${SYMBOLS.indent}Assigned To: ${inc.assigned_to || 'Unassigned'}`
  ];

  return { summary: lines.join('\n'), hasData: true };
}

function formatIncidentList(output: any): FormattedOutput {
  const incidents = output.incidents || [];
  const count = output.count || incidents.length;
  const lines = [`${SYMBOLS.success} Found ${count} incident${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(incidents.length, 10); i++) {
    const inc = incidents[i];
    const desc = inc.short_description || 'N/A';
    const truncatedDesc = desc.length > 40 ? desc.substring(0, 37) + '...' : desc;
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${inc.number}: ${truncatedDesc}`);
  }

  if (incidents.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// ServiceNow Notification Formatting
// ============================================================================

function formatNotification(output: any): FormattedOutput {
  const n = output.notification || output;
  const lines = [
    `${SYMBOLS.success} Notification: ${n.name}`,
    `${SYMBOLS.indent}sys_id: ${n.sys_id}`
  ];

  if (n.table || n.collection) {
    lines.push(`${SYMBOLS.indent}Table: ${n.table || n.collection}`);
  }
  if (n.event || n.event_name) {
    lines.push(`${SYMBOLS.indent}Event: ${n.event || n.event_name}`);
  }
  if (n.active !== undefined) {
    lines.push(`${SYMBOLS.indent}Active: ${n.active === true || n.active === 'true' ? 'Yes' : 'No'}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatNotificationList(output: any): FormattedOutput {
  const notifs = output.notifications || [];
  const count = output.count || notifs.length;
  const lines = [`${SYMBOLS.success} Found ${count} notification${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(notifs.length, 10); i++) {
    const n = notifs[i];
    const status = n.active === true || n.active === 'true' ? '' : ' [inactive]';
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${n.name} (${n.table || n.collection || 'N/A'})${status}`);
  }

  if (notifs.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// ServiceNow Scheduled Job Formatting
// ============================================================================

function formatScheduledJob(output: any): FormattedOutput {
  const j = output.job || output;
  const lines = [
    `${SYMBOLS.success} Scheduled Job: ${j.name}`,
    `${SYMBOLS.indent}sys_id: ${j.sys_id}`
  ];

  if (j.run_type) {
    lines.push(`${SYMBOLS.indent}Run Type: ${j.run_type}`);
  }
  if (j.active !== undefined) {
    lines.push(`${SYMBOLS.indent}Active: ${j.active === true || j.active === 'true' ? 'Yes' : 'No'}`);
  }
  if (output.next_run) {
    lines.push(`${SYMBOLS.indent}Next Run: ${output.next_run.next_action || output.next_run}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatScheduledJobList(output: any): FormattedOutput {
  const jobs = output.jobs || [];
  const count = output.count || jobs.length;
  const lines = [`${SYMBOLS.success} Found ${count} scheduled job${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(jobs.length, 10); i++) {
    const j = jobs[i];
    const status = j.active === true || j.active === 'true' ? '' : ' [inactive]';
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${j.name} (${j.run_type || 'N/A'})${status}`);
  }

  if (jobs.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// ServiceNow Record Formatting
// ============================================================================

function formatCreatedRecord(output: any): FormattedOutput {
  const lines = [`${SYMBOLS.success} Created successfully`];

  if (output.sys_id) lines.push(`${SYMBOLS.indent}sys_id: ${output.sys_id}`);
  if (output.name) lines.push(`${SYMBOLS.indent}Name: ${output.name}`);
  if (output.number) lines.push(`${SYMBOLS.indent}Number: ${output.number}`);
  if (output.table) lines.push(`${SYMBOLS.indent}Table: ${output.table}`);

  return { summary: lines.join('\n'), hasData: true };
}

function formatUpdateSet(output: any): FormattedOutput {
  const us = output.update_set || output.updateSet || output;
  const lines = [`${SYMBOLS.success} Update Set: ${us.name}`];

  if (us.sys_id) lines.push(`${SYMBOLS.indent}sys_id: ${us.sys_id}`);
  if (us.state || us.status) lines.push(`${SYMBOLS.indent}State: ${us.state || us.status}`);
  if (us.application) lines.push(`${SYMBOLS.indent}Application: ${us.application}`);

  return { summary: lines.join('\n'), hasData: true };
}

function formatQueryResult(output: any): FormattedOutput {
  const results = output.result || [];
  const count = results.length;
  const lines = [`${SYMBOLS.success} Query returned ${count} record${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(results.length, 10); i++) {
    const r = results[i];
    const name = r.name || r.number || r.title || r.short_description || r.sys_id || 'Record';
    const truncatedName = name.length > 50 ? name.substring(0, 47) + '...' : name;
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${truncatedName}`);
  }

  if (results.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// Generic List Result Formatting
// ============================================================================

function formatListResult(output: any): FormattedOutput {
  const count = output.count;
  const items = output.items || output.results || output.records || [];
  const itemType = output.itemType || output.type || 'item';
  const lines = [`${SYMBOLS.success} Found ${count} ${itemType}${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const item = items[i];
    const name = item.name || item.title || item.number || item.key || item.sys_id || 'Unknown';
    const truncatedName = name.length > 50 ? name.substring(0, 47) + '...' : name;
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${truncatedName}`);
  }

  if (items.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// Azure DevOps Formatting
// ============================================================================

function formatAzureWorkItem(output: any): FormattedOutput {
  const wi = output.workItem;
  const fields = wi.fields || {};
  const lines = [
    `${SYMBOLS.success} Azure DevOps Work Item: #${wi.id}`,
    `${SYMBOLS.indent}Title: ${fields['System.Title'] || 'N/A'}`,
    `${SYMBOLS.indent}Type: ${fields['System.WorkItemType'] || 'N/A'}`,
    `${SYMBOLS.indent}State: ${fields['System.State'] || 'N/A'}`,
    `${SYMBOLS.indent}Assigned To: ${fields['System.AssignedTo']?.displayName || 'Unassigned'}`
  ];

  if (fields['System.IterationPath']) {
    lines.push(`${SYMBOLS.indent}Iteration: ${fields['System.IterationPath']}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatAzureWorkItemList(output: any): FormattedOutput {
  const items = output.workItems || [];
  const count = output.count || items.length;
  const lines = [`${SYMBOLS.success} Found ${count} work item${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const wi = items[i];
    const fields = wi.fields || {};
    const title = fields['System.Title'] || 'N/A';
    const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
    const state = fields['System.State'] || '';
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} #${wi.id}: ${truncatedTitle} [${state}]`);
  }

  if (items.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// Confluence Formatting
// ============================================================================

function formatConfluencePage(output: any): FormattedOutput {
  const page = output.page;
  const lines = [
    `${SYMBOLS.success} Confluence Page: ${page.title}`,
    `${SYMBOLS.indent}ID: ${page.id}`,
    `${SYMBOLS.indent}Space: ${page.space?.key || page.spaceKey || 'N/A'}`,
    `${SYMBOLS.indent}Status: ${page.status || 'N/A'}`
  ];

  if (page.version?.number) {
    lines.push(`${SYMBOLS.indent}Version: ${page.version.number}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatConfluencePageList(output: any): FormattedOutput {
  const pages = output.pages || output.results || [];
  const count = output.size || pages.length;
  const lines = [`${SYMBOLS.success} Found ${count} Confluence page${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(pages.length, 10); i++) {
    const page = pages[i];
    const title = page.title || 'Untitled';
    const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${truncatedTitle} (${page.space?.key || 'N/A'})`);
  }

  if (pages.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// Generic Fallback Formatting
// ============================================================================

function formatGeneric(toolName: string, output: any): FormattedOutput {
  const lines: string[] = [];

  // Determine action from common fields
  if (output.created === true) {
    lines.push(`${SYMBOLS.success} Created successfully`);
  } else if (output.updated === true) {
    lines.push(`${SYMBOLS.success} Updated successfully`);
  } else if (output.deleted === true) {
    lines.push(`${SYMBOLS.success} Deleted successfully`);
  } else if (output.started === true) {
    lines.push(`${SYMBOLS.success} Started successfully`);
  } else if (output.stopped === true) {
    lines.push(`${SYMBOLS.success} Stopped successfully`);
  } else if (output.action) {
    lines.push(`${SYMBOLS.success} ${output.action} completed`);
  } else if (output.message) {
    lines.push(`${SYMBOLS.success} ${output.message}`);
  } else {
    lines.push(`${SYMBOLS.success} ${toolName} completed`);
  }

  // Add key identifiers (order matters - most important first)
  const keyFields = ['sys_id', 'id', 'key', 'number', 'name', 'title'];
  for (const field of keyFields) {
    if (output[field] && typeof output[field] === 'string') {
      lines.push(`${SYMBOLS.indent}${field}: ${output[field]}`);
    }
  }

  // Add count if present
  if (output.count !== undefined) {
    lines.push(`${SYMBOLS.indent}Count: ${output.count}`);
  }

  // Add status fields
  if (output.status) {
    lines.push(`${SYMBOLS.indent}Status: ${output.status}`);
  }
  if (output.state) {
    lines.push(`${SYMBOLS.indent}State: ${output.state}`);
  }

  // If we only have the header, try to show some data
  if (lines.length === 1 && typeof output === 'object') {
    const keys = Object.keys(output).slice(0, 5);
    for (const key of keys) {
      const value = output[key];
      if (value !== null && value !== undefined && typeof value !== 'object') {
        lines.push(`${SYMBOLS.indent}${key}: ${String(value).substring(0, 100)}`);
      }
    }
  }

  return { summary: lines.join('\n'), hasData: true };
}

export { SYMBOLS };
