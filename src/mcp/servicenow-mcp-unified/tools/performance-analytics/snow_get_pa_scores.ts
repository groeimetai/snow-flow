/**
 * snow_get_pa_scores
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_pa_scores',
  description: 'Get PA scores',
  inputSchema: {
    type: 'object',
    properties: {
      indicator_sys_id: { type: 'string' },
      time_range: { type: 'string' }
    },
    required: ['indicator_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { indicator_sys_id, time_range = '30days' } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get('/api/now/table/pa_scores', {
      params: { sysparm_query: `indicator=${indicator_sys_id}`, sysparm_limit: 100 }
    });
    return createSuccessResult({ scores: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
