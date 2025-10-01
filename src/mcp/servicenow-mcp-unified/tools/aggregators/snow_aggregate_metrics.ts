/**
 * snow_aggregate_metrics
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_aggregate_metrics',
  description: 'Aggregate table metrics',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      field: { type: 'string', description: 'Field to aggregate' },
      aggregation: { type: 'string', enum: ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX'], default: 'COUNT' },
      group_by: { type: 'string', description: 'Field to group by' }
    },
    required: ['table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, field, aggregation = 'COUNT', group_by } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const params: any = {
      sysparm_query: '',
      sysparm_count: aggregation === 'COUNT'
    };
    if (group_by) params.sysparm_group_by = group_by;

    const response = await client.get(`/api/now/stats/${table}`, { params });
    return createSuccessResult({
      aggregated: true,
      table,
      aggregation,
      result: response.data.result
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
