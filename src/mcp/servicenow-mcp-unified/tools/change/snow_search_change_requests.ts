/**
 * snow_search_change_requests - Search change requests
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_search_change_requests',
  description: 'Search change requests with filters',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      state: { type: 'string', description: 'Filter by state' },
      type: { type: 'string', description: 'Filter by type' },
      risk: { type: 'number', description: 'Filter by risk level' },
      assigned_to: { type: 'string', description: 'Filter by assignee' },
      limit: { type: 'number', description: 'Maximum results', default: 20 }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { query, state, type, risk, assigned_to, limit = 20 } = args;
  try {
    const client = await getAuthenticatedClient(context);

    let queryString = '';
    if (query) queryString = `short_descriptionLIKE${query}^ORdescriptionLIKE${query}`;
    if (state) queryString += (queryString ? '^' : '') + `state=${state}`;
    if (type) queryString += (queryString ? '^' : '') + `type=${type}`;
    if (risk) queryString += (queryString ? '^' : '') + `risk=${risk}`;
    if (assigned_to) queryString += (queryString ? '^' : '') + `assigned_to=${assigned_to}`;

    const response = await client.get(`/api/now/table/change_request?sysparm_query=${queryString}&sysparm_limit=${limit}`);
    return createSuccessResult({ changes: response.data?.result || [], count: response.data?.result?.length || 0 });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
