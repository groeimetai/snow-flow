/**
 * snow_create_pa_threshold - Create PA thresholds
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_pa_threshold',
  description: 'Creates threshold rules for Performance Analytics indicators to trigger alerts',
  inputSchema: {
    type: 'object',
    properties: {
      indicator: { type: 'string', description: 'Indicator sys_id' },
      type: { type: 'string', description: 'Threshold type: warning, critical' },
      operator: { type: 'string', description: 'Operator: >, <, >=, <=, =' },
      value: { type: 'number', description: 'Threshold value' },
      duration: { type: 'number', description: 'Duration in periods before alert' },
      notification_group: { type: 'string', description: 'Group to notify' }
    },
    required: ['indicator', 'type', 'operator', 'value']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { indicator, type, operator, value, duration, notification_group } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const thresholdData: any = {
      indicator,
      type,
      operator,
      value,
      duration: duration || 1
    };
    if (notification_group) thresholdData.notification_group = notification_group;

    const response = await client.post('/api/now/table/pa_thresholds', thresholdData);
    return createSuccessResult({
      created: true,
      threshold: response.data.result,
      message: `PA threshold created for indicator ${indicator}`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
