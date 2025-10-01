/**
 * snow_data_export
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_data_export',
  description: 'Export table data to CSV/XML/JSON',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      query: { type: 'string', description: 'Query filter' },
      fields: { type: 'array', items: { type: 'string' }, description: 'Fields to export' },
      format: { type: 'string', enum: ['csv', 'xml', 'json'], default: 'json' },
      limit: { type: 'number', default: 1000 }
    },
    required: ['table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, query, fields, format = 'json', limit = 1000 } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const params: any = { sysparm_limit: limit };
    if (query) params.sysparm_query = query;
    if (fields) params.sysparm_fields = fields.join(',');

    const response = await client.get(`/api/now/table/${table}`, { params });

    return createSuccessResult({
      data: response.data.result,
      format,
      count: response.data.result.length,
      table
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
