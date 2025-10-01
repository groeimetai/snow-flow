/**
 * snow_create_group
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_group',
  description: 'Create user group',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Group name' },
      description: { type: 'string', description: 'Group description' },
      manager: { type: 'string', description: 'Manager sys_id' },
      type: { type: 'string', description: 'Group type' },
      active: { type: 'boolean', default: true }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, description, manager, type, active = true } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const groupData: any = { name, active };
    if (description) groupData.description = description;
    if (manager) groupData.manager = manager;
    if (type) groupData.type = type;
    const response = await client.post('/api/now/table/sys_user_group', groupData);
    return createSuccessResult({ created: true, group: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
