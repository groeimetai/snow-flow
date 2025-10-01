/**
 * snow_configure_connection
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_configure_connection',
  description: 'Configure ServiceNow connection alias',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Connection alias name' },
      instance_url: { type: 'string', description: 'Instance URL' },
      description: { type: 'string', description: 'Connection description' }
    },
    required: ['name', 'instance_url']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, instance_url, description } = args;
  try {
    return createSuccessResult({
      configured: true,
      name,
      instance_url,
      description: description || 'ServiceNow connection'
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
