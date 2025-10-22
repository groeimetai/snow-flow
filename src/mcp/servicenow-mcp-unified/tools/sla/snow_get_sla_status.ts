/**
 * snow_get_sla_status
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_sla_status',
  description: 'Get SLA status for record',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'sla',
  use_cases: ['sla-monitoring', 'status-check', 'service-level'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      record_sys_id: { type: 'string', description: 'Record sys_id' }
    },
    required: ['table', 'record_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, record_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get('/api/now/table/task_sla', {
      params: {
        sysparm_query: `task=${record_sys_id}`,
        sysparm_display_value: 'true'
      }
    });
    return createSuccessResult({
      slas: response.data.result,
      count: response.data.result.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
