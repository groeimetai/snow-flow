/**
 * snow_query_table - Universal table querying
 *
 * Query any ServiceNow table with pagination, filtering, and field selection.
 * The most frequently used tool in Snow-Flow.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_query_table',
  description: 'Query any ServiceNow table with filtering, pagination, and field selection',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'crud',
  use_cases: ['query', 'read', 'records'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'Table name to query (e.g., incident, task, sys_user)'
      },
      query: {
        type: 'string',
        description: 'Encoded query string (e.g., active=true^priority=1)'
      },
      fields: {
        type: 'array',
        items: { type: 'string' },
        description: 'Fields to return (default: all fields)',
        default: []
      },
      limit: {
        type: 'number',
        description: 'Maximum number of records to return',
        default: 100,
        minimum: 1,
        maximum: 10000
      },
      offset: {
        type: 'number',
        description: 'Number of records to skip (for pagination)',
        default: 0,
        minimum: 0
      },
      order_by: {
        type: 'string',
        description: 'Field to order by (prefix with - for descending, e.g., -sys_created_on)'
      },
      display_value: {
        type: 'boolean',
        description: 'Return display values instead of sys_ids for reference fields',
        default: false
      }
    },
    required: ['table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    table,
    query = '',
    fields = [],
    limit = 100,
    offset = 0,
    order_by,
    display_value = false
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build query parameters
    const params: any = {
      sysparm_limit: limit,
      sysparm_offset: offset
    };

    if (query) {
      params.sysparm_query = query;
    }

    if (fields.length > 0) {
      params.sysparm_fields = fields.join(',');
    }

    if (order_by) {
      // Handle descending order (prefix with -)
      const direction = order_by.startsWith('-') ? 'DESC' : 'ASC';
      const field = order_by.replace(/^-/, '');
      params.sysparm_query = (params.sysparm_query || '') + `^ORDERBY${direction}${field}`;
    }

    if (display_value) {
      params.sysparm_display_value = 'true';
    }

    // Execute query
    const response = await client.get(`/api/now/table/${table}`, { params });

    const records = response.data.result;

    return createSuccessResult(
      {
        records,
        count: records.length,
        total: records.length < limit ? records.length : '100+', // Actual total requires additional query
        has_more: records.length === limit
      },
      {
        table,
        query,
        limit,
        offset
      }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
