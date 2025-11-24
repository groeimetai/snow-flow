/**
 * Enterprise Credentials Gathering
 * Reads credentials from environment variables based on tool name
 */

import { EnterpriseCredentials } from './types.js';

/**
 * Gather credentials from environment variables based on tool name
 * @param toolName - Name of the tool being called (e.g., snow_jira_create_issue)
 * @returns Credentials object with only relevant credentials populated
 *
 * Atlassian Credential Sharing:
 * Jira and Confluence use the same Atlassian credentials (email + API token).
 * If one is missing, we'll try to use the other as fallback.
 */
export function gatherCredentials(toolName: string): Partial<EnterpriseCredentials> {
  const credentials: Partial<EnterpriseCredentials> = {};

  // Jira tools (jira_* or snow_jira_*)
  if (toolName.startsWith('jira_') || toolName.startsWith('snow_jira_')) {
    if (process.env.JIRA_HOST && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
      credentials.jira = {
        host: process.env.JIRA_HOST,
        email: process.env.JIRA_EMAIL,
        apiToken: process.env.JIRA_API_TOKEN,
      };
    }
    // Fallback: Try Confluence credentials if Jira not set (Atlassian credential sharing)
    else if (process.env.CONFLUENCE_HOST && process.env.CONFLUENCE_EMAIL && process.env.CONFLUENCE_API_TOKEN) {
      credentials.jira = {
        host: process.env.CONFLUENCE_HOST.replace('/wiki', '').replace('https://', '').replace('http://', ''),
        email: process.env.CONFLUENCE_EMAIL,
        apiToken: process.env.CONFLUENCE_API_TOKEN,
      };
    }
  }

  // Azure DevOps tools (azure_* or snow_azure_*)
  if (toolName.startsWith('azure_') || toolName.startsWith('snow_azure_')) {
    if (process.env.AZURE_DEVOPS_ORG && process.env.AZURE_DEVOPS_PAT) {
      credentials.azure = {
        organization: process.env.AZURE_DEVOPS_ORG,
        pat: process.env.AZURE_DEVOPS_PAT,
      };
    }
  }

  // Confluence tools (confluence_* or snow_confluence_*)
  if (toolName.startsWith('confluence_') || toolName.startsWith('snow_confluence_')) {
    if (process.env.CONFLUENCE_HOST && process.env.CONFLUENCE_EMAIL && process.env.CONFLUENCE_API_TOKEN) {
      credentials.confluence = {
        host: process.env.CONFLUENCE_HOST,
        email: process.env.CONFLUENCE_EMAIL,
        apiToken: process.env.CONFLUENCE_API_TOKEN,
      };
    }
    // Fallback: Try Jira credentials if Confluence not set (Atlassian credential sharing)
    else if (process.env.JIRA_HOST && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN) {
      credentials.confluence = {
        host: process.env.JIRA_HOST.includes('://') ? process.env.JIRA_HOST : 'https://' + process.env.JIRA_HOST,
        email: process.env.JIRA_EMAIL,
        apiToken: process.env.JIRA_API_TOKEN,
      };
    }
  }

  return credentials;
}

/**
 * Check if all required credentials are available for a tool
 * @param toolName - Name of the tool
 * @returns true if credentials are available, false otherwise
 *
 * Considers Atlassian credential sharing: returns true if fallback available.
 */
export function hasRequiredCredentials(toolName: string): boolean {
  const credentials = gatherCredentials(toolName);

  if (toolName.startsWith('jira_') || toolName.startsWith('snow_jira_')) {
    return !!credentials.jira;
  }

  if (toolName.startsWith('azure_') || toolName.startsWith('snow_azure_')) {
    return !!credentials.azure;
  }

  if (toolName.startsWith('confluence_') || toolName.startsWith('snow_confluence_')) {
    return !!credentials.confluence;
  }

  return false;
}

/**
 * Get list of missing credential environment variables for a tool
 * @param toolName - Name of the tool
 * @returns Array of missing environment variable names
 *
 * Considers Atlassian credential sharing: won't report missing if fallback available.
 */
export function getMissingCredentials(toolName: string): string[] {
  const missing: string[] = [];

  if (toolName.startsWith('jira_') || toolName.startsWith('snow_jira_')) {
    const hasJira = process.env.JIRA_HOST && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN;
    const hasConfluence = process.env.CONFLUENCE_HOST && process.env.CONFLUENCE_EMAIL && process.env.CONFLUENCE_API_TOKEN;

    if (!hasJira && !hasConfluence) {
      // No Atlassian credentials at all
      if (!process.env.JIRA_HOST) missing.push('JIRA_HOST');
      if (!process.env.JIRA_EMAIL) missing.push('JIRA_EMAIL');
      if (!process.env.JIRA_API_TOKEN) missing.push('JIRA_API_TOKEN');
    }
    // If Confluence credentials available, they'll be used as fallback (no warnings needed)
  }

  if (toolName.startsWith('azure_') || toolName.startsWith('snow_azure_')) {
    if (!process.env.AZURE_DEVOPS_ORG) missing.push('AZURE_DEVOPS_ORG');
    if (!process.env.AZURE_DEVOPS_PAT) missing.push('AZURE_DEVOPS_PAT');
  }

  if (toolName.startsWith('confluence_') || toolName.startsWith('snow_confluence_')) {
    const hasConfluence = process.env.CONFLUENCE_HOST && process.env.CONFLUENCE_EMAIL && process.env.CONFLUENCE_API_TOKEN;
    const hasJira = process.env.JIRA_HOST && process.env.JIRA_EMAIL && process.env.JIRA_API_TOKEN;

    if (!hasConfluence && !hasJira) {
      // No Atlassian credentials at all
      if (!process.env.CONFLUENCE_HOST) missing.push('CONFLUENCE_HOST');
      if (!process.env.CONFLUENCE_EMAIL) missing.push('CONFLUENCE_EMAIL');
      if (!process.env.CONFLUENCE_API_TOKEN) missing.push('CONFLUENCE_API_TOKEN');
    }
    // If Jira credentials available, they'll be used as fallback (no warnings needed)
  }

  return missing;
}
