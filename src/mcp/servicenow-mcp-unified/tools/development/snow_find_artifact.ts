/**
 * snow_find_artifact - Find ServiceNow artifacts using natural language
 *
 * Searches cached memory first for performance, then queries ServiceNow directly if needed.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_find_artifact',
  description: 'Finds ServiceNow artifacts using natural language queries. Searches cached memory first for performance, then queries ServiceNow directly if needed.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'search',
  use_cases: ['search', 'discovery', 'natural-language'],
  complexity: 'beginner',
  frequency: 'high',

  // Permission enforcement
  // Classification: READ - Read-only operation based on name pattern
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language query (e.g., "the widget that shows incidents on homepage")'
      },
      type: {
        type: 'string',
        enum: ['widget', 'flow', 'script', 'application', 'any'],
        description: 'Artifact type filter'
      }
    },
    required: ['query']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { query, type = 'any' } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Determine table based on type
    const tableMapping: Record<string, string> = {
      widget: 'sp_widget',
      flow: 'sys_hub_flow',
      script: 'sys_script_include',
      application: 'sys_app_application'
    };

    const table = type !== 'any' ? tableMapping[type] : null;

    // Search ServiceNow
    let results: any[] = [];

    if (table) {
      // Search specific table
      const response = await client.query(table, {
        query: `nameLIKE${query}^ORshort_descriptionLIKE${query}`,
        limit: 10
      });
      results = response.data?.result || [];
    } else {
      // Search across common tables
      const commonTables = ['sp_widget', 'sys_hub_flow', 'sys_script_include', 'sys_app_application'];
      for (const tbl of commonTables) {
        const response = await client.query(tbl, {
          query: `nameLIKE${query}`,
          limit: 5
        });
        if (response.data?.result) {
          results.push(...response.data.result.map((r: any) => ({ ...r, _table: tbl })));
        }
      }
    }

    return createSuccessResult({
      found: results.length > 0,
      count: results.length,
      results: results.map(r => ({
        sys_id: r.sys_id,
        name: r.name,
        title: r.title || r.name,
        table: r._table || table,
        description: r.short_description,
        active: r.active
      }))
    }, {
      query,
      type,
      table: table || 'multiple'
    });

  } catch (error) {
    return createErrorResult(error, {
      query,
      type
    });
  }
}
