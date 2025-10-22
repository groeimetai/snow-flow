/**
 * snow_autocomplete
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_autocomplete',
  description: 'Get autocomplete suggestions',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'utilities',
  use_cases: ['autocomplete', 'search', 'ux'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      field: { type: 'string', description: 'Field name' },
      query: { type: 'string', description: 'Search query' },
      limit: { type: 'number', default: 10 }
    },
    required: ['table', 'field', 'query']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, field, query, limit = 10 } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get(`/api/now/table/${table}`, {
      params: {
        sysparm_query: `${field}LIKE${query}`,
        sysparm_fields: field,
        sysparm_limit: limit
      }
    });

    const suggestions = response.data.result.map((r: any) => r[field]);

    return createSuccessResult({
      suggestions,
      count: suggestions.length,
      query
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
