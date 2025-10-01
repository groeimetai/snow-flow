/**
 * snow_search_knowledge - Search knowledge articles
 *
 * Searches knowledge articles using keywords, categories, or filters.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_search_knowledge',
  description: 'Searches knowledge articles using keywords, categories, or filters. Returns relevant articles with snippets.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query text' },
      kb_knowledge_base: { type: 'string', description: 'Filter by knowledge base' },
      kb_category: { type: 'string', description: 'Filter by category' },
      workflow_state: { type: 'string', description: 'Filter by state (published, draft, etc.)' },
      limit: { type: 'number', description: 'Maximum results to return', default: 10 },
      include_content: { type: 'boolean', description: 'Include full article content', default: false }
    },
    required: ['query']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    query,
    kb_knowledge_base,
    kb_category,
    workflow_state = 'published',
    limit = 10,
    include_content = false
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build query string
    let queryString = `short_descriptionLIKE${query}^ORtextLIKE${query}`;

    if (kb_knowledge_base) {
      queryString += `^kb_knowledge_base=${kb_knowledge_base}`;
    }
    if (kb_category) {
      queryString += `^kb_category=${kb_category}`;
    }
    if (workflow_state) {
      queryString += `^workflow_state=${workflow_state}`;
    }

    const response = await client.get('/api/now/table/kb_knowledge', {
      params: {
        sysparm_query: queryString,
        sysparm_limit: limit
      }
    });

    const articles = response.data.result;

    return createSuccessResult(
      {
        articles,
        count: articles.length,
        query_used: queryString
      },
      {
        operation: 'search_knowledge',
        query,
        results: articles.length
      }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
