/**
 * snow_list_plugins
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_list_plugins',
  description: 'List installed plugins',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'administration',
  use_cases: ['plugin-discovery', 'plugin-management', 'administration'],
  complexity: 'beginner',
  frequency: 'low',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: READ - Read-only operation based on name pattern
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      active_only: { type: 'boolean', default: false }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { active_only = false } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const query = active_only ? 'active=true' : '';
    const response = await client.get('/api/now/table/v_plugin', {
      params: {
        sysparm_query: query,
        sysparm_limit: 100
      }
    });
    return createSuccessResult({
      plugins: response.data.result,
      count: response.data.result.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
