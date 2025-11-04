/**
 * snow_discover_platform_tables - Platform table discovery
 *
 * Discover platform development tables categorized by type
 * (UI, script, policy, security, system).
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_platform_tables',
  description: 'Discover platform development tables by category (ui, script, policy, action)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'discovery',
  use_cases: ['table-discovery', 'schema-exploration', 'platform-development'],
  complexity: 'intermediate',
  frequency: 'medium',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: READ - Discovery operation - reads metadata
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        enum: ['all', 'ui', 'script', 'policy', 'action', 'security', 'system'],
        description: 'Filter by table category',
        default: 'all'
      },
      limit: {
        type: 'number',
        description: 'Maximum results per category',
        default: 50
      }
    }
  }
};

interface TableCategory {
  category: string;
  query: string;
  description: string;
}

const TABLE_CATEGORIES: TableCategory[] = [
  {
    category: 'ui',
    query: 'nameSTARTSWITHsys_ui^ORnameSTARTSWITHsp_',
    description: 'UI pages, forms, lists, and portal widgets'
  },
  {
    category: 'script',
    query: 'nameSTARTSWITHsys_script^ORname=sys_script_include',
    description: 'Scripts, script includes, and processors'
  },
  {
    category: 'policy',
    query: 'name=sys_ui_policy^ORname=sys_data_policy',
    description: 'UI policies and data policies'
  },
  {
    category: 'action',
    query: 'name=sys_ui_action^ORname=sys_ui_context_menu',
    description: 'UI actions and context menus'
  },
  {
    category: 'security',
    query: 'nameSTARTSWITHsys_security^ORname=sys_user_role',
    description: 'Security policies and roles'
  },
  {
    category: 'system',
    query: 'name=sys_dictionary^ORname=sys_db_object^ORname=sys_choice',
    description: 'System tables for schema and data'
  }
];

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    category = 'all',
    limit = 50
  } = args;

  try {
    const client = await getAuthenticatedClient(context);
    const discoveredTables: any[] = [];

    const categoriesToQuery = category === 'all'
      ? TABLE_CATEGORIES
      : TABLE_CATEGORIES.filter(cat => cat.category === category);

    for (const cat of categoriesToQuery) {
      const response = await client.get('/api/now/table/sys_db_object', {
        params: {
          sysparm_query: cat.query,
          sysparm_limit: limit,
          sysparm_fields: 'sys_id,name,label,super_class,is_extendable,extension_model'
        }
      });

      if (response.data.result && response.data.result.length > 0) {
        discoveredTables.push({
          category: cat.category,
          description: cat.description,
          count: response.data.result.length,
          tables: response.data.result.map((table: any) => ({
            name: table.name,
            label: table.label,
            super_class: table.super_class,
            is_extendable: table.is_extendable === 'true',
            extension_model: table.extension_model,
            sys_id: table.sys_id
          }))
        });
      }
    }

    const totalTables = discoveredTables.reduce((sum, cat) => sum + cat.count, 0);

    return createSuccessResult({
      discovered: true,
      platform_tables: discoveredTables,
      summary: {
        total_tables: totalTables,
        categories_found: discoveredTables.length,
        filter_applied: category
      },
      message: `Discovered ${totalTables} platform development tables across ${discoveredTables.length} categories`
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
