/**
 * snow_discover_report_fields - Discover report fields
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_report_fields',
  description: 'Retrieves reportable fields from tables with type filtering and metadata',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name to analyze' },
      fieldType: { type: 'string', description: 'Filter by field type' }
    },
    required: ['table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, fieldType } = args;
  try {
    const client = await getAuthenticatedClient(context);
    let query = `name=${table}^element!=NULL`;
    if (fieldType) query += `^internal_type=${fieldType}`;

    const response = await client.get('/api/now/table/sys_dictionary', {
      params: {
        sysparm_query: query,
        sysparm_limit: 100
      }
    });

    return createSuccessResult({
      fields: response.data.result,
      count: response.data.result.length,
      table,
      message: `Found ${response.data.result.length} reportable fields for ${table}`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
