/**
 * snow_activate_plugin
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_activate_plugin',
  description: 'Activate ServiceNow plugin',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'administration',
  use_cases: ['plugin-management', 'activation', 'configuration'],
  complexity: 'intermediate',
  frequency: 'low',

  // Permission enforcement
  // Classification: WRITE - Write operation based on name pattern
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      plugin_id: { type: 'string', description: 'Plugin ID' }
    },
    required: ['plugin_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { plugin_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.post('/api/now/table/v_plugin', {
      id: plugin_id,
      active: true
    });
    return createSuccessResult({ activated: true, plugin: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
