/**
 * snow_create_kb_article - Create knowledge article
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_kb_article',
  description: 'Create knowledge base article',
  inputSchema: {
    type: 'object',
    properties: {
      short_description: { type: 'string' },
      text: { type: 'string' },
      kb_knowledge_base: { type: 'string' },
      kb_category: { type: 'string' },
      workflow_state: { type: 'string', default: 'draft' }
    },
    required: ['short_description', 'text']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { short_description, text, kb_knowledge_base, kb_category, workflow_state = 'draft' } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const articleData: any = { short_description, text, workflow_state };
    if (kb_knowledge_base) articleData.kb_knowledge_base = kb_knowledge_base;
    if (kb_category) articleData.kb_category = kb_category;
    const response = await client.post('/api/now/table/kb_knowledge', articleData);
    return createSuccessResult({ created: true, article: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
