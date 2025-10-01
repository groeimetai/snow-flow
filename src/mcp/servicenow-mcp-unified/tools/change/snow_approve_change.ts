/**
 * snow_approve_change - Approve change request
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_approve_change',
  description: 'Approve change request',
  inputSchema: {
    type: 'object',
    properties: {
      change_sys_id: { type: 'string' },
      comments: { type: 'string' }
    },
    required: ['change_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { change_sys_id, comments } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const updateData: any = { approval: 'approved' };
    if (comments) updateData.comments = comments;
    const response = await client.put(`/api/now/table/change_request/${change_sys_id}`, updateData);
    return createSuccessResult({ approved: true, change: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
