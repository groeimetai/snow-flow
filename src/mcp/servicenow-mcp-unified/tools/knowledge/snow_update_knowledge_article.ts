/**
 * snow_update_knowledge_article - Update article
 *
 * Updates an existing knowledge article. Can modify content, metadata, or workflow state.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_knowledge_article',
  description: 'Updates an existing knowledge article. Can modify content, metadata, or workflow state.',
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: { type: 'string', description: 'Article sys_id to update' },
      short_description: { type: 'string', description: 'Updated title' },
      text: { type: 'string', description: 'Updated content' },
      workflow_state: { type: 'string', description: 'New state' },
      valid_to: { type: 'string', description: 'New expiration date' },
      meta_description: { type: 'string', description: 'Updated SEO description' },
      keywords: { type: 'array', items: { type: 'string' }, description: 'Updated keywords' }
    },
    required: ['sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    sys_id,
    short_description,
    text,
    workflow_state,
    valid_to,
    meta_description,
    keywords
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    const updateData: any = {};
    if (short_description) updateData.short_description = short_description;
    if (text) updateData.text = text;
    if (workflow_state) updateData.workflow_state = workflow_state;
    if (valid_to) updateData.valid_to = valid_to;
    if (meta_description) updateData.meta_description = meta_description;
    if (keywords) updateData.keywords = keywords.join(',');

    const response = await client.patch(`/api/now/table/kb_knowledge/${sys_id}`, updateData);

    return createSuccessResult(
      {
        updated: true,
        article: response.data.result,
        sys_id
      },
      {
        operation: 'update_article',
        fields_updated: Object.keys(updateData)
      }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
