/**
 * snow_create_user
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_user',
  description: 'Create new user account',
  inputSchema: {
    type: 'object',
    properties: {
      user_name: { type: 'string', description: 'Username' },
      first_name: { type: 'string', description: 'First name' },
      last_name: { type: 'string', description: 'Last name' },
      email: { type: 'string', description: 'Email address' },
      department: { type: 'string', description: 'Department sys_id' },
      manager: { type: 'string', description: 'Manager sys_id' },
      active: { type: 'boolean', default: true }
    },
    required: ['user_name', 'first_name', 'last_name', 'email']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { user_name, first_name, last_name, email, department, manager, active = true } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const userData: any = { user_name, first_name, last_name, email, active };
    if (department) userData.department = department;
    if (manager) userData.manager = manager;
    const response = await client.post('/api/now/table/sys_user', userData);
    return createSuccessResult({ created: true, user: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
