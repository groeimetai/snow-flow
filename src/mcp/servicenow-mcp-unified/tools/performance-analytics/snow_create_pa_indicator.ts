/**
 * snow_create_pa_indicator
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_pa_indicator',
  description: 'Create PA indicator',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      table: { type: 'string' },
      field: { type: 'string' },
      aggregate: { type: 'string', enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'] }
    },
    required: ['name', 'table', 'field', 'aggregate']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, field, aggregate } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const indicatorData = { name, table, field, aggregate };
    const response = await client.post('/api/now/table/pa_indicators', indicatorData);
    return createSuccessResult({ created: true, indicator: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
