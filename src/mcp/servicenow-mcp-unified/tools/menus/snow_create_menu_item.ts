/**
 * snow_create_menu_item
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_menu_item',
  description: 'Create menu item',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'ui',
  use_cases: ['menu-items', 'navigation', 'ui-development'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Item title' },
      parent: { type: 'string', description: 'Parent menu sys_id' },
      link_type: { type: 'string', enum: ['list', 'new', 'detail', 'home'], default: 'list' },
      table: { type: 'string', description: 'Target table' },
      order: { type: 'number', description: 'Item order' }
    },
    required: ['title']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { title, parent, link_type = 'list', table, order } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const itemData: any = { title, link_type };
    if (parent) itemData.parent = parent;
    if (table) itemData.table = table;
    if (order !== undefined) itemData.order = order;
    const response = await client.post('/api/now/table/sys_app_module', itemData);
    return createSuccessResult({ created: true, menu_item: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
