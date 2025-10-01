/**
 * snow_deactivate_user
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_deactivate_user',
  description: 'Deactivate user account',
  inputSchema: {
    type: 'object',
    properties: {
      user_id: { type: 'string', description: 'User sys_id' }
    },
    required: ['user_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { user_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.patch(`/api/now/table/sys_user/${user_id}`, { active: false });
    return createSuccessResult({ deactivated: true, user: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
