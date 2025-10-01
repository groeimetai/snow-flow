/**
 * snow_event_handler
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_event_handler',
  description: 'Create event handler',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Handler name' },
      event_name: { type: 'string', description: 'Event name to handle' },
      script: { type: 'string', description: 'Handler script (ES5 only!)' }
    },
    required: ['name', 'event_name', 'script']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, event_name, script } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const handlerData = {
      name,
      event_name,
      script,
      active: true
    };
    const response = await client.post('/api/now/table/sysevent_script_action', handlerData);
    return createSuccessResult({ created: true, event_handler: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
