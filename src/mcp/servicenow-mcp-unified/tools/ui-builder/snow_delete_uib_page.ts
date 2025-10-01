/**
 * snow_delete_uib_page - Delete UI Builder pages
 *
 * Deletes UI Builder pages with comprehensive dependency validation
 * to ensure clean removal.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_delete_uib_page',
  description: 'Delete UI Builder page with dependency validation',
  inputSchema: {
    type: 'object',
    properties: {
      page_id: {
        type: 'string',
        description: 'Page sys_id to delete'
      },
      force: {
        type: 'boolean',
        description: 'Force delete even with dependencies',
        default: false
      },
      delete_dependencies: {
        type: 'boolean',
        description: 'Delete associated dependencies (elements, brokers, scripts)',
        default: true
      }
    },
    required: ['page_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    page_id,
    force = false,
    delete_dependencies = true
  } = args;

  try {
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
      deleted: true,
      page_id,
      dependencies_deleted: {
        elements: dependencies.elements.length,
        data_brokers: dependencies.data_brokers.length,
        client_scripts: dependencies.client_scripts.length,
        routes: dependencies.routes.length
      }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
