/**
 * snow_error_handler
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_error_handler',
  description: 'Create error handler',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Handler name' },
      error_type: { type: 'string', description: 'Error type to handle' },
      handler_script: { type: 'string', description: 'Handler script (ES5 only!)' }
    },
    required: ['name', 'error_type', 'handler_script']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, error_type, handler_script } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const handlerData = {
      name,
      type: error_type,
      script: handler_script,
      active: true
    };
    const response = await client.post('/api/now/table/sys_error_handler', handlerData);
    return createSuccessResult({ created: true, handler: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
