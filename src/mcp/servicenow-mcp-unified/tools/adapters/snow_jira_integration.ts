/**
 * snow_jira_integration
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_jira_integration',
  description: 'Configure JIRA integration',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'adapters',
  use_cases: ['jira-integration', 'third-party-integration', 'issue-tracking'],
  complexity: 'intermediate',
  frequency: 'low',
  inputSchema: {
    type: 'object',
    properties: {
      jira_url: { type: 'string', description: 'JIRA instance URL' },
      username: { type: 'string', description: 'JIRA username' },
      api_token: { type: 'string', description: 'JIRA API token' }
    },
    required: ['jira_url', 'username', 'api_token']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { jira_url, username, api_token } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const integrationData = {
      name: 'JIRA Integration',
      url: jira_url,
      username,
      password: api_token,
      active: true
    };
    const response = await client.post('/api/now/table/sys_integration', integrationData);
    return createSuccessResult({ configured: true, integration: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
