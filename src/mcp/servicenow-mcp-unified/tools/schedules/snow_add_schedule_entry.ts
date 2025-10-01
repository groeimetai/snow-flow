/**
 * snow_add_schedule_entry
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_add_schedule_entry',
  description: 'Add entry to schedule',
  inputSchema: {
    type: 'object',
    properties: {
      schedule_sys_id: { type: 'string', description: 'Schedule sys_id' },
      name: { type: 'string', description: 'Entry name' },
      type: { type: 'string', enum: ['include', 'exclude'], default: 'include' },
      start_date_time: { type: 'string', description: 'Start date time' },
      end_date_time: { type: 'string', description: 'End date time' }
    },
    required: ['schedule_sys_id', 'name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { schedule_sys_id, name, type = 'include', start_date_time, end_date_time } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const entryData: any = {
      schedule: schedule_sys_id,
      name,
      type
    };
    if (start_date_time) entryData.start_date_time = start_date_time;
    if (end_date_time) entryData.end_date_time = end_date_time;
    const response = await client.post('/api/now/table/cmn_schedule_span', entryData);
    return createSuccessResult({ added: true, entry: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
