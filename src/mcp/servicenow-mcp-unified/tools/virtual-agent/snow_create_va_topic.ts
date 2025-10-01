/**
 * snow_create_va_topic - Create Virtual Agent topic
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_va_topic',
  description: 'Create Virtual Agent conversation topic',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      utterances: { type: 'array', items: { type: 'string' } },
      response: { type: 'string' }
    },
    required: ['name', 'utterances']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, utterances, response } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const topicData: any = { name, utterances: utterances.join(',') };
    if (response) topicData.response = response;
    const resp = await client.post('/api/now/table/topic', topicData);
    return createSuccessResult({ created: true, topic: resp.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
