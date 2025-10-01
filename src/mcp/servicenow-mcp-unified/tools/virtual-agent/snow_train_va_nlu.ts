/**
 * snow_train_va_nlu - Train Virtual Agent NLU
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_train_va_nlu',
  description: 'Train Virtual Agent NLU model',
  inputSchema: {
    type: 'object',
    properties: {
      model_id: { type: 'string' }
    },
    required: ['model_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { model_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.post(`/api/now/v1/va/models/${model_id}/train`, {});
    return createSuccessResult({ training_started: true, model: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
