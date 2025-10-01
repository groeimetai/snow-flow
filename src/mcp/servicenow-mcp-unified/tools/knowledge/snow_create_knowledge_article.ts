/**
 * snow_create_knowledge_article - Create knowledge article
 *
 * Creates a knowledge article in ServiceNow Knowledge Base with full support for
 * knowledge base references, categories, metadata, and workflow states.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_knowledge_article',
  description: 'Creates a knowledge article in ServiceNow Knowledge Base. Articles can contain solutions, how-to guides, or reference information.',
  inputSchema: {
    type: 'object',
    properties: {
      short_description: { type: 'string', description: 'Article title' },
      text: { type: 'string', description: 'Article content (HTML supported)' },
      kb_knowledge_base: { type: 'string', description: 'Knowledge base sys_id or name' },
      kb_category: { type: 'string', description: 'Category sys_id or name' },
      article_type: { type: 'string', description: 'Type: text, html, wiki' },
      workflow_state: { type: 'string', description: 'State: draft, review, published, retired' },
      valid_to: { type: 'string', description: 'Expiration date (YYYY-MM-DD)' },
      meta_description: { type: 'string', description: 'SEO meta description' },
      keywords: { type: 'array', items: { type: 'string' }, description: 'Search keywords' },
      author: { type: 'string', description: 'Author user sys_id or username' }
    },
    required: ['short_description', 'text']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    short_description,
    text,
    kb_knowledge_base,
    kb_category,
    article_type = 'text',
    workflow_state = 'draft',
    valid_to,
    meta_description,
    keywords,
    author
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build article data
    const articleData: any = {
      short_description,
      text,
      article_type,
      workflow_state
    };

    if (kb_knowledge_base) articleData.kb_knowledge_base = kb_knowledge_base;
    if (kb_category) articleData.kb_category = kb_category;
    if (valid_to) articleData.valid_to = valid_to;
    if (meta_description) articleData.meta_description = meta_description;
    if (keywords) articleData.keywords = keywords.join(',');
    if (author) articleData.author = author;

    const response = await client.post('/api/now/table/kb_knowledge', articleData);

    return createSuccessResult(
      {
        created: true,
        article: response.data.result,
        sys_id: response.data.result.sys_id,
        number: response.data.result.number
      },
      {
        operation: 'create_knowledge_article',
        title: short_description,
        state: workflow_state
      }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
