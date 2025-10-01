/**
 * snow_update_set_switch - Switch active Update Set
 *
 * Switches the active Update Set context to an existing set.
 * Ensures all subsequent changes are tracked in the specified Update Set.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_switch',
  description: 'Switch to a different Update Set for tracking changes',
  inputSchema: {
    type: 'object',
    properties: {
      update_set_id: {
        type: 'string',
        description: 'Update Set sys_id to switch to'
      }
    },
    required: ['update_set_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Verify Update Set exists
    const checkResponse = await client.get(`/api/now/table/sys_update_set/${update_set_id}`, {
      params: {
        sysparm_fields: 'sys_id,name,description,state,sys_created_on'
      }
    });

    if (!checkResponse.data.result) {
      return createErrorResult(`Update Set not found: ${update_set_id}`);
    }

    const updateSet = checkResponse.data.result;

    // Switch to this Update Set
    await client.put(`/api/now/table/sys_update_set/${update_set_id}`, {
      is_current: true
    });

    return createSuccessResult({
      sys_id: updateSet.sys_id,
      name: updateSet.name,
      description: updateSet.description,
      state: updateSet.state,
      switched: true,
      created_at: updateSet.sys_created_on
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
