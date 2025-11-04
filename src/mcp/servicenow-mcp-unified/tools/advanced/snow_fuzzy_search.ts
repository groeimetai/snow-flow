/**
 * snow_fuzzy_search
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_fuzzy_search',
  description: 'Perform fuzzy search across tables',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'search',
  use_cases: ['fuzzy-search', 'text-search', 'search'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: READ - Search operation - reads data
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      tables: { type: 'array', items: { type: 'string' }, description: 'Tables to search' },
      threshold: { type: 'number', default: 0.7, description: 'Match threshold (0-1)' }
    },
    required: ['query', 'tables']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { query, tables, threshold = 0.7 } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const results: any[] = [];

    for (const table of tables) {
      const response = await client.get(`/api/now/table/${table}`, {
        params: {
          sysparm_query: `123TEXTQUERY321${query}`,
          sysparm_limit: 10
        }
      });
      results.push(...response.data.result);
    }

    return createSuccessResult({
      results,
      count: results.length,
      query,
      threshold
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
