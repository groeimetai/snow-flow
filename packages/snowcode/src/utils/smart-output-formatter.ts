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

/**
 * Check if a string looks like a Jira issue key (e.g., "PROJECT-123")
 */
function isJiraKey(key: any): boolean {
  if (typeof key !== 'string') return false;
  // Jira keys are typically: PROJECTKEY-NUMBER (e.g., SNOW-123, ABC-1)
  return /^[A-Z][A-Z0-9]+-\d+$/.test(key);
}

/**
 * Check if an object contains a Jira issue list (not generic validation issues)
 */
function isJiraIssueList(obj: any): boolean {
  if (!obj || !obj.issues || !Array.isArray(obj.issues)) return false;
  if (obj.issues.length === 0) return false;
  // Check if first issue has Jira-specific properties
  const firstIssue = obj.issues[0];
  return firstIssue && firstIssue.key && isJiraKey(firstIssue.key) && firstIssue.fields !== undefined;
}

/**
 * Check if an object contains a property manager list (not raw sys_properties)
 * Property manager returns: { properties: [{ name: "x", value: "y" }] }
 * Instance info returns: { properties: [{ name: "x", sys_id: "...", value: "y" }] } (raw sys_properties)
 */
function isPropertyManagerList(obj: any): boolean {
  if (!obj || !obj.properties || !Array.isArray(obj.properties)) return false;
  // If it has instance_url, it's instance info, not property manager
  if (obj.instance_url) return false;
  // Check if it looks like property manager output (action field present)
  if (obj.action && typeof obj.action === 'string') return true;
  // Otherwise, don't match generic properties arrays
  return false;
}

interface FormattedOutput {
  summary: string;
  hasData: boolean;
}

/**
 * Auto-detect output type and generate appropriate summary
 *
 * DESIGN PRINCIPLE: Keep pattern matching minimal!
 * - Only match EXTERNAL tools (Jira, Azure DevOps, Confluence) with specific patterns
 * - All ServiceNow tools should be handled by the smart generic formatter
 * - This prevents pattern collision bugs
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
  let data = output;
  if (output.success === true && output.data && typeof output.data === 'object') {
    data = output.data;
  }

  // ============================================================================
  // EXTERNAL TOOLS ONLY - These have unique structures that need specific handling
  // ============================================================================

  // Jira - has unique key format (PROJECT-123) and fields structure
  if (data.issue && data.issue.key && isJiraKey(data.issue.key)) return formatJiraIssue(data);
  if (output.issue && output.issue.key && isJiraKey(output.issue.key)) return formatJiraIssue(output);
  if (isJiraIssueList(data)) return formatJiraIssueList(data);
  if (isJiraIssueList(output)) return formatJiraIssueList(output);

  // Azure DevOps - has unique System.* field names
  if (data.workItem && data.workItem.fields && data.workItem.fields['System.Title']) {
    return formatAzureWorkItem(data);
  }
  if (output.workItem && output.workItem.fields && output.workItem.fields['System.Title']) {
    return formatAzureWorkItem(output);
  }
  if (isAzureWorkItemList(data)) return formatAzureWorkItemList(data);
  if (isAzureWorkItemList(output)) return formatAzureWorkItemList(output);

  // Confluence - has unique space/title/content structure
  if (data.page && data.page.title && (data.page.space || data.page.spaceKey)) {
    return formatConfluencePage(data);
  }
  if (output.page && output.page.title && (output.page.space || output.page.spaceKey)) {
    return formatConfluencePage(output);
  }
  if (isConfluencePageList(data)) return formatConfluencePageList(data);
  if (isConfluencePageList(output)) return formatConfluencePageList(output);

  // GitHub - has unique structure with user.login, head/base refs
  if (isGitHubIssue(data)) return formatGitHubIssue(data);
  if (isGitHubIssue(output)) return formatGitHubIssue(output);
  if (isGitHubPR(data)) return formatGitHubPR(data);
  if (isGitHubPR(output)) return formatGitHubPR(output);
  if (isGitHubRepo(data)) return formatGitHubRepo(data);
  if (isGitHubRepo(output)) return formatGitHubRepo(output);
  if (isGitHubIssueList(data)) return formatGitHubIssueList(data);
  if (isGitHubIssueList(output)) return formatGitHubIssueList(output);

  // GitLab - has unique structure with iid, source_branch/target_branch
  if (isGitLabIssue(data)) return formatGitLabIssue(data);
  if (isGitLabIssue(output)) return formatGitLabIssue(output);
  if (isGitLabMR(data)) return formatGitLabMR(data);
  if (isGitLabMR(output)) return formatGitLabMR(output);
  if (isGitLabProject(data)) return formatGitLabProject(data);
  if (isGitLabProject(output)) return formatGitLabProject(output);
  if (isGitLabIssueList(data)) return formatGitLabIssueList(data);
  if (isGitLabIssueList(output)) return formatGitLabIssueList(output);

  // ============================================================================
  // ALL OTHER TOOLS - Use smart generic formatter
  // ============================================================================
  return formatGeneric(toolName, data);
}

/**
 * Check if output looks like an Azure DevOps work item list
 */
function isAzureWorkItemList(obj: any): boolean {
  if (!obj || !obj.workItems || !Array.isArray(obj.workItems)) return false;
  if (obj.workItems.length === 0) return false;
  const first = obj.workItems[0];
  return first && first.fields && first.fields['System.Title'] !== undefined;
}

/**
 * Check if output looks like a Confluence page list
 */
function isConfluencePageList(obj: any): boolean {
  if (!obj) return false;
  const pages = obj.pages || obj.results;
  if (!pages || !Array.isArray(pages)) return false;
  if (pages.length === 0) return false;
  const first = pages[0];
  return first && first.title && (first.space || first.spaceKey || first.type === 'page');
}

// ============================================================================
// GitHub Detection Functions
// ============================================================================

/**
 * Check if output looks like a GitHub issue (not PR)
 */
function isGitHubIssue(obj: any): boolean {
  if (!obj) return false;
  // GitHub issues have number, title, state, and html_url with github.com
  // PRs also have these but additionally have head/base refs
  const issue = obj.issue || obj;
  return issue.number !== undefined &&
         issue.title !== undefined &&
         issue.state !== undefined &&
         issue.html_url && issue.html_url.includes('github.com') &&
         !issue.head && !issue.base; // Not a PR
}

/**
 * Check if output looks like a GitHub Pull Request
 */
function isGitHubPR(obj: any): boolean {
  if (!obj) return false;
  const pr = obj.pull_request || obj.pr || obj;
  return pr.number !== undefined &&
         pr.title !== undefined &&
         pr.head && pr.head.ref &&
         pr.base && pr.base.ref;
}

/**
 * Check if output looks like a GitHub repository
 */
function isGitHubRepo(obj: any): boolean {
  if (!obj) return false;
  const repo = obj.repository || obj.repo || obj;
  return repo.full_name !== undefined &&
         repo.html_url && repo.html_url.includes('github.com') &&
         (repo.stargazers_count !== undefined || repo.owner !== undefined);
}

/**
 * Check if output looks like a GitHub issue/PR list
 */
function isGitHubIssueList(obj: any): boolean {
  if (!obj) return false;
  const items = obj.issues || obj.items || obj;
  if (!Array.isArray(items) || items.length === 0) return false;
  const first = items[0];
  return first.number !== undefined &&
         first.title !== undefined &&
         first.html_url && first.html_url.includes('github.com');
}

// ============================================================================
// GitLab Detection Functions
// ============================================================================

/**
 * Check if output looks like a GitLab issue
 */
function isGitLabIssue(obj: any): boolean {
  if (!obj) return false;
  const issue = obj.issue || obj;
  // GitLab uses iid (internal ID) and web_url with gitlab
  return issue.iid !== undefined &&
         issue.title !== undefined &&
         issue.state !== undefined &&
         issue.web_url && (issue.web_url.includes('gitlab.com') || issue.web_url.includes('gitlab')) &&
         !issue.source_branch; // Not an MR
}

/**
 * Check if output looks like a GitLab Merge Request
 */
function isGitLabMR(obj: any): boolean {
  if (!obj) return false;
  const mr = obj.merge_request || obj.mr || obj;
  return mr.iid !== undefined &&
         mr.title !== undefined &&
         mr.source_branch !== undefined &&
         mr.target_branch !== undefined;
}

/**
 * Check if output looks like a GitLab project
 */
function isGitLabProject(obj: any): boolean {
  if (!obj) return false;
  const project = obj.project || obj;
  return project.path_with_namespace !== undefined &&
         project.web_url && (project.web_url.includes('gitlab.com') || project.web_url.includes('gitlab'));
}

/**
 * Check if output looks like a GitLab issue list
 */
function isGitLabIssueList(obj: any): boolean {
  if (!obj) return false;
  const items = obj.issues || obj;
  if (!Array.isArray(items) || items.length === 0) return false;
  const first = items[0];
  return first.iid !== undefined &&
         first.title !== undefined &&
         first.web_url && (first.web_url.includes('gitlab.com') || first.web_url.includes('gitlab'));
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
// ServiceNow Instance Info Formatting
// ============================================================================

function formatInstanceInfo(output: any): FormattedOutput {
  const lines = [`${SYMBOLS.success} ServiceNow Instance`];

  lines.push(`${SYMBOLS.indent}URL: ${output.instance_url}`);

  // Extract useful info from properties if available
  if (output.properties && Array.isArray(output.properties)) {
    for (const prop of output.properties) {
      if (prop.name === 'instance.name') {
        lines.push(`${SYMBOLS.indent}Instance: ${prop.value}`);
      } else if (prop.name === 'glide.product.version') {
        lines.push(`${SYMBOLS.indent}Version: ${prop.value}`);
      } else if (prop.name === 'glide.product.name') {
        lines.push(`${SYMBOLS.indent}Product: ${prop.value}`);
      }
    }
  }

  // Show count of properties if we have them
  if (output.properties && output.properties.length > 0) {
    const shown = output.properties.filter((p: any) =>
      ['instance.name', 'glide.product.version', 'glide.product.name'].includes(p.name)
    ).length;
    const remaining = output.properties.length - shown;
    if (remaining > 0) {
      lines.push(`${SYMBOLS.indent}Properties: ${output.properties.length} loaded`);
    }
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// ServiceNow Property Formatting
// ============================================================================

function formatProperty(output: any): FormattedOutput {
  const prop = output.property || output;
  const name = prop.name || 'Unknown property';
  const value = prop.value !== undefined ? prop.value : 'N/A';

  // Check if it's a "not found" response
  if (output.found === false || prop.found === false) {
    return {
      summary: `${SYMBOLS.warning} Property not found: ${name}`,
      hasData: true
    };
  }

  const lines = [`${SYMBOLS.success} Property: ${name}`];

  if (typeof value === 'string' && value.length > 100) {
    lines.push(`${SYMBOLS.indent}Value: ${value.substring(0, 100)}...`);
  } else {
    lines.push(`${SYMBOLS.indent}Value: ${value}`);
  }

  if (prop.sys_id) lines.push(`${SYMBOLS.indent}sys_id: ${prop.sys_id}`);
  if (prop.description) lines.push(`${SYMBOLS.indent}Description: ${prop.description}`);
  if (output.action) lines.push(`${SYMBOLS.indent}Action: ${output.action}`);

  return { summary: lines.join('\n'), hasData: true };
}

function formatPropertyList(output: any): FormattedOutput {
  const properties = output.properties || [];
  const count = output.count || properties.length;
  const lines = [`${SYMBOLS.success} Found ${count} propert${count === 1 ? 'y' : 'ies'}`];

  for (let i = 0; i < Math.min(properties.length, 10); i++) {
    const prop = properties[i];
    const name = prop.name || 'Unknown';
    const value = prop.value !== undefined ? String(prop.value).substring(0, 40) : 'N/A';
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${name}: ${value}`);
  }

  if (properties.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatValidationResult(output: any): FormattedOutput {
  const valid = output.valid;
  const symbol = valid ? SYMBOLS.success : SYMBOLS.warning;
  const status = valid ? 'Validation passed' : 'Validation failed';

  const lines = [`${symbol} ${status}`];

  if (output.message) {
    lines.push(`${SYMBOLS.indent}${output.message}`);
  }

  if (output.issues && Array.isArray(output.issues) && output.issues.length > 0) {
    lines.push(`${SYMBOLS.indent}Issues: ${output.issues.length}`);
    for (let i = 0; i < Math.min(output.issues.length, 5); i++) {
      const issue = output.issues[i];
      const text = typeof issue === 'string' ? issue : (issue.message || issue.description || JSON.stringify(issue));
      lines.push(`${SYMBOLS.indent}${SYMBOLS.indent}${SYMBOLS.bullet} ${text}`);
    }
  }

  if (output.warnings && Array.isArray(output.warnings) && output.warnings.length > 0) {
    lines.push(`${SYMBOLS.indent}Warnings: ${output.warnings.length}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// Validation Issues Formatting (ServiceNow property validation, etc.)
// ============================================================================

function formatValidationIssues(output: any): FormattedOutput {
  const issues = output.issues || [];
  const valid = output.valid !== false;
  const symbol = valid ? SYMBOLS.success : SYMBOLS.warning;

  if (issues.length === 0) {
    return { summary: `${SYMBOLS.success} Validation passed`, hasData: false };
  }

  const lines = [`${symbol} Found ${issues.length} validation issue${issues.length === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(issues.length, 10); i++) {
    const issue = issues[i];
    // Handle different issue formats
    if (typeof issue === 'string') {
      lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${issue}`);
    } else if (issue.message) {
      const severity = issue.severity ? `[${issue.severity}] ` : '';
      lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${severity}${issue.message}`);
    } else if (issue.description) {
      lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${issue.description}`);
    } else {
      // Try to extract any meaningful info
      const text = issue.name || issue.field || issue.property || JSON.stringify(issue).substring(0, 50);
      lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${text}`);
    }
  }

  if (issues.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${issues.length - 10} more`);
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
// GitHub Formatting
// ============================================================================

function formatGitHubIssue(output: any): FormattedOutput {
  const issue = output.issue || output;
  const labels = issue.labels || [];
  const labelStr = labels.length > 0
    ? labels.map((l: any) => l.name || l).slice(0, 3).join(', ')
    : '';

  const lines = [
    `${SYMBOLS.success} GitHub Issue #${issue.number}`,
    `${SYMBOLS.indent}Title: ${issue.title}`,
    `${SYMBOLS.indent}State: ${issue.state}`,
    `${SYMBOLS.indent}Author: ${issue.user?.login || 'Unknown'}`
  ];

  if (issue.assignees && issue.assignees.length > 0) {
    const assignees = issue.assignees.map((a: any) => a.login).join(', ');
    lines.push(`${SYMBOLS.indent}Assignees: ${assignees}`);
  }
  if (labelStr) {
    lines.push(`${SYMBOLS.indent}Labels: ${labelStr}`);
  }
  if (issue.html_url) {
    lines.push(`${SYMBOLS.indent}URL: ${issue.html_url}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatGitHubPR(output: any): FormattedOutput {
  const pr = output.pull_request || output.pr || output;
  const lines = [
    `${SYMBOLS.success} GitHub PR #${pr.number}`,
    `${SYMBOLS.indent}Title: ${pr.title}`,
    `${SYMBOLS.indent}State: ${pr.state}${pr.merged ? ' (merged)' : ''}${pr.draft ? ' (draft)' : ''}`,
    `${SYMBOLS.indent}Branch: ${pr.head?.ref} → ${pr.base?.ref}`,
    `${SYMBOLS.indent}Author: ${pr.user?.login || 'Unknown'}`
  ];

  if (pr.mergeable !== undefined) {
    lines.push(`${SYMBOLS.indent}Mergeable: ${pr.mergeable ? 'Yes' : 'No'}`);
  }
  if (pr.additions !== undefined && pr.deletions !== undefined) {
    lines.push(`${SYMBOLS.indent}Changes: +${pr.additions} -${pr.deletions}`);
  }
  if (pr.html_url) {
    lines.push(`${SYMBOLS.indent}URL: ${pr.html_url}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatGitHubRepo(output: any): FormattedOutput {
  const repo = output.repository || output.repo || output;
  const lines = [
    `${SYMBOLS.success} GitHub Repository: ${repo.full_name}`,
    `${SYMBOLS.indent}Description: ${repo.description || 'No description'}`
  ];

  if (repo.language) {
    lines.push(`${SYMBOLS.indent}Language: ${repo.language}`);
  }
  if (repo.stargazers_count !== undefined) {
    lines.push(`${SYMBOLS.indent}Stars: ${repo.stargazers_count}`);
  }
  if (repo.forks_count !== undefined) {
    lines.push(`${SYMBOLS.indent}Forks: ${repo.forks_count}`);
  }
  if (repo.default_branch) {
    lines.push(`${SYMBOLS.indent}Default Branch: ${repo.default_branch}`);
  }
  if (repo.html_url) {
    lines.push(`${SYMBOLS.indent}URL: ${repo.html_url}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatGitHubIssueList(output: any): FormattedOutput {
  const items = output.issues || output.items || output;
  const count = output.total_count || items.length;
  const lines = [`${SYMBOLS.success} Found ${count} GitHub issue${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const item = items[i];
    const title = item.title || 'N/A';
    const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
    const isPR = item.pull_request ? ' (PR)' : '';
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} #${item.number}: ${truncatedTitle} [${item.state}]${isPR}`);
  }

  if (items.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// GitLab Formatting
// ============================================================================

function formatGitLabIssue(output: any): FormattedOutput {
  const issue = output.issue || output;
  const labels = issue.labels || [];
  const labelStr = labels.length > 0 ? labels.slice(0, 3).join(', ') : '';

  const lines = [
    `${SYMBOLS.success} GitLab Issue #${issue.iid}`,
    `${SYMBOLS.indent}Title: ${issue.title}`,
    `${SYMBOLS.indent}State: ${issue.state}`,
    `${SYMBOLS.indent}Author: ${issue.author?.username || issue.author?.name || 'Unknown'}`
  ];

  if (issue.assignees && issue.assignees.length > 0) {
    const assignees = issue.assignees.map((a: any) => a.username || a.name).join(', ');
    lines.push(`${SYMBOLS.indent}Assignees: ${assignees}`);
  }
  if (labelStr) {
    lines.push(`${SYMBOLS.indent}Labels: ${labelStr}`);
  }
  if (issue.web_url) {
    lines.push(`${SYMBOLS.indent}URL: ${issue.web_url}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatGitLabMR(output: any): FormattedOutput {
  const mr = output.merge_request || output.mr || output;
  const lines = [
    `${SYMBOLS.success} GitLab MR !${mr.iid}`,
    `${SYMBOLS.indent}Title: ${mr.title}`,
    `${SYMBOLS.indent}State: ${mr.state}${mr.merged_at ? ' (merged)' : ''}${mr.draft ? ' (draft)' : ''}`,
    `${SYMBOLS.indent}Branch: ${mr.source_branch} → ${mr.target_branch}`,
    `${SYMBOLS.indent}Author: ${mr.author?.username || mr.author?.name || 'Unknown'}`
  ];

  if (mr.merge_status) {
    lines.push(`${SYMBOLS.indent}Merge Status: ${mr.merge_status}`);
  }
  if (mr.web_url) {
    lines.push(`${SYMBOLS.indent}URL: ${mr.web_url}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatGitLabProject(output: any): FormattedOutput {
  const project = output.project || output;
  const lines = [
    `${SYMBOLS.success} GitLab Project: ${project.path_with_namespace}`,
    `${SYMBOLS.indent}Name: ${project.name}`,
    `${SYMBOLS.indent}Description: ${project.description || 'No description'}`
  ];

  if (project.star_count !== undefined) {
    lines.push(`${SYMBOLS.indent}Stars: ${project.star_count}`);
  }
  if (project.forks_count !== undefined) {
    lines.push(`${SYMBOLS.indent}Forks: ${project.forks_count}`);
  }
  if (project.default_branch) {
    lines.push(`${SYMBOLS.indent}Default Branch: ${project.default_branch}`);
  }
  if (project.web_url) {
    lines.push(`${SYMBOLS.indent}URL: ${project.web_url}`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

function formatGitLabIssueList(output: any): FormattedOutput {
  const items = output.issues || output;
  const count = items.length;
  const lines = [`${SYMBOLS.success} Found ${count} GitLab issue${count === 1 ? '' : 's'}`];

  for (let i = 0; i < Math.min(items.length, 10); i++) {
    const item = items[i];
    const title = item.title || 'N/A';
    const truncatedTitle = title.length > 40 ? title.substring(0, 37) + '...' : title;
    lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} #${item.iid}: ${truncatedTitle} [${item.state}]`);
  }

  if (items.length > 10) {
    lines.push(`${SYMBOLS.indent}... and ${count - 10} more`);
  }

  return { summary: lines.join('\n'), hasData: true };
}

// ============================================================================
// Smart Generic Formatter - Handles ALL ServiceNow tools automatically
// ============================================================================

function formatGeneric(toolName: string, output: any): FormattedOutput {
  const lines: string[] = [];

  // 1. Determine the action/status header
  const header = determineHeader(toolName, output);
  lines.push(header);

  // 2. Extract key identifiers (most important info first)
  const identifiers = extractIdentifiers(output);
  for (const [key, value] of identifiers) {
    lines.push(`${SYMBOLS.indent}${key}: ${value}`);
  }

  // 3. Handle arrays (lists of items)
  const arrayInfo = extractArrayInfo(output);
  if (arrayInfo) {
    lines.push(`${SYMBOLS.indent}${arrayInfo.label}: ${arrayInfo.count}`);
    // Show first few items
    for (const item of arrayInfo.preview) {
      lines.push(`${SYMBOLS.indent}${SYMBOLS.bullet} ${item}`);
    }
    if (arrayInfo.hasMore) {
      lines.push(`${SYMBOLS.indent}... and ${arrayInfo.remaining} more`);
    }
  }

  // 4. Extract URL if present
  if (output.url) {
    lines.push(`${SYMBOLS.indent}URL: ${output.url}`);
  } else if (output.instance_url) {
    lines.push(`${SYMBOLS.indent}Instance: ${output.instance_url}`);
  }

  // 5. Show validation status if present
  if (output.valid !== undefined) {
    const validSymbol = output.valid ? SYMBOLS.success : SYMBOLS.warning;
    lines.push(`${SYMBOLS.indent}Valid: ${validSymbol} ${output.valid}`);
  }

  // 6. If we still only have the header, extract some meaningful fields
  if (lines.length === 1) {
    const extracted = extractMeaningfulFields(output);
    for (const line of extracted) {
      lines.push(`${SYMBOLS.indent}${line}`);
    }
  }

  return { summary: lines.join('\n'), hasData: lines.length > 1 };
}

/**
 * Determine the header line based on output fields
 */
function determineHeader(toolName: string, output: any): string {
  // Action-based headers
  if (output.created === true) {
    const type = output.type ? getTypeName(output.type) : 'Record';
    const name = output.name || output.title || '';
    return `${SYMBOLS.success} Created ${type}${name ? ': ' + name : ''}`;
  }
  if (output.updated === true) {
    const type = output.type ? getTypeName(output.type) : 'Record';
    return `${SYMBOLS.success} Updated ${type}`;
  }
  if (output.deleted === true) return `${SYMBOLS.success} Deleted successfully`;
  if (output.started === true) return `${SYMBOLS.success} Started successfully`;
  if (output.stopped === true) return `${SYMBOLS.success} Stopped successfully`;
  if (output.enabled === true) return `${SYMBOLS.success} Enabled successfully`;
  if (output.disabled === true) return `${SYMBOLS.success} Disabled successfully`;
  if (output.found === false) return `${SYMBOLS.warning} Not found`;

  // Message-based headers
  if (output.action && typeof output.action === 'string') {
    return `${SYMBOLS.success} ${capitalizeFirst(output.action)} completed`;
  }
  if (output.message && typeof output.message === 'string') {
    return `${SYMBOLS.success} ${output.message}`;
  }

  // Object-type based headers
  if (output.instance_url) return `${SYMBOLS.success} ServiceNow Instance`;
  if (output.workflow) return `${SYMBOLS.success} Workflow: ${output.workflow.name || output.workflow.sys_id}`;
  if (output.incident) return `${SYMBOLS.success} Incident: ${output.incident.number || output.incident.sys_id}`;
  if (output.job) return `${SYMBOLS.success} Scheduled Job: ${output.job.name || output.job.sys_id}`;
  if (output.notification) return `${SYMBOLS.success} Notification: ${output.notification.name || output.notification.sys_id}`;
  if (output.property) return `${SYMBOLS.success} Property: ${output.property.name || 'N/A'}`;
  if (output.update_set) return `${SYMBOLS.success} Update Set: ${output.update_set.name || output.update_set.sys_id}`;

  // Default - use tool name
  return `${SYMBOLS.success} ${formatToolName(toolName)} completed`;
}

/**
 * Extract key identifiers from output
 */
function extractIdentifiers(output: any): [string, string][] {
  const result: [string, string][] = [];
  const seen = new Set<string>();

  // Priority order of identifier fields
  const fields = ['sys_id', 'id', 'key', 'number', 'name', 'title', 'table', 'type', 'scope'];

  for (const field of fields) {
    if (output[field] && typeof output[field] === 'string' && !seen.has(output[field])) {
      result.push([field, output[field]]);
      seen.add(output[field]);
      if (result.length >= 4) break; // Limit to 4 identifiers
    }
  }

  // Also check nested objects (e.g., output.workflow.sys_id)
  const nestedObjects = ['workflow', 'incident', 'job', 'notification', 'property', 'update_set'];
  for (const objName of nestedObjects) {
    if (output[objName] && typeof output[objName] === 'object') {
      const obj = output[objName];
      if (obj.sys_id && !seen.has(obj.sys_id)) {
        result.push(['sys_id', obj.sys_id]);
        seen.add(obj.sys_id);
      }
    }
  }

  return result;
}

/**
 * Extract array information for list display
 */
function extractArrayInfo(output: any): {
  label: string;
  count: number;
  preview: string[];
  hasMore: boolean;
  remaining: number;
} | null {
  // Find the first meaningful array
  const arrayFields = [
    'items', 'results', 'records', 'result', 'properties', 'workflows',
    'incidents', 'jobs', 'notifications', 'issues', 'activities', 'transitions'
  ];

  for (const field of arrayFields) {
    const arr = output[field];
    if (arr && Array.isArray(arr) && arr.length > 0) {
      const preview: string[] = [];
      const maxPreview = 5;

      for (let i = 0; i < Math.min(arr.length, maxPreview); i++) {
        const item = arr[i];
        const itemStr = extractItemSummary(item);
        preview.push(itemStr);
      }

      return {
        label: capitalizeFirst(field),
        count: output.count !== undefined ? output.count : arr.length,
        preview,
        hasMore: arr.length > maxPreview,
        remaining: arr.length - maxPreview
      };
    }
  }

  return null;
}

/**
 * Extract a one-line summary from an array item
 */
function extractItemSummary(item: any): string {
  if (typeof item === 'string') return item;
  if (typeof item !== 'object' || item === null) return String(item);

  // Try common name fields
  const name = item.name || item.title || item.number || item.short_description ||
               item.key || item.label || item.sys_id || 'Item';

  // Add status if available
  const status = item.state || item.status || (item.active === false ? 'inactive' : '');
  const statusStr = status ? ` [${status}]` : '';

  const nameStr = String(name);
  return nameStr.length > 50 ? nameStr.substring(0, 47) + '...' + statusStr : nameStr + statusStr;
}

/**
 * Extract meaningful fields when nothing else matched
 */
function extractMeaningfulFields(output: any): string[] {
  const lines: string[] = [];
  const skipFields = new Set(['success', 'data', 'error', 'message']);

  const keys = Object.keys(output).filter(k => !skipFields.has(k));
  for (const key of keys.slice(0, 5)) {
    const value = output[key];
    if (value !== null && value !== undefined) {
      if (typeof value === 'boolean') {
        lines.push(`${key}: ${value ? 'Yes' : 'No'}`);
      } else if (typeof value === 'number') {
        lines.push(`${key}: ${value}`);
      } else if (typeof value === 'string' && value.length > 0) {
        const display = value.length > 80 ? value.substring(0, 77) + '...' : value;
        lines.push(`${key}: ${display}`);
      } else if (Array.isArray(value)) {
        lines.push(`${key}: ${value.length} item${value.length === 1 ? '' : 's'}`);
      }
    }
  }

  return lines;
}

/**
 * Format tool name for display (remove prefix, make readable)
 */
function formatToolName(toolName: string): string {
  // Remove common prefixes
  let name = toolName
    .replace(/^snow_/, '')
    .replace(/^servicenow[-_]unified[-_]/, '')
    .replace(/^servicenow[-_]/, '');

  // Convert snake_case to Title Case
  return name.split('_').map(capitalizeFirst).join(' ');
}

/**
 * Get human-readable type name
 */
function getTypeName(type: string): string {
  const typeNames: Record<string, string> = {
    'sp_widget': 'Widget',
    'sp_page': 'Page',
    'sp_portal': 'Portal',
    'sys_script': 'Business Rule',
    'sys_script_include': 'Script Include',
    'sys_ui_page': 'UI Page',
    'sys_ui_action': 'UI Action',
    'sysauto_script': 'Scheduled Job',
    'sysevent_email_action': 'Email Notification',
    'wf_workflow': 'Workflow'
  };
  return typeNames[type] || type.replace(/_/g, ' ');
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export { SYMBOLS };
