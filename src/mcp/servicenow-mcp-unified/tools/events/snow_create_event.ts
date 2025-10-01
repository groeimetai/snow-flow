/**
 * snow_create_event
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_event',
  description: 'Create system event for event management',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Event name' },
      table: { type: 'string', description: 'Source table' },
      parm1: { type: 'string', description: 'Event parameter 1' },
      parm2: { type: 'string', description: 'Event parameter 2' },
      instance: { type: 'string', description: 'Instance name' }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, parm1, parm2, instance } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const eventData: any = { name };
    if (table) eventData.table = table;
    if (parm1) eventData.parm1 = parm1;
    if (parm2) eventData.parm2 = parm2;
    if (instance) eventData.instance = instance;
    const response = await client.post('/api/now/table/sysevent', eventData);
    return createSuccessResult({ created: true, event: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
