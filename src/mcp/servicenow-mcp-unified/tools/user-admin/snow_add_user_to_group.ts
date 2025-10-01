/**
 * snow_add_user_to_group
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_add_user_to_group',
  description: 'Add user to group',
  inputSchema: {
    type: 'object',
    properties: {
      user: { type: 'string', description: 'User sys_id' },
      group: { type: 'string', description: 'Group sys_id' }
    },
    required: ['user', 'group']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { user, group } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const membershipData = { user, group };
    const response = await client.post('/api/now/table/sys_user_grmember', membershipData);
    return createSuccessResult({ added: true, membership: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
