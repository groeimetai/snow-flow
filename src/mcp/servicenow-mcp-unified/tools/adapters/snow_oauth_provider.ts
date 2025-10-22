/**
 * snow_oauth_provider
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_oauth_provider',
  description: 'Create OAuth provider configuration',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'adapters',
  use_cases: ['oauth', 'authentication', 'sso'],
  complexity: 'intermediate',
  frequency: 'low',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Provider name' },
      client_id: { type: 'string', description: 'OAuth client ID' },
      auth_url: { type: 'string', description: 'Authorization URL' },
      token_url: { type: 'string', description: 'Token URL' }
    },
    required: ['name', 'client_id', 'auth_url', 'token_url']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, client_id, auth_url, token_url } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const oauthData = {
      name,
      client_id,
      authorization_url: auth_url,
      token_url,
      active: true
    };
    const response = await client.post('/api/now/table/oauth_entity', oauthData);
    return createSuccessResult({ created: true, oauth_provider: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
