/**
 * snow_scripted_rest_api
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_scripted_rest_api',
  description: 'Call scripted REST API',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'rest-api',
  use_cases: ['rest', 'api', 'integration'],
  complexity: 'intermediate',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      api_namespace: { type: 'string', description: 'API namespace' },
      api_path: { type: 'string', description: 'API path' },
      method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      body: { type: 'object', description: 'Request body' }
    },
    required: ['api_namespace', 'api_path']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { api_namespace, api_path, method = 'GET', body } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const fullPath = `/api/${api_namespace}/${api_path}`;

    let response;
    if (method === 'GET') {
      response = await client.get(fullPath);
    } else if (method === 'POST') {
      response = await client.post(fullPath, body);
    } else if (method === 'PUT') {
      response = await client.put(fullPath, body);
    } else if (method === 'PATCH') {
      response = await client.patch(fullPath, body);
    } else if (method === 'DELETE') {
      response = await client.delete(fullPath);
    }

    return createSuccessResult({
      success: true,
      api_namespace,
      api_path,
      data: response?.data
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
