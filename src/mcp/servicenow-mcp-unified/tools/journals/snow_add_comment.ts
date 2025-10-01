/**
 * snow_add_comment
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_add_comment',
  description: 'Add comment/work note to record',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      record_sys_id: { type: 'string', description: 'Record sys_id' },
      comment: { type: 'string', description: 'Comment text' },
      work_note: { type: 'boolean', default: false, description: 'Is work note (internal)' }
    },
    required: ['table', 'record_sys_id', 'comment']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, record_sys_id, comment, work_note = false } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const field = work_note ? 'work_notes' : 'comments';
    const updateData = { [field]: comment };
    const response = await client.patch(`/api/now/table/${table}/${record_sys_id}`, updateData);
    return createSuccessResult({ added: true, type: work_note ? 'work_note' : 'comment' });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
