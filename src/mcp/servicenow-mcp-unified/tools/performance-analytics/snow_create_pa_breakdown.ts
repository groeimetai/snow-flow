/**
 * snow_create_pa_breakdown - Create PA breakdowns
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_pa_breakdown',
  description: 'Creates a breakdown source for Performance Analytics to segment data by dimensions',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Breakdown name' },
      table: { type: 'string', description: 'Table to breakdown' },
      field: { type: 'string', description: 'Field to group by' },
      related_field: { type: 'string', description: 'Related field path (for reference fields)' },
      matrix_source: { type: 'boolean', description: 'Is matrix breakdown', default: false }
    },
    required: ['name', 'table', 'field']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, field, related_field, matrix_source } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const breakdownData: any = {
      name,
      table,
      field,
      matrix_source: matrix_source || false
    };
    if (related_field) breakdownData.related_field = related_field;

    const response = await client.post('/api/now/table/pa_breakdowns', breakdownData);
    return createSuccessResult({
      created: true,
      breakdown: response.data.result,
      message: `PA breakdown ${name} created successfully`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
