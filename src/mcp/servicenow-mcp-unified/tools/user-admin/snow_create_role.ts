/**
 * snow_create_role
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_role',
  description: 'Create security role',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Role name' },
      description: { type: 'string', description: 'Role description' },
      requires_subscription: { type: 'string', description: 'Required subscription' }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, description, requires_subscription } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const roleData: any = { name };
    if (description) roleData.description = description;
    if (requires_subscription) roleData.requires_subscription = requires_subscription;
    const response = await client.post('/api/now/table/sys_user_role', roleData);
    return createSuccessResult({ created: true, role: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
