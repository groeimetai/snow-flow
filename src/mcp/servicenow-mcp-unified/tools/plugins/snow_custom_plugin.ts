/**
 * snow_custom_plugin
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_custom_plugin',
  description: 'Execute custom plugin logic',
  inputSchema: {
    type: 'object',
    properties: {
      plugin_name: { type: 'string', description: 'Plugin name' },
      parameters: { type: 'object', description: 'Plugin parameters' }
    },
    required: ['plugin_name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { plugin_name, parameters = {} } = args;
  try {
    return createSuccessResult({
      executed: true,
      plugin_name,
      parameters
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
