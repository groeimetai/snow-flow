/**
 * snow_discover_pa_indicators - Discover PA indicators
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_pa_indicators',
  description: 'Discovers available Performance Analytics indicators and their configurations',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Filter by table' },
      active_only: { type: 'boolean', description: 'Show only active indicators', default: true }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, active_only } = args;
  try {
    const client = await getAuthenticatedClient(context);
    let query = '';
    if (table) query = `facts_table=${table}`;
    if (active_only !== false) {
      query += query ? '^' : '';
      query += 'active=true';
    }

    const response = await client.get('/api/now/table/pa_indicators', {
      params: {
        sysparm_query: query || '',
        sysparm_limit: 50
      }
    });

    return createSuccessResult({
      indicators: response.data.result,
      count: response.data.result.length,
      message: `Found ${response.data.result.length} PA indicators`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
