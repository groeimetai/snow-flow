/**
 * snow_assign_role
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_assign_role',
  description: 'Assign role to user or group',
  inputSchema: {
    type: 'object',
    properties: {
      role: { type: 'string', description: 'Role sys_id' },
      user: { type: 'string', description: 'User sys_id (user or group required)' },
      group: { type: 'string', description: 'Group sys_id (user or group required)' },
      inherited: { type: 'boolean', default: false }
    },
    required: ['role']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { role, user, group, inherited = false } = args;
  try {
    if (!user && !group) {
      return createErrorResult('Either user or group must be specified');
    }
    const client = await getAuthenticatedClient(context);
    const assignmentData: any = { role, inherited };
    if (user) assignmentData.user = user;
    if (group) assignmentData.group = group;
    const response = await client.post('/api/now/table/sys_user_has_role', assignmentData);
    return createSuccessResult({ assigned: true, assignment: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
