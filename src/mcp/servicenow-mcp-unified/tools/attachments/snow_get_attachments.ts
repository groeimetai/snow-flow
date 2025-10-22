/**
 * snow_get_attachments
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_attachments',
  description: 'Get attachments for record',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'attachments',
  use_cases: ['attachments', 'query', 'file-management'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      table_name: { type: 'string', description: 'Table name' },
      table_sys_id: { type: 'string', description: 'Record sys_id' }
    },
    required: ['table_name', 'table_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table_name, table_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get('/api/now/attachment', {
      params: {
        sysparm_query: `table_name=${table_name}^table_sys_id=${table_sys_id}`
      }
    });
    return createSuccessResult({
      attachments: response.data.result,
      count: response.data.result.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
