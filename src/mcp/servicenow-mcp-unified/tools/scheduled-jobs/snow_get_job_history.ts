/**
 * snow_get_job_history
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_job_history',
  description: 'Get scheduled job execution history',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'scheduling',
  use_cases: ['job-history', 'monitoring', 'troubleshooting'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      job_sys_id: { type: 'string', description: 'Scheduled job sys_id' },
      limit: { type: 'number', default: 50 }
    },
    required: ['job_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { job_sys_id, limit = 50 } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get('/api/now/table/sysauto_script_execution', {
      params: {
        sysparm_query: `script=${job_sys_id}`,
        sysparm_limit: limit,
        sysparm_display_value: 'true'
      }
    });
    return createSuccessResult({
      history: response.data.result,
      count: response.data.result.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
