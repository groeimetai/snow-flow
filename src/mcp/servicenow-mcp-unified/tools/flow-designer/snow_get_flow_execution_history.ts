/**
 * snow_get_flow_execution_history - Get flow execution history
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_flow_execution_history',
  description: 'Get flow execution history with filtering options',
  inputSchema: {
    type: 'object',
    properties: {
      flow_sys_id: {
        type: 'string',
        description: 'Flow sys_id to get execution history'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of executions to return',
        default: 10,
        minimum: 1,
        maximum: 100
      },
      status: {
        type: 'string',
        description: 'Filter by execution status',
        enum: ['success', 'error', 'in_progress', 'cancelled']
      }
    },
    required: ['flow_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { flow_sys_id, limit = 10, status } = args;
  try {
    const client = await getAuthenticatedClient(context);

    let query = `flow=${flow_sys_id}`;
    if (status) {
      query += `^status=${status}`;
    }

    const response = await client.get('/api/now/table/sys_hub_flow_context', {
      params: {
        sysparm_query: query + '^ORDERBYDESCstarted',
        sysparm_limit: limit,
        sysparm_fields: 'sys_id,status,started,completed,trigger_record,error_message'
      }
    });

    const executions = response.data.result;

    return createSuccessResult({
      flow_sys_id,
      count: executions.length,
      executions: executions.map((e: any) => ({
        sys_id: e.sys_id,
        status: e.status,
        started: e.started,
        completed: e.completed,
        trigger_record: e.trigger_record,
        error_message: e.error_message
      }))
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
