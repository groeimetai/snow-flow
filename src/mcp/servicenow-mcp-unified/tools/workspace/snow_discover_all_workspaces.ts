/**
 * snow_discover_all_workspaces - Discover all workspaces
 *
 * Discover all workspaces (UX Experiences, Agent Workspaces, UI Builder pages)
 * with comprehensive details and usage analytics.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_all_workspaces',
  description: 'Discover all workspaces (UX Experiences, Agent Workspaces, UI Builder pages) with comprehensive details and usage analytics.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ui-frameworks',
  subcategory: 'workspace',
  use_cases: ['workspace', 'discovery', 'analytics'],
  complexity: 'beginner',
  frequency: 'high',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: READ - Discovery operation - reads metadata
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      include_ux_experiences: {
        type: 'boolean',
        default: true,
        description: 'Include Now Experience Framework workspaces'
      },
      include_agent_workspaces: {
        type: 'boolean',
        default: true,
        description: 'Include Configurable Agent Workspaces'
      },
      include_ui_builder: {
        type: 'boolean',
        default: true,
        description: 'Include UI Builder pages'
      },
      active_only: {
        type: 'boolean',
        default: true,
        description: 'Only show active workspaces'
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    include_ux_experiences = true,
    include_agent_workspaces = true,
    include_ui_builder = true,
    active_only = true
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    const discovery = {
      ux_experiences: [] as any[],
      agent_workspaces: [] as any[],
      ui_builder_pages: [] as any[],
      total_count: 0
    };

    // Discover UX Experiences
    if (include_ux_experiences) {
      const experiencesQuery = active_only ? 'active=true' : '';
      const experiencesResponse = await client.get('/api/now/table/sys_ux_experience', {
        params: {
          sysparm_query: experiencesQuery,
          sysparm_limit: 50,
          sysparm_fields: 'sys_id,name,description,active'
        }
      });

      if (experiencesResponse.data.result) {
        discovery.ux_experiences = experiencesResponse.data.result.map((exp: any) => ({
          type: 'UX Experience',
          name: exp.name,
          sys_id: exp.sys_id,
          description: exp.description || 'No description',
          active: exp.active,
          url: `/now/experience/${exp.name?.toLowerCase().replace(/\s+/g, '-')}`
        }));
      }
    }

    // Discover Agent Workspaces
    if (include_agent_workspaces) {
      const routesQuery = active_only ? 'active=true^route_type=workspace' : 'route_type=workspace';
      const routesResponse = await client.get('/api/now/table/sys_ux_app_route', {
        params: {
          sysparm_query: routesQuery,
          sysparm_limit: 50,
          sysparm_fields: 'sys_id,name,description,route,active'
        }
      });

      if (routesResponse.data.result) {
        discovery.agent_workspaces = routesResponse.data.result.map((route: any) => ({
          type: 'Agent Workspace',
          name: route.name,
          sys_id: route.sys_id,
          description: route.description || 'No description',
          route: route.route,
          active: route.active,
          url: `/now/workspace${route.route}`
        }));
      }
    }

    // Discover UI Builder Pages
    if (include_ui_builder) {
      const pagesQuery = active_only ? 'active=true' : '';
      const pagesResponse = await client.get('/api/now/table/sys_ux_page', {
        params: {
          sysparm_query: pagesQuery,
          sysparm_limit: 50,
          sysparm_fields: 'sys_id,name,description,active'
        }
      });

      if (pagesResponse.data.result) {
        discovery.ui_builder_pages = pagesResponse.data.result.map((page: any) => ({
          type: 'UI Builder Page',
          name: page.name,
          sys_id: page.sys_id,
          description: page.description || 'No description',
          active: page.active
        }));
      }
    }

    discovery.total_count = discovery.ux_experiences.length +
                           discovery.agent_workspaces.length +
                           discovery.ui_builder_pages.length;

    return createSuccessResult({
      discovery,
      summary: {
        ux_experiences: discovery.ux_experiences.length,
        agent_workspaces: discovery.agent_workspaces.length,
        ui_builder_pages: discovery.ui_builder_pages.length,
        total_workspaces: discovery.total_count
      },
      message: `Found ${discovery.total_count} workspaces across all types`
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
