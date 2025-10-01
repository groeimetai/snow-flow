/**
 * snow_collect_metric
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_collect_metric',
  description: 'Collect metric data',
  inputSchema: {
    type: 'object',
    properties: {
      metric_sys_id: { type: 'string', description: 'Metric definition sys_id' }
    },
    required: ['metric_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { metric_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const collectScript = `
var metric = new GlideRecord('metric_definition');
if (metric.get('${metric_sys_id}')) {
  var collector = new MetricBaseCollector();
  collector.collect(metric);
  gs.info('Metric collected: ' + metric.name);
}
    `;
    await client.post('/api/now/table/sys_script_execution', { script: collectScript });
    return createSuccessResult({ collected: true, metric: metric_sys_id });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
