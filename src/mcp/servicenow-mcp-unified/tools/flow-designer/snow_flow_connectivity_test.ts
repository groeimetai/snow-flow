/**
 * snow_flow_connectivity_test - Test flow connectivity
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_flow_connectivity_test',
  description: 'Test flow connectivity and action connections',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'flow-designer',
  use_cases: ['testing', 'connectivity', 'validation'],
  complexity: 'intermediate',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      flow_sys_id: {
        type: 'string',
        description: 'Flow sys_id to test connectivity'
      }
    },
    required: ['flow_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { flow_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);

    // Get flow details
    const flowResponse = await client.get(`/api/now/table/sys_hub_flow/${flow_sys_id}`);
    const flow = flowResponse.data.result;

    // Get flow actions
    const actionsResponse = await client.get('/api/now/table/sys_hub_action_instance', {
      params: {
        sysparm_query: `flow=${flow_sys_id}`,
        sysparm_fields: 'sys_id,name,action_name,active'
      }
    });

    const actions = actionsResponse.data.result;
    const connectivityResults = {
      flow_name: flow.name,
      flow_active: flow.active,
      total_actions: actions.length,
      active_actions: actions.filter((a: any) => a.active === 'true').length,
      actions: actions.map((a: any) => ({
        name: a.name,
        action_name: a.action_name,
        active: a.active
      }))
    };

    return createSuccessResult(connectivityResults);
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
