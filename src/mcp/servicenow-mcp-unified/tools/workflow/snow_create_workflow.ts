/**
 * snow_create_workflow
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_workflow',
  description: 'Create workflow definition',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'workflow',
  use_cases: ['workflow', 'process-automation', 'business-logic'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Workflow name' },
      table: { type: 'string', description: 'Table workflow applies to' },
      description: { type: 'string', description: 'Workflow description' },
      condition: { type: 'string', description: 'When to trigger workflow' }
    },
    required: ['name', 'table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, description, condition } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const workflowData: any = { name, table };
    if (description) workflowData.description = description;
    if (condition) workflowData.condition = condition;
    const response = await client.post('/api/now/table/wf_workflow', workflowData);
    return createSuccessResult({ created: true, workflow: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
