/**
 * snow_list_flows - List Flow Designer flows
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_list_flows',
  description: 'List Flow Designer flows',
  inputSchema: {
    type: 'object',
    properties: {
      active_only: { type: 'boolean', default: true },
      limit: { type: 'number', default: 50 }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { active_only = true, limit = 50 } = args;
  try {
    const client = await getAuthenticatedClient(context);
    let query = active_only ? 'active=true' : '';
    const response = await client.get('/api/now/table/sys_hub_flow', {
      params: { sysparm_query: query, sysparm_limit: limit }
    });
    return createSuccessResult({ flows: response.data.result, count: response.data.result.length });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
