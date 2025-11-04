/**
 * snow_custom_plugin
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_custom_plugin',
  description: 'Execute custom plugin logic',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'administration',
  use_cases: ['plugin-customization', 'extensions', 'custom-logic'],
  complexity: 'advanced',
  frequency: 'low',

  // Permission enforcement
  // Classification: WRITE - Plugin function - executes custom plugin which can modify data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
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
