/**
 * snow_create_rest_method
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_rest_method',
  description: 'Create REST method for REST message',
  inputSchema: {
    type: 'object',
    properties: {
      rest_message_sys_id: { type: 'string', description: 'REST message sys_id' },
      name: { type: 'string', description: 'Method name' },
      http_method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      endpoint: { type: 'string', description: 'Endpoint path' },
      content: { type: 'string', description: 'Request body template' }
    },
    required: ['rest_message_sys_id', 'name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { rest_message_sys_id, name, http_method = 'GET', endpoint, content } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const methodData: any = {
      rest_message: rest_message_sys_id,
      name,
      http_method
    };
    if (endpoint) methodData.endpoint = endpoint;
    if (content) methodData.content = content;
    const response = await client.post('/api/now/table/sys_rest_message_fn', methodData);
    return createSuccessResult({ created: true, rest_method: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
