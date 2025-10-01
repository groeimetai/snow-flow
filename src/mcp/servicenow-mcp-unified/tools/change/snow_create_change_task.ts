/**
 * snow_create_change_task - Create change task
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_change_task',
  description: 'Create change implementation task',
  inputSchema: {
    type: 'object',
    properties: {
      change_request: { type: 'string' },
      short_description: { type: 'string' },
      assigned_to: { type: 'string' },
      planned_start_date: { type: 'string' },
      planned_end_date: { type: 'string' }
    },
    required: ['change_request', 'short_description']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { change_request, short_description, assigned_to, planned_start_date, planned_end_date } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const taskData: any = { change_request, short_description };
    if (assigned_to) taskData.assigned_to = assigned_to;
    if (planned_start_date) taskData.planned_start_date = planned_start_date;
    if (planned_end_date) taskData.planned_end_date = planned_end_date;
    const response = await client.post('/api/now/table/change_task', taskData);
    return createSuccessResult({ created: true, task: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
