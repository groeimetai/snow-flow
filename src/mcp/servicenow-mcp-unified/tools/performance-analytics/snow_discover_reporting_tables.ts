/**
 * snow_discover_reporting_tables - Discover reporting tables
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_reporting_tables',
  description: 'Discovers tables available for reporting with filtering by category and data availability',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Table category filter' },
      hasData: { type: 'boolean', description: 'Only tables with data' }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { category, hasData } = args;
  try {
    const client = await getAuthenticatedClient(context);
    let query = '';
    if (category) query = `sys_class_name=${category}`;

    const response = await client.get('/api/now/table/sys_db_object', {
      params: {
        sysparm_query: query || '',
        sysparm_limit: 100
      }
    });

    return createSuccessResult({
      tables: response.data.result,
      count: response.data.result.length,
      message: `Found ${response.data.result.length} reporting tables`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
