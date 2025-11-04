/**
 * snow_graphql_query
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_graphql_query',
  description: 'Execute GraphQL query',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'graphql',
  use_cases: ['graphql', 'query', 'data-retrieval'],
  complexity: 'intermediate',
  frequency: 'low',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: READ - Query operation - only reads data
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'GraphQL query' },
      variables: { type: 'object', description: 'Query variables' }
    },
    required: ['query']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { query, variables } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.post('/api/now/graphql', {
      query,
      variables: variables || {}
    });

    return createSuccessResult({
      success: true,
      data: response.data
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
