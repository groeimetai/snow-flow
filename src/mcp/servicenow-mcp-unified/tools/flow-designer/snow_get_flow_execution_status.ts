/**
 * snow_get_flow_execution_status - Get flow execution status
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_flow_execution_status',
  description: 'Get status of a specific flow execution',
  inputSchema: {
    type: 'object',
    properties: {
      execution_sys_id: {
        type: 'string',
        description: 'Flow execution context sys_id'
      },
      include_action_details: {
        type: 'boolean',
        description: 'Include individual action execution details',
        default: false
      }
    },
    required: ['execution_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { execution_sys_id, include_action_details = false } = args;
  try {
    const client = await getAuthenticatedClient(context);

    // Get execution context
    const executionResponse = await client.get(`/api/now/table/sys_hub_flow_context/${execution_sys_id}`);
    const execution = executionResponse.data.result;

    const status: any = {
      sys_id: execution.sys_id,
      status: execution.status,
      started: execution.started,
      completed: execution.completed,
      duration_seconds: execution.completed && execution.started
        ? Math.round((new Date(execution.completed).getTime() - new Date(execution.started).getTime()) / 1000)
        : null,
      flow: execution.flow,
      trigger_record: execution.trigger_record,
      error_message: execution.error_message
    };

    if (include_action_details) {
      // Get action execution details
      const actionsResponse = await client.get('/api/now/table/sys_hub_action_context', {
        params: {
          sysparm_query: `flow_context=${execution_sys_id}`,
          sysparm_fields: 'sys_id,action,status,started,completed,error_message'
        }
      });

      status.actions = actionsResponse.data.result;
    }

    return createSuccessResult(status);
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
