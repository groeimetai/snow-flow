/**
 * snow_execute_workflow
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_execute_workflow',
  description: 'Execute workflow on record',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'workflow',
  use_cases: ['workflow', 'workflow-execution', 'automation'],
  complexity: 'beginner',
  frequency: 'high',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Execution operation - can have side effects
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      workflow_sys_id: { type: 'string', description: 'Workflow sys_id' },
      record_sys_id: { type: 'string', description: 'Record to process' }
    },
    required: ['workflow_sys_id', 'record_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { workflow_sys_id, record_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const executeScript = `
var workflow = new Workflow();
workflow.startFlow('${workflow_sys_id}', null, 'insert', {'sys_id': '${record_sys_id}'});
    `;
    const response = await client.post('/api/now/table/sys_script_execution', {
      script: executeScript
    });
    return createSuccessResult({
      executed: true,
      workflow: workflow_sys_id,
      record: record_sys_id
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
