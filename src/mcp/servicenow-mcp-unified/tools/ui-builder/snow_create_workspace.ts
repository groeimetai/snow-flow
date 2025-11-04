/**
 * snow_create_workspace - Create complete Agent Workspace
 *
 * Create a complete Now Experience Framework workspace with all
 * necessary components (experience, config, routes, lists).
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_workspace',
  description: 'Create complete Agent Workspace with experience, config, routes, and lists',
  // Metadata for tool discovery (not sent to LLM)
  category: 'workspace',
  subcategory: 'creation',
  use_cases: ['workspace', 'agent-workspace', 'creation'],
  complexity: 'advanced',
  frequency: 'low',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Workspace name (e.g., "IT Support Workspace")'
      },
      description: {
        type: 'string',
        description: 'Workspace description'
      },
      tables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tables to include in workspace (e.g., ["incident", "task"])',
        default: []
      },
      roles: {
        type: 'array',
        items: { type: 'string' },
        description: 'Required roles to access workspace',
        default: []
      }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, description = '', tables = [], roles = [] } = args;

  try {
    const client = await getAuthenticatedClient(context);
    const components: any = {};

    // Step 1: Create Experience
    const experienceResponse = await client.post('/api/now/table/sys_ux_experience', {
      name,
      description,
      type: 'workspace'
    });
    components.experience = experienceResponse.data.result;

    // Step 2: Create App Config
    const appConfigResponse = await client.post('/api/now/table/sys_ux_app_config', {
      name: `${name} Config`,
      experience: components.experience.sys_id
    });
    components.app_config = appConfigResponse.data.result;

    // Step 3: Create App Route
    const routeResponse = await client.post('/api/now/table/sys_ux_app_route', {
      experience: components.experience.sys_id,
      route: `/workspace/${name.toLowerCase().replace(/\s+/g, '-')}`,
      roles: roles.join(',')
    });
    components.route = routeResponse.data.result;

    // Step 4: Create List Configurations for each table
    components.lists = [];
    for (const table of tables) {
      const listResponse = await client.post('/api/now/table/sys_ux_list', {
        name: `${table} List`,
        table,
        experience: components.experience.sys_id
      });
      components.lists.push(listResponse.data.result);
    }

    return createSuccessResult({
      workspace: {
        sys_id: components.experience.sys_id,
        name,
        url: `${context.instanceUrl}${components.route.route}`,
        tables_configured: tables.length
      },
      components: {
        experience_id: components.experience.sys_id,
        app_config_id: components.app_config.sys_id,
        route_id: components.route.sys_id,
        list_ids: components.lists.map((l: any) => l.sys_id)
      }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
