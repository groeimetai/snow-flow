/**
 * snow_delete_attachment
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_delete_attachment',
  description: 'Delete attachment',
  inputSchema: {
    type: 'object',
    properties: {
      attachment_sys_id: { type: 'string', description: 'Attachment sys_id' }
    },
    required: ['attachment_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { attachment_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    await client.delete(`/api/now/attachment/${attachment_sys_id}`);
    return createSuccessResult({ deleted: true, attachment_sys_id });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
