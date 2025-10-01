/**
 * snow_publish_kb_article - Publish KB article
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_publish_kb_article',
  description: 'Publish knowledge base article',
  inputSchema: {
    type: 'object',
    properties: {
      article_sys_id: { type: 'string' }
    },
    required: ['article_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { article_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.put(`/api/now/table/kb_knowledge/${article_sys_id}`, {
      workflow_state: 'published'
    });
    return createSuccessResult({ published: true, article: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
