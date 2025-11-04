/**
 * snow_query_requests - Query service requests
 *
 * Queries service requests with optional inclusion of request items and fulfillment details.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_query_requests',
  description: 'Queries service requests with optional inclusion of request items and fulfillment details',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'operations',
  use_cases: ['requests', 'query'],
  complexity: 'intermediate',
  frequency: 'high',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: READ - Query operation - only reads data
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'ServiceNow encoded query or natural language (e.g., "open", "active=true", "pending approval")'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10,
        minimum: 1,
        maximum: 100
      },
      include_items: {
        type: 'boolean',
        description: 'Include request items (REQITEMs) for each request',
        default: false
      }
    },
    required: ['query']
  }
};

function processNaturalLanguageQuery(query: string): string {
  const lowerQuery = query.toLowerCase();

  // If already a ServiceNow encoded query, return as-is
  if (query.includes('=') || query.includes('!=') || query.includes('^') || query.includes('LIKE')) {
    return query;
  }

  // Common patterns
  if (lowerQuery.includes('open') || lowerQuery.includes('active')) return 'active=true^request_state!=closed';
  if (lowerQuery.includes('closed') || lowerQuery.includes('complete')) return 'request_state=closed';
  if (lowerQuery.includes('pending approval')) return 'approval=requested';
  if (lowerQuery.includes('approved')) return 'approval=approved';
  if (lowerQuery.includes('all') || lowerQuery === '') return '';

  // Default: search in short_description
  return `short_descriptionLIKE${query}`;
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { query, limit = 10, include_items = false } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Process query
    const processedQuery = processNaturalLanguageQuery(query);

    // Query service requests
    const response = await client.get('/api/now/table/sc_request', {
      params: {
        sysparm_query: processedQuery,
        sysparm_limit: limit
      }
    });

    const requests = response.data.result || [];

    let result: any = {
      total_results: requests.length,
      query_used: processedQuery,
      requests: requests.map((req: any) => ({
        number: req.number,
        sys_id: req.sys_id,
        short_description: req.short_description,
        request_state: req.request_state,
        approval: req.approval,
        requested_for: req.requested_for,
        requested_by: req.requested_by
      }))
    };

    // Include request items if requested
    if (include_items && requests.length > 0) {
      const requestItems = [];

      for (const request of requests) {
        const itemResponse = await client.get('/api/now/table/sc_req_item', {
          params: {
            sysparm_query: `request=${request.sys_id}`,
            sysparm_limit: 10
          }
        });

        if (itemResponse.data.result && itemResponse.data.result.length > 0) {
          requestItems.push({
            request_number: request.number,
            item_count: itemResponse.data.result.length,
            items: itemResponse.data.result.map((item: any) => ({
              number: item.number,
              short_description: item.short_description,
              state: item.state,
              cat_item: item.cat_item
            }))
          });
        }
      }

      result.request_items = requestItems;
    }

    return createSuccessResult(
      result,
      { query: processedQuery, limit, count: requests.length }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
