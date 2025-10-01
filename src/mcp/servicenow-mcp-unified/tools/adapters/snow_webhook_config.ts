/**
 * snow_webhook_config
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_webhook_config',
  description: 'Configure webhook endpoint',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Webhook name' },
      url: { type: 'string', description: 'Webhook URL' },
      http_method: { type: 'string', enum: ['POST', 'PUT', 'PATCH'], default: 'POST' },
      headers: { type: 'object', description: 'HTTP headers' }
    },
    required: ['name', 'url']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, url, http_method = 'POST', headers } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const webhookData: any = {
      name,
      url,
      http_method,
      active: true
    };
    if (headers) webhookData.headers = JSON.stringify(headers);
    const response = await client.post('/api/now/table/sys_web_service', webhookData);
    return createSuccessResult({ configured: true, webhook: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
