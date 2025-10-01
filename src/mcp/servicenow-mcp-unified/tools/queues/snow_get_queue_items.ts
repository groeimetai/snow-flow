/**
 * snow_get_queue_items
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_queue_items',
  description: 'Get items in queue',
  inputSchema: {
    type: 'object',
    properties: {
      queue_sys_id: { type: 'string', description: 'Queue sys_id' },
      limit: { type: 'number', default: 50 }
    },
    required: ['queue_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { queue_sys_id, limit = 50 } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const queueRecord = await client.get(`/api/now/table/sys_queue/${queue_sys_id}`);
    const table = queueRecord.data.result.table;
    const condition = queueRecord.data.result.condition;

    const response = await client.get(`/api/now/table/${table}`, {
      params: {
        sysparm_query: condition,
        sysparm_limit: limit
      }
    });
    return createSuccessResult({
      items: response.data.result,
      count: response.data.result.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
