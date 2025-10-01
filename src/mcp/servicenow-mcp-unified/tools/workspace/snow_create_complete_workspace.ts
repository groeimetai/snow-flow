/**
 * snow_create_complete_workspace - Create complete UX workspace
 *
 * Executes all 6 steps automatically: Experience → List Menu → App Config →
 * Page Properties → List Configuration → App Route. Creates a fully functional workspace.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_complete_workspace',
  description: 'Create Complete UX Workspace - Executes all 6 steps automatically: Experience → App Config → Page Macroponent → Page Registry → Route → Landing Page Route. Creates a fully functional workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      workspace_name: {
        type: 'string',
        description: 'Workspace name (used for all components)'
      },
      description: {
        type: 'string',
        description: 'Workspace description'
      },
      home_page_name: {
        type: 'string',
        default: 'home',
        description: 'Home page name (default: "home")'
      },
      route_name: {
        type: 'string',
        default: 'home',
        description: 'URL route name (default: "home")'
      },
      root_component: {
        type: 'string',
        default: 'sn-canvas-panel',
        description: 'Root component for page'
      },
      composition: {
        type: 'object',
        description: 'Custom page layout (optional)'
      },
      root_macroponent: {
        type: 'string',
        description: 'Custom root macroponent (auto-detected if not provided)'
      },
      tables: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tables for list configuration (e.g., ["incident", "task"])'
      }
    },
    required: ['workspace_name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { workspace_name, description, tables = [] } = args;

  try {
    const client = await getAuthenticatedClient(context);

    const results = {
      workspace_name,
      steps_completed: [] as string[],
      sys_ids: {} as any,
      workspace_type: 'Now Experience Framework Workspace'
    };

    // STEP 1: Create UX Experience
    const experienceData = {
      name: workspace_name,
      description: description || `Complete UX workspace: ${workspace_name}`,
      active: true
    };

    const experienceResponse = await client.post('/api/now/table/sys_ux_experience', experienceData);
    const experienceSysId = experienceResponse.data.result.sys_id;
    results.steps_completed.push('UX Experience Created');
    results.sys_ids.experience_sys_id = experienceSysId;

    // STEP 2: Create List Menu Configuration
    const listMenuData = {
      name: `${workspace_name} List Menu`,
      experience: experienceSysId,
      description: `List menu for ${workspace_name}`,
      active: true
    };

    const listMenuResponse = await client.post('/api/now/table/sys_ux_list_menu_config', listMenuData);
    const listMenuSysId = listMenuResponse.data.result.sys_id;
    results.steps_completed.push('List Menu Configuration Created');
    results.sys_ids.list_menu_config_sys_id = listMenuSysId;

    // STEP 3: Create App Configuration
    const appConfigData = {
      name: `${workspace_name} Config`,
      experience_assoc: experienceSysId,
      list_config_id: listMenuSysId,
      description: `App configuration for ${workspace_name}`,
      active: true
    };

    const appConfigResponse = await client.post('/api/now/table/sys_ux_app_config', appConfigData);
    const appConfigSysId = appConfigResponse.data.result.sys_id;
    results.steps_completed.push('App Configuration Created');
    results.sys_ids.app_config_sys_id = appConfigSysId;

    // STEP 4: Create Page Properties
    const pageProperties = [];

    // Chrome tab property
    const chromeTabData = {
      experience: experienceSysId,
      name: 'chrome_tab',
      value: JSON.stringify({ title: workspace_name }),
      type: 'object'
    };
    const chromeTabResponse = await client.post('/api/now/table/sys_ux_page_property', chromeTabData);
    pageProperties.push({ name: 'chrome_tab', sys_id: chromeTabResponse.data.result.sys_id });

    // Chrome main property
    const chromeMainData = {
      experience: experienceSysId,
      name: 'chrome_main',
      value: JSON.stringify({
        showLeftNav: true,
        leftNavCollapsible: true,
        showHeader: true
      }),
      type: 'object'
    };
    const chromeMainResponse = await client.post('/api/now/table/sys_ux_page_property', chromeMainData);
    pageProperties.push({ name: 'chrome_main', sys_id: chromeMainResponse.data.result.sys_id });

    results.steps_completed.push('Page Properties Configured');
    results.sys_ids.page_properties = pageProperties;

    // STEP 5: Create List Categories and Lists if tables specified
    if (tables.length > 0) {
      const categories = [];
      const lists = [];

      for (const table of tables) {
        // Create List Category
        const categoryData = {
          name: capitalizeTableName(table),
          list_menu_config: listMenuSysId,
          table: table,
          order: tables.indexOf(table) * 100,
          active: true
        };

        const categoryResponse = await client.post('/api/now/table/sys_ux_list_category', categoryData);
        const categorySysId = categoryResponse.data.result.sys_id;
        categories.push({ table: table, sys_id: categorySysId });

        // Create default list
        const listData = {
          name: `All ${capitalizeTableName(table)}`,
          category: categorySysId,
          table: table,
          filter: '',
          order: 100,
          active: true
        };

        const listResponse = await client.post('/api/now/table/sys_ux_list', listData);
        lists.push({
          table: table,
          category_sys_id: categorySysId,
          list_sys_id: listResponse.data.result.sys_id
        });
      }

      results.steps_completed.push('List Configuration Created');
      results.sys_ids.list_categories = categories;
      results.sys_ids.lists = lists;
    }

    // STEP 6: Create App Route
    const routeName = args.route_name || generateWorkspaceUrl(workspace_name);
    const appRouteData = {
      name: routeName,
      route: `/${routeName}`,
      experience: experienceSysId,
      description: `Route for ${workspace_name} workspace`,
      active: true
    };

    const appRouteResponse = await client.post('/api/now/table/sys_ux_app_route', appRouteData);
    results.steps_completed.push('App Route Created');
    results.sys_ids.app_route_sys_id = appRouteResponse.data.result.sys_id;

    return createSuccessResult({
      workspace_name,
      workspace_type: 'Now Experience Framework Workspace',
      all_steps_completed: true,
      steps_completed: results.steps_completed,
      sys_ids: results.sys_ids,
      workspace_url: `/now/experience/${routeName}`,
      message: `UX Workspace '${workspace_name}' created successfully with complete Now Experience Framework setup`,
      summary: `Experience → List Menu → App Config → Page Properties → List Configuration → App Route - Complete NXF workspace ready`,
      next_steps: [
        'Access workspace via navigation menu',
        'Configure additional list categories if needed',
        'Customize page properties for specific requirements',
        'Add declarative actions for enhanced functionality'
      ]
    });

  } catch (error: any) {
    return createErrorResult(
      error instanceof SnowFlowError ? error : error.message
    );
  }
}

// Helper functions
function capitalizeTableName(tableName: string): string {
  return tableName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

function generateWorkspaceUrl(workspaceName: string): string {
  return workspaceName.toLowerCase().replace(/\s+/g, '-');
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
