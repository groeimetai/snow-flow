/**
 * snow_execute_flow - Execute Flow Designer flow
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_flow',
  description: 'Execute Flow Designer flow',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'flow-designer',
  use_cases: ['flow-execution', 'automation', 'orchestration'],
  complexity: 'beginner',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Execution operation - can have side effects
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      flow_sys_id: { type: 'string' },
      inputs: { type: 'object', description: 'Flow input variables' }
    },
    required: ['flow_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { flow_sys_id, inputs = {} } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.post(`/api/now/v1/process/execute/${flow_sys_id}`, inputs);
    return createSuccessResult({ executed: true, execution: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
