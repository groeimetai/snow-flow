/**
 * snow_create_field
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_field',
  description: 'Create table field/column',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      column_name: { type: 'string', description: 'Field name' },
      column_label: { type: 'string', description: 'Field label' },
      internal_type: { type: 'string', description: 'Field type (string, integer, reference, etc.)' },
      reference: { type: 'string', description: 'Reference table (for reference fields)' },
      max_length: { type: 'number', description: 'Maximum length' },
      mandatory: { type: 'boolean', default: false }
    },
    required: ['table', 'column_name', 'internal_type']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, column_name, column_label, internal_type, reference, max_length, mandatory = false } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const fieldData: any = {
      name: table,
      element: column_name,
      column_label: column_label || column_name,
      internal_type,
      mandatory
    };
    if (reference) fieldData.reference = reference;
    if (max_length) fieldData.max_length = max_length;
    const response = await client.post('/api/now/table/sys_dictionary', fieldData);
    return createSuccessResult({ created: true, field: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
