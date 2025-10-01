/**
 * snow_create_change - Create change request
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_change',
  description: 'Create change request',
  inputSchema: {
    type: 'object',
    properties: {
      short_description: { type: 'string' },
      description: { type: 'string' },
      type: { type: 'string', enum: ['standard', 'normal', 'emergency'] },
      risk: { type: 'string', enum: ['high', 'medium', 'low'] },
      impact: { type: 'number', enum: [1, 2, 3] }
    },
    required: ['short_description', 'type']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { short_description, description, type, risk, impact } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const changeData: any = { short_description, type };
    if (description) changeData.description = description;
    if (risk) changeData.risk = risk;
    if (impact) changeData.impact = impact;
    const response = await client.post('/api/now/table/change_request', changeData);
    return createSuccessResult({ created: true, change: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
