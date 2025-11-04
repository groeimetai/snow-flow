/**
 * snow_create_workflow_activity - Create workflow activity
 *
 * Creates workflow activities within existing workflows. Configures
 * activity types, conditions, and execution order.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_workflow_activity',
  description: 'Creates workflow activities within existing workflows. Configures activity types, conditions, and execution order.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'workflow',
  use_cases: ['automation', 'workflow', 'activities'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Activity name' },
      workflowName: { type: 'string', description: 'Parent workflow name or sys_id' },
      activityType: { type: 'string', description: 'Activity type (approval, script, notification, etc.)' },
      script: { type: 'string', description: 'Activity script (ES5 only!)' },
      condition: { type: 'string', description: 'Activity condition' },
      order: { type: 'number', description: 'Activity order', default: 100 },
      description: { type: 'string', description: 'Activity description' }
    },
    required: ['name', 'workflowName', 'activityType']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    workflowName,
    activityType,
    script = '',
    condition = '',
    order = 100,
    description = ''
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Resolve workflow ID if name provided
    let resolvedWorkflowId = workflowName;
    if (!workflowName.match(/^[a-f0-9]{32}$/)) {
      const workflowQuery = await client.get(
        `/api/now/table/wf_workflow?sysparm_query=name=${workflowName}&sysparm_limit=1`
      );
      if (!workflowQuery.data.result || workflowQuery.data.result.length === 0) {
        throw new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, `Workflow not found: ${workflowName}`);
      }
      resolvedWorkflowId = workflowQuery.data.result[0].sys_id;
    }

    const activityData: any = {
      name,
      workflow_version: resolvedWorkflowId,
      activity_definition: activityType,
      order,
      description
    };

    if (script) {
      activityData.script = script;
    }

    if (condition) {
      activityData.condition = condition;
    }

    const response = await client.post('/api/now/table/wf_activity', activityData);
    const activity = response.data.result;

    return createSuccessResult({
      created: true,
      workflow_activity: {
        sys_id: activity.sys_id,
        name: activity.name,
        workflow_id: resolvedWorkflowId,
        activity_type: activityType,
        order
      },
      message: '✅ Workflow activity created successfully'
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError
        ? error
        : new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message, { originalError: error })
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
