/**
 * snow_create_kpi - Create KPI definitions
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_kpi',
  description: 'Creates KPIs calculated from LIVE ServiceNow data',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'KPI name' },
      description: { type: 'string', description: 'KPI description' },
      table: { type: 'string', description: 'Source table' },
      metric: { type: 'string', description: 'Metric to measure' },
      aggregation: { type: 'string', description: 'Aggregation function (count, sum, avg, max, min)' },
      conditions: { type: 'string', description: 'KPI conditions/filters' },
      target: { type: 'number', description: 'Target value' },
      threshold: { type: 'object', description: 'Threshold configuration' },
      unit: { type: 'string', description: 'Unit of measurement' },
      frequency: { type: 'string', description: 'Update frequency' }
    },
    required: ['name', 'table', 'metric', 'aggregation']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, description, table, metric, aggregation, conditions, target, threshold, unit, frequency } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const kpiData: any = {
      name,
      label: name,
      description: description || '',
      facts_table: table,
      aggregate: aggregation,
      field: metric,
      unit: unit || '',
      frequency: frequency || 'daily',
      active: true
    };
    if (conditions) kpiData.conditions = conditions;
    if (target) kpiData.target = target;
    if (threshold) kpiData.threshold = JSON.stringify(threshold);

    const response = await client.post('/api/now/table/pa_indicators', kpiData);
    return createSuccessResult({
      created: true,
      kpi: response.data.result,
      message: `KPI ${name} created successfully`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
