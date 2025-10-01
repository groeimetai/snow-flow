/**
 * snow_create_schedule
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_schedule',
  description: 'Create work schedule',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Schedule name' },
      time_zone: { type: 'string', description: 'Time zone' },
      type: { type: 'string', enum: ['weekly', 'monthly', 'custom'], default: 'weekly' }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, time_zone, type = 'weekly' } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const scheduleData: any = { name, type };
    if (time_zone) scheduleData.time_zone = time_zone;
    const response = await client.post('/api/now/table/cmn_schedule', scheduleData);
    return createSuccessResult({ created: true, schedule: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
