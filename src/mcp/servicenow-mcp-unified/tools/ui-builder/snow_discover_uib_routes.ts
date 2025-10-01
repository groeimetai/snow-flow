/**
 * snow_discover_uib_routes - Find all routes
 *
 * Discovers all UI Builder page routes with security and
 * access control information.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_uib_routes',
  description: 'Find all UI Builder page routes with security information',
  inputSchema: {
    type: 'object',
    properties: {
      search: {
        type: 'string',
        description: 'Search route paths'
      },
      page_id: {
        type: 'string',
        description: 'Filter by page sys_id'
      },
      experience_id: {
        type: 'string',
        description: 'Filter by experience sys_id'
      },
      public_only: {
        type: 'boolean',
        description: 'Return only public routes',
        default: false
      },
      active_only: {
        type: 'boolean',
        description: 'Return only active routes',
        default: true
      },
      limit: {
        type: 'number',
        description: 'Maximum routes to return',
        default: 100
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    search,
    page_id,
    experience_id,
    public_only = false,
    active_only = true,
    limit = 100
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build query
    const queryParts: string[] = [];
    if (search) queryParts.push(`routeLIKE${search}`);
    if (page_id) queryParts.push(`page=${page_id}`);
    if (experience_id) queryParts.push(`experience=${experience_id}`);
    if (public_only) queryParts.push('public=true');
    if (active_only) queryParts.push('active=true');

    const query = queryParts.length > 0 ? queryParts.join('^') : '';

    const response = await client.get('/api/now/table/sys_ux_app_route', {
      params: {
        sysparm_query: query,
        sysparm_limit: limit
      }
    });

    const routes = response.data.result.map((route: any) => ({
      sys_id: route.sys_id,
      route: route.route,
      page_id: route.page,
      experience_id: route.experience,
      roles: route.roles ? route.roles.split(',') : [],
      public: route.public === 'true' || route.public === true,
      active: route.active === 'true' || route.active === true,
      url: `${context.instanceUrl}${route.route}`
    }));

    return createSuccessResult({
      routes,
      total: routes.length
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
