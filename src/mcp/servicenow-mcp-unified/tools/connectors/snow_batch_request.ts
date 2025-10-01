/**
 * snow_batch_request
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_batch_request',
  description: 'Execute batch REST requests',
  inputSchema: {
    type: 'object',
    properties: {
      requests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
            url: { type: 'string' },
            body: { type: 'object' }
          }
        },
        description: 'Array of requests'
      }
    },
    required: ['requests']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { requests } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const batchData = {
      batch_request_id: `batch_${Date.now()}`,
      rest_requests: requests
    };
    const response = await client.post('/api/now/v1/batch', batchData);
    return createSuccessResult({
      executed: true,
      batch_id: batchData.batch_request_id,
      results: response.data.result
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
