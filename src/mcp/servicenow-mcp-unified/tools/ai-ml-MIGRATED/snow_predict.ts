/**
 * snow_predict - ML prediction
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_predict',
  description: 'Make ML prediction',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'machine-learning',
  use_cases: ['ml-prediction', 'ai', 'predictive-analytics'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: READ - Query/analysis operation
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      model_id: { type: 'string' },
      input_data: { type: 'object' }
    },
    required: ['model_id', 'input_data']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { model_id, input_data } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.post(`/api/now/v1/ml/predict/${model_id}`, input_data);
    return createSuccessResult({ prediction: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
