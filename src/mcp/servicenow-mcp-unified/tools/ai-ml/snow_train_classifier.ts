/**
 * snow_train_classifier - Train ML classifier
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_train_classifier',
  description: 'Train machine learning classifier',
  inputSchema: {
    type: 'object',
    properties: {
      model_name: { type: 'string' },
      training_data: { type: 'string' },
      algorithm: { type: 'string' }
    },
    required: ['model_name', 'training_data']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { model_name, training_data, algorithm = 'decision_tree' } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const mlData = { name: model_name, training_data, algorithm };
    const response = await client.post('/api/now/v1/ml/train', mlData);
    return createSuccessResult({ training_started: true, model: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
