/**
 * snow_custom_api
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_custom_api',
  description: 'Call custom API endpoint',
  inputSchema: {
    type: 'object',
    properties: {
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      path: { type: 'string', description: 'API path (relative to instance URL)' },
      body: { type: 'object', description: 'Request body' },
      params: { type: 'object', description: 'Query parameters' }
    },
    required: ['path']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { method = 'GET', path, body, params } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const config: any = { params };

    let response;
    if (method === 'GET') {
      response = await client.get(path, config);
    } else if (method === 'POST') {
      response = await client.post(path, body, config);
    } else if (method === 'PUT') {
      response = await client.put(path, body, config);
    } else if (method === 'PATCH') {
      response = await client.patch(path, body, config);
    } else if (method === 'DELETE') {
      response = await client.delete(path, config);
    }

    return createSuccessResult({
      success: true,
      method,
      path,
      status: response?.status,
      data: response?.data
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
