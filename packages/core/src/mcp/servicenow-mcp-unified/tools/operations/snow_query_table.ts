/**
 * snow_query_table - Universal table querying
 *
 * Query any ServiceNow table with pagination, filtering, and field selection.
 * The most frequently used tool in Snow-Flow.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

// Fields that typically contain large content and should be truncated
const LARGE_CONTENT_FIELDS = [
  'template', 'script', 'server_script', 'client_script', 'css', 'html',
  'xml', 'json', 'payload', 'body', 'content', 'description', 'comments',
  'work_notes', 'additional_comments', 'close_notes', 'resolution_notes',
  'instructions', 'short_description', 'long_description'
];

// Maximum length for field values before truncation
const MAX_FIELD_LENGTH = 200;

/**
 * Truncate large field values in records for cleaner output
 */
function truncateRecords(records: any[], truncate: boolean): any[] {
  if (!truncate) return records;

  return records.map(record => {
    const truncated: any = {};
    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string' && value.length > MAX_FIELD_LENGTH) {
        // Check if it's a known large content field or just a long string
        const isLargeField = LARGE_CONTENT_FIELDS.some(f => key.toLowerCase().includes(f));
        if (isLargeField || value.length > MAX_FIELD_LENGTH * 2) {
          truncated[key] = value.substring(0, MAX_FIELD_LENGTH) + `... [truncated, ${value.length} chars total]`;
        } else {
          truncated[key] = value;
        }
      } else {
        truncated[key] = value;
      }
    }
    return truncated;
  });
}

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_query_table',
  description: 'Query any ServiceNow table with filtering, pagination, and field selection',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'crud',
  use_cases: ['query', 'read', 'records'],
  complexity: 'beginner',
  frequency: 'high',

  // Permission enforcement
  // Classification: READ - only queries data, no modifications
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],

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
      },
      truncate_output: {
        type: 'boolean',
        description: 'Truncate large field values (scripts, templates, etc.) for cleaner output',
        default: true
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
    display_value = false,
    truncate_output = true
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

    const rawRecords = response.data.result;
    const records = truncateRecords(rawRecords, truncate_output);

    return createSuccessResult(
      {
        records,
        count: records.length,
        total: records.length < limit ? records.length : '100+', // Actual total requires additional query
        has_more: records.length === limit,
        truncated: truncate_output
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
