/**
 * snow_create_pipeline - Create DevOps pipeline
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_pipeline',
  description: 'Create CI/CD pipeline',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      source_control: { type: 'string' },
      stages: { type: 'array', items: { type: 'object' } }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, source_control, stages = [] } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const pipelineData: any = { name };
    if (source_control) pipelineData.source_control = source_control;
    if (stages.length > 0) pipelineData.stages = JSON.stringify(stages);
    const response = await client.post('/api/now/table/cicd_pipeline', pipelineData);
    return createSuccessResult({ created: true, pipeline: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
