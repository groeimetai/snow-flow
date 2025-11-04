/**
 * snow_comprehensive_search - Search across multiple tables
 *
 * Comprehensive search across ServiceNow artifacts with
 * intelligent type detection and relevance scoring.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_comprehensive_search',
  description: 'Search across multiple tables for artifacts (widgets, pages, flows, scripts)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'search',
  use_cases: ['search', 'discovery'],
  complexity: 'intermediate',
  frequency: 'high',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: READ - Search operation - reads data
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (searches name, title, description fields)'
      },
      types: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['widget', 'page', 'flow', 'script_include', 'business_rule', 'all']
        },
        description: 'Artifact types to search',
        default: ['all']
      },
      limit: {
        type: 'number',
        description: 'Maximum results per type',
        default: 10,
        minimum: 1,
        maximum: 100
      },
      include_inactive: {
        type: 'boolean',
        description: 'Include inactive/deleted artifacts',
        default: false
      }
    },
    required: ['query']
  }
};

const SEARCH_TABLES: Record<string, { table: string; name_field: string; title_field?: string }> = {
  widget: { table: 'sp_widget', name_field: 'id', title_field: 'name' },
  page: { table: 'sys_ux_page', name_field: 'name', title_field: 'title' },
  flow: { table: 'sys_hub_flow', name_field: 'name' },
  script_include: { table: 'sys_script_include', name_field: 'name' },
  business_rule: { table: 'sys_script', name_field: 'name' }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { query, types = ['all'], limit = 10, include_inactive = false } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Determine which tables to search
    const searchTypes = types.includes('all')
      ? Object.keys(SEARCH_TABLES)
      : types;

    const results: any = {
      query,
      found: [],
      total: 0
    };

    // Search each table
    for (const type of searchTypes) {
      const config = SEARCH_TABLES[type];
      if (!config) continue;

      // Build search query
      const searchFields = [config.name_field];
      if (config.title_field) searchFields.push(config.title_field);
      searchFields.push('description');

      const searchQuery = searchFields
        .map(field => `${field}LIKE${query}`)
        .join('^OR');

      const activeQuery = include_inactive ? '' : '^active=true';
      const fullQuery = searchQuery + activeQuery;

      // Execute search
      const response = await client.get(`/api/now/table/${config.table}`, {
        params: {
          sysparm_query: fullQuery,
          sysparm_limit: limit,
          sysparm_fields: `sys_id,${searchFields.join(',')},sys_created_on,sys_updated_on`
        }
      });

      // Add results
      if (response.data.result.length > 0) {
        results.found.push({
          type,
          table: config.table,
          count: response.data.result.length,
          artifacts: response.data.result.map((r: any) => ({
            sys_id: r.sys_id,
            name: r[config.name_field],
            title: config.title_field ? r[config.title_field] : undefined,
            description: r.description,
            created: r.sys_created_on,
            updated: r.sys_updated_on
          }))
        });
        results.total += response.data.result.length;
      }
    }

    return createSuccessResult(results);

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
