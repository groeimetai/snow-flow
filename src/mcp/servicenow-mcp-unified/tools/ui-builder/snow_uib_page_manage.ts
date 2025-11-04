/**
 * snow_uib_page_manage - Unified UI Builder Page Management
 *
 * Comprehensive UIB page operations: create pages, delete pages,
 * add elements, remove elements.
 *
 * Replaces: snow_create_uib_page, snow_delete_uib_page,
 *           snow_add_uib_page_element, snow_remove_uib_page_element
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_uib_page_manage',
  description: 'Unified UIB page management (create, delete, add_element, remove_element)',
  category: 'ui-builder',
  subcategory: 'pages',
  use_cases: ['ui-builder', 'pages', 'components'],
  complexity: 'intermediate',
  frequency: 'high',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Management operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        description: 'Page management action',
        enum: ['create', 'delete', 'add_element', 'remove_element']
      },
      // CREATE parameters
      name: { type: 'string', description: '[create] Page name (internal identifier)' },
      title: { type: 'string', description: '[create] Page title (display name)' },
      description: { type: 'string', description: '[create] Page description' },
      route: { type: 'string', description: '[create] URL route (e.g., "/my-page")' },
      roles: { type: 'array', description: '[create] Required roles to access page' },
      public: { type: 'boolean', description: '[create] Make page publicly accessible' },
      // DELETE parameters
      page_id: { type: 'string', description: '[delete/add_element/remove_element] Page sys_id' },
      force: { type: 'boolean', description: '[delete/remove_element] Force operation ignoring dependencies' },
      delete_dependencies: { type: 'boolean', description: '[delete] Delete associated dependencies' },
      // ADD_ELEMENT parameters
      component: { type: 'string', description: '[add_element] Component name or sys_id' },
      container_id: { type: 'string', description: '[add_element] Parent container element ID' },
      position: { type: 'number', description: '[add_element] Element position in container' },
      properties: { type: 'object', description: '[add_element] Component properties' },
      data_broker: { type: 'string', description: '[add_element] Data broker sys_id' },
      responsive_config: { type: 'object', description: '[add_element] Responsive layout config' },
      conditional_display: { type: 'string', description: '[add_element] Condition script for visibility' },
      css_classes: { type: 'array', description: '[add_element] CSS classes to apply' },
      inline_styles: { type: 'object', description: '[add_element] Inline styles config' },
      // REMOVE_ELEMENT parameters
      element_id: { type: 'string', description: '[remove_element] Page element sys_id to remove' },
      check_dependencies: { type: 'boolean', description: '[remove_element] Check for dependent elements' }
    },
    required: ['action']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { action } = args;

  try {
    switch (action) {
      case 'create':
        return await executeCreate(args, context);
      case 'delete':
        return await executeDelete(args, context);
      case 'add_element':
        return await executeAddElement(args, context);
      case 'remove_element':
        return await executeRemoveElement(args, context);
      default:
        return createErrorResult(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

// ==================== CREATE ====================
async function executeCreate(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, title, description = '', route, roles = [], public: isPublic = false } = args;

  if (!name) return createErrorResult('name required');
  if (!title) return createErrorResult('title required');

  const client = await getAuthenticatedClient(context);

  // Create UI Builder page
  const pageResponse = await client.post('/api/now/table/sys_ux_page', {
    name,
    title,
    description,
    type: 'page'
  });

  const pageSysId = pageResponse.data.result.sys_id;

  // Create route if specified
  let routeSysId;
  let routeUrl;
  if (route) {
    const routeResponse = await client.post('/api/now/table/sys_ux_app_route', {
      page: pageSysId,
      route,
      roles: Array.isArray(roles) ? roles.join(',') : roles,
      public: isPublic
    });
    routeSysId = routeResponse.data.result.sys_id;
    routeUrl = `${context.instanceUrl}${route}`;
  }

  return createSuccessResult({
    action: 'create',
    page: {
      sys_id: pageSysId,
      name,
      title,
      url: `${context.instanceUrl}/now/experience/page/${pageSysId}`
    },
    route: route ? {
      sys_id: routeSysId,
      route,
      url: routeUrl
    } : undefined
  });
}

// ==================== DELETE ====================
async function executeDelete(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { page_id, force = false, delete_dependencies = true } = args;

  if (!page_id) return createErrorResult('page_id required');

  const client = await getAuthenticatedClient(context);

  // Check dependencies
  const dependencies: any = {
    elements: [],
    data_brokers: [],
    client_scripts: [],
    routes: []
  };

  if (delete_dependencies) {
    // Get page elements
    const elementsResponse = await client.get('/api/now/table/sys_ux_page_element', {
      params: { sysparm_query: `page=${page_id}` }
    });
    dependencies.elements = elementsResponse.data.result;

    // Get data brokers
    const brokersResponse = await client.get('/api/now/table/sys_ux_data_broker', {
      params: { sysparm_query: `page=${page_id}` }
    });
    dependencies.data_brokers = brokersResponse.data.result;

    // Get client scripts
    const scriptsResponse = await client.get('/api/now/table/sys_ux_client_script', {
      params: { sysparm_query: `page=${page_id}` }
    });
    dependencies.client_scripts = scriptsResponse.data.result;

    // Get routes
    const routesResponse = await client.get('/api/now/table/sys_ux_app_route', {
      params: { sysparm_query: `page=${page_id}` }
    });
    dependencies.routes = routesResponse.data.result;

    // Delete all dependencies
    for (const element of dependencies.elements) {
      await client.delete(`/api/now/table/sys_ux_page_element/${element.sys_id}`);
    }
    for (const broker of dependencies.data_brokers) {
      await client.delete(`/api/now/table/sys_ux_data_broker/${broker.sys_id}`);
    }
    for (const script of dependencies.client_scripts) {
      await client.delete(`/api/now/table/sys_ux_client_script/${script.sys_id}`);
    }
    for (const route of dependencies.routes) {
      await client.delete(`/api/now/table/sys_ux_app_route/${route.sys_id}`);
    }
  }

  // Delete the page
  await client.delete(`/api/now/table/sys_ux_page/${page_id}`);

  return createSuccessResult({
    action: 'delete',
    deleted: true,
    page_id,
    dependencies_deleted: {
      elements: dependencies.elements.length,
      data_brokers: dependencies.data_brokers.length,
      client_scripts: dependencies.client_scripts.length,
      routes: dependencies.routes.length
    }
  });
}

// ==================== ADD ELEMENT ====================
async function executeAddElement(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    page_id,
    component,
    container_id,
    position = 0,
    properties = {},
    data_broker,
    responsive_config,
    conditional_display,
    css_classes = [],
    inline_styles = {}
  } = args;

  if (!page_id) return createErrorResult('page_id required');
  if (!component) return createErrorResult('component required');

  const client = await getAuthenticatedClient(context);

  // Create page element
  const payload: any = {
    page: page_id,
    component,
    position
  };

  if (container_id) payload.container = container_id;
  if (Object.keys(properties).length > 0) payload.properties = JSON.stringify(properties);
  if (data_broker) payload.data_broker = data_broker;
  if (responsive_config) payload.responsive_config = JSON.stringify(responsive_config);
  if (conditional_display) payload.conditional_display = conditional_display;
  if (Array.isArray(css_classes) && css_classes.length > 0) payload.css_classes = css_classes.join(',');
  if (Object.keys(inline_styles).length > 0) payload.inline_styles = JSON.stringify(inline_styles);

  const response = await client.post('/api/now/table/sys_ux_page_element', payload);

  return createSuccessResult({
    action: 'add_element',
    element: {
      sys_id: response.data.result.sys_id,
      page_id,
      component,
      position
    }
  });
}

// ==================== REMOVE ELEMENT ====================
async function executeRemoveElement(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { page_id, element_id, force = false, check_dependencies = true } = args;

  if (!page_id) return createErrorResult('page_id required');
  if (!element_id) return createErrorResult('element_id required');

  const client = await getAuthenticatedClient(context);

  // Verify page exists
  const pageResponse = await client.get(`/api/now/table/sys_ux_page/${page_id}`);
  if (!pageResponse.data.result) {
    return createErrorResult('UI Builder page not found');
  }

  // Verify element exists
  const elementResponse = await client.get(`/api/now/table/sys_ux_page_element/${element_id}`);
  if (!elementResponse.data.result) {
    return createErrorResult('Page element not found');
  }

  const element = elementResponse.data.result;

  // Check dependencies if requested
  let dependencies: any[] = [];
  if (check_dependencies && !force) {
    dependencies = await checkElementDependencies(client, element_id, page_id);

    if (dependencies.length > 0) {
      return createErrorResult(
        `Cannot remove element: ${dependencies.length} dependent element(s) found. Use force=true to override.`
      );
    }
  }

  // Remove the element
  await client.delete(`/api/now/table/sys_ux_page_element/${element_id}`);

  // Log the removal
  try {
    await client.post('/api/now/table/sys_audit', {
      tablename: 'sys_ux_page_element',
      documentkey: element_id,
      fieldname: 'deleted',
      oldvalue: 'active',
      newvalue: 'deleted',
      reason: `Element removed from page ${page_id}`
    });
  } catch (auditError) {
    // Audit log creation is non-critical, continue if it fails
  }

  return createSuccessResult({
    action: 'remove_element',
    removed: true,
    element_id,
    page_id,
    element_name: element.name,
    dependencies_checked: check_dependencies,
    force_used: force
  });
}

// Helper function to check element dependencies
async function checkElementDependencies(client: any, elementId: string, pageId: string): Promise<any[]> {
  const dependencies: any[] = [];

  try {
    // Check for elements that reference this element
    const elementsResponse = await client.get('/api/now/table/sys_ux_page_element', {
      params: {
        sysparm_query: `page=${pageId}^parent_element=${elementId}`,
        sysparm_fields: 'sys_id,name,component'
      }
    });

    const childElements = elementsResponse.data.result || [];
    childElements.forEach((child: any) => {
      dependencies.push({
        type: 'child_element',
        sys_id: child.sys_id,
        name: child.name,
        component: child.component
      });
    });

    // Check for data brokers that reference this element
    const brokersResponse = await client.get('/api/now/table/sys_ux_data_broker', {
      params: {
        sysparm_query: `page=${pageId}^element=${elementId}`,
        sysparm_fields: 'sys_id,name'
      }
    });

    const brokers = brokersResponse.data.result || [];
    brokers.forEach((broker: any) => {
      dependencies.push({
        type: 'data_broker',
        sys_id: broker.sys_id,
        name: broker.name
      });
    });

    // Check for events that reference this element
    const eventsResponse = await client.get('/api/now/table/sys_ux_event', {
      params: {
        sysparm_query: `page=${pageId}^source_element=${elementId}`,
        sysparm_fields: 'sys_id,name,event_type'
      }
    });

    const events = eventsResponse.data.result || [];
    events.forEach((event: any) => {
      dependencies.push({
        type: 'event',
        sys_id: event.sys_id,
        name: event.name,
        event_type: event.event_type
      });
    });

  } catch (error) {
    // If we can't check dependencies, assume none exist
  }

  return dependencies;
}

export const version = '2.0.0';
export const author = 'Snow-Flow v8.2.0 Tool Merging - Phase 2';
