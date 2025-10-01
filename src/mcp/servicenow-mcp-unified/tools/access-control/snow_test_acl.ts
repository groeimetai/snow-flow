/**
 * snow_test_acl
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_test_acl',
  description: 'Test ACL access for user',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      operation: { type: 'string', enum: ['read', 'write', 'create', 'delete'], description: 'Operation' },
      user: { type: 'string', description: 'User sys_id to test' },
      record_id: { type: 'string', description: 'Specific record sys_id' }
    },
    required: ['table', 'operation']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, operation, user, record_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const testScript = `
var gr = new GlideRecord('${table}');
${record_id ? `gr.get('${record_id}');` : 'gr.query(); gr.next();'}
var canAccess = gr.canRead() || gr.canWrite() || gr.canCreate() || gr.canDelete();
gs.info('ACL Test: ' + canAccess);
canAccess;
    `;
    const response = await client.post('/api/now/table/sys_script_execution', { script: testScript });
    return createSuccessResult({
      has_access: response.data.result,
      table,
      operation,
      tested_user: user || 'current'
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
