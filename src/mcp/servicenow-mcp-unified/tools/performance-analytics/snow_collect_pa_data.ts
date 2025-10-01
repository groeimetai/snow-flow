/**
 * snow_collect_pa_data - Collect PA data manually
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_collect_pa_data',
  description: 'Manually triggers Performance Analytics data collection for specific indicators',
  inputSchema: {
    type: 'object',
    properties: {
      indicator: { type: 'string', description: 'Indicator to collect data for' },
      start_date: { type: 'string', description: 'Collection start date' },
      end_date: { type: 'string', description: 'Collection end date' },
      recalculate: { type: 'boolean', description: 'Recalculate existing data', default: false }
    },
    required: ['indicator']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { indicator, start_date, end_date, recalculate } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const jobData: any = {
      indicator,
      status: 'pending',
      recalculate: recalculate || false
    };
    if (start_date) jobData.start_date = start_date;
    if (end_date) jobData.end_date = end_date;

    const response = await client.post('/api/now/table/pa_collection_jobs', jobData);
    return createSuccessResult({
      collected: true,
      job: response.data.result,
      message: `PA data collection initiated for indicator ${indicator}`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
