/**
 * snow_update_change_state - Update change state
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_change_state',
  description: 'Update change request state through its lifecycle',
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: { type: 'string', description: 'Change request sys_id or number' },
      state: { type: 'string', description: 'New state', enum: ['draft', 'assess', 'authorize', 'scheduled', 'implement', 'review', 'closed', 'cancelled'] },
      close_notes: { type: 'string', description: 'Closure notes' },
      close_code: { type: 'string', description: 'Closure code' }
    },
    required: ['sys_id', 'state']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { sys_id, state, close_notes, close_code } = args;
  try {
    const client = await getAuthenticatedClient(context);

    // Map state names to numeric values
    const stateMap: Record<string, string> = {
      draft: '-5',
      assess: '-4',
      authorize: '-3',
      scheduled: '-2',
      implement: '-1',
      review: '0',
      closed: '3',
      cancelled: '4'
    };

    const updateData: any = { state: stateMap[state] || state };
    if (close_notes) updateData.close_notes = close_notes;
    if (close_code) updateData.close_code = close_code;

    // Find change by sys_id or number
    const changeQuery = sys_id.match(/^[a-f0-9]{32}$/)
      ? `sys_id=${sys_id}`
      : `number=${sys_id}`;
    const changeResponse = await client.get(`/api/now/table/change_request?sysparm_query=${changeQuery}`);

    if (!changeResponse.data?.result?.[0]) {
      return createErrorResult('Change request not found');
    }

    const changeSysId = changeResponse.data.result[0].sys_id;
    const response = await client.patch(`/api/now/table/change_request/${changeSysId}`, updateData);

    return createSuccessResult({ updated: true, change: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
