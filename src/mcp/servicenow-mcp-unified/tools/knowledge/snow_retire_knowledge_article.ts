/**
 * snow_retire_knowledge_article - Retire article
 *
 * Retires a knowledge article, making it unavailable for general use while preserving history.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_retire_knowledge_article',
  description: 'Retires a knowledge article, making it unavailable for general use while preserving history.',
  inputSchema: {
    type: 'object',
    properties: {
      sys_id: { type: 'string', description: 'Article sys_id to retire' },
      retirement_reason: { type: 'string', description: 'Reason for retirement' },
      replacement_article: { type: 'string', description: 'Replacement article sys_id (optional)' }
    },
    required: ['sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { sys_id, retirement_reason, replacement_article } = args;

  try {
    const client = await getAuthenticatedClient(context);

    const updateData: any = {
      workflow_state: 'retired',
      retirement_date: new Date().toISOString()
    };

    if (retirement_reason) updateData.retirement_reason = retirement_reason;
    if (replacement_article) updateData.replacement_article = replacement_article;

    const response = await client.patch(`/api/now/table/kb_knowledge/${sys_id}`, updateData);

    return createSuccessResult(
      {
        retired: true,
        article: response.data.result,
        sys_id
      },
      {
        operation: 'retire_article',
        reason: retirement_reason
      }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
