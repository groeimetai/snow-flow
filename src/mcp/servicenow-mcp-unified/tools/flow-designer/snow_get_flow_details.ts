/**
 * snow_get_flow_details - Get flow details
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_flow_details',
  description: 'Get detailed flow configuration including triggers, actions, and variables',
  inputSchema: {
    type: 'object',
    properties: {
      flow_sys_id: {
        type: 'string',
        description: 'Flow sys_id to get details'
      },
      include_actions: {
        type: 'boolean',
        description: 'Include action details',
        default: true
      }
    },
    required: ['flow_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { flow_sys_id, include_actions = true } = args;
  try {
    const client = await getAuthenticatedClient(context);

    // Get flow details
    const flowResponse = await client.get(`/api/now/table/sys_hub_flow/${flow_sys_id}`);
    const flow = flowResponse.data.result;

    const details: any = {
      sys_id: flow.sys_id,
      name: flow.name,
      description: flow.description,
      active: flow.active,
      trigger_type: flow.trigger_type,
      table: flow.table,
      run_as: flow.run_as
    };

    if (include_actions) {
      // Get flow actions
      const actionsResponse = await client.get('/api/now/table/sys_hub_action_instance', {
        params: {
          sysparm_query: `flow=${flow_sys_id}`,
          sysparm_fields: 'sys_id,name,action_name,sequence,active,inputs'
        }
      });

      details.actions = actionsResponse.data.result;
    }

    return createSuccessResult(details);
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
