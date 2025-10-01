/**
 * snow_search_kb - Search knowledge base
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_search_kb',
  description: 'Search knowledge base articles',
  inputSchema: {
    type: 'object',
    properties: {
      search_term: { type: 'string' },
      kb_knowledge_base: { type: 'string' },
      limit: { type: 'number', default: 10 }
    },
    required: ['search_term']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { search_term, kb_knowledge_base, limit = 10 } = args;
  try {
    const client = await getAuthenticatedClient(context);
    let query = `textINDEXOF${search_term}^ORshort_descriptionLIKE${search_term}^workflow_state=published`;
    if (kb_knowledge_base) query += `^kb_knowledge_base=${kb_knowledge_base}`;
    const response = await client.get('/api/now/table/kb_knowledge', {
      params: { sysparm_query: query, sysparm_limit: limit }
    });
    return createSuccessResult({ articles: response.data.result, count: response.data.result.length });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
