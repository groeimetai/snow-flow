/**
 * snow_create_application
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_application',
  description: 'Create scoped application',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'applications',
  use_cases: ['app-development', 'scoped-apps', 'development'],
  complexity: 'advanced',
  frequency: 'low',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Application name' },
      scope: { type: 'string', description: 'Application scope' },
      version: { type: 'string', description: 'Version', default: '1.0.0' },
      short_description: { type: 'string', description: 'Description' }
    },
    required: ['name', 'scope']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, scope, version = '1.0.0', short_description } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const appData: any = { name, scope, version };
    if (short_description) appData.short_description = short_description;
    const response = await client.post('/api/now/table/sys_app', appData);
    return createSuccessResult({ created: true, application: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
