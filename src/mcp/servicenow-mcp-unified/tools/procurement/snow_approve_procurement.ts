/**
 * snow_approve_procurement
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_approve_procurement',
  description: 'Approve procurement request',
  inputSchema: {
    type: 'object',
    properties: {
      request_sys_id: { type: 'string' },
      comments: { type: 'string' }
    },
    required: ['request_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { request_sys_id, comments } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const approvalData: any = { approval: 'approved' };
    if (comments) approvalData.comments = comments;
    const response = await client.put(`/api/now/table/proc_request/${request_sys_id}`, approvalData);
    return createSuccessResult({ approved: true, request: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
