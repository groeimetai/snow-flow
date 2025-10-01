/**
 * snow_discover_uib_components - Browse components
 *
 * Discovers and browses ServiceNow built-in and custom UI Builder
 * components available for use.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_uib_components',
  description: 'Browse ServiceNow built-in and custom UI Builder components',
  inputSchema: {
    type: 'object',
    properties: {
      category: {
        type: 'string',
        description: 'Filter by category (e.g., "forms", "lists", "custom")'
      },
      search: {
        type: 'string',
        description: 'Search component names and labels'
      },
      include_custom: {
        type: 'boolean',
        description: 'Include custom components',
        default: true
      },
      include_builtin: {
        type: 'boolean',
        description: 'Include built-in components',
        default: true
      },
      limit: {
        type: 'number',
        description: 'Maximum components to return',
        default: 100
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    category,
    search,
    include_custom = true,
    include_builtin = true,
    limit = 100
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build query
    const queryParts: string[] = [];
    if (category) queryParts.push(`category=${category}`);
    if (search) queryParts.push(`nameLIKE${search}^ORlabelLIKE${search}`);

    const query = queryParts.length > 0 ? queryParts.join('^') : '';

    const response = await client.get('/api/now/table/sys_ux_lib_component', {
      params: {
        sysparm_query: query,
        sysparm_limit: limit
      }
    });

    const components = response.data.result.map((comp: any) => ({
      sys_id: comp.sys_id,
      name: comp.name,
      label: comp.label,
      category: comp.category,
      description: comp.description,
      version: comp.version,
      is_custom: comp.category === 'custom'
    }));

    // Filter by type
    const filteredComponents = components.filter((comp: any) => {
      if (!include_custom && comp.is_custom) return false;
      if (!include_builtin && !comp.is_custom) return false;
      return true;
    });

    return createSuccessResult({
      components: filteredComponents,
      total: filteredComponents.length
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
