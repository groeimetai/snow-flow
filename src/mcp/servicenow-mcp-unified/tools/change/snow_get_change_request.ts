/**
 * snow_get_change_request - Get change request details
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_change_request',
  description: 'Get change request details including approval status, tasks, and related items',
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: { type: 'string', description: 'Change request sys_id or number' },
      include_tasks: { type: 'boolean', description: 'Include change tasks', default: true },
      include_approvals: { type: 'boolean', description: 'Include approval history', default: true }
    },
    required: ['sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { sys_id, include_tasks = true, include_approvals = true } = args;
  try {
    const client = await getAuthenticatedClient(context);

    // Get change request
    const changeQuery = sys_id.match(/^[a-f0-9]{32}$/)
      ? `sys_id=${sys_id}`
      : `number=${sys_id}`;
    const changeResponse = await client.get(`/api/now/table/change_request?sysparm_query=${changeQuery}`);

    if (!changeResponse.data?.result?.[0]) {
      return createErrorResult('Change request not found');
    }

    const change = changeResponse.data.result[0];
    const result: any = { change };

    // Get tasks if requested
    if (include_tasks) {
      const tasksResponse = await client.get(`/api/now/table/change_task?sysparm_query=change_request=${change.sys_id}`);
      result.tasks = tasksResponse.data?.result || [];
    }

    // Get approvals if requested
    if (include_approvals) {
      const approvalsResponse = await client.get(`/api/now/table/sysapproval_approver?sysparm_query=document_id=${change.sys_id}`);
      result.approvals = approvalsResponse.data?.result || [];
    }

    return createSuccessResult(result);
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
