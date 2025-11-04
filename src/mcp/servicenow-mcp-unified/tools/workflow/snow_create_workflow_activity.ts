/**
 * snow_create_workflow_activity
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_workflow_activity',
  description: 'Create workflow activity/stage',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'workflow',
  use_cases: ['workflow', 'workflow-activities', 'process-steps'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      workflow: { type: 'string', description: 'Workflow sys_id' },
      name: { type: 'string', description: 'Activity name' },
      activity_definition: { type: 'string', description: 'Activity type sys_id' },
      order: { type: 'number', description: 'Execution order' }
    },
    required: ['workflow', 'name', 'activity_definition']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { workflow, name, activity_definition, order } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const activityData: any = { workflow, name, activity_definition };
    if (order !== undefined) activityData.order = order;
    const response = await client.post('/api/now/table/wf_activity', activityData);
    return createSuccessResult({ created: true, activity: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
