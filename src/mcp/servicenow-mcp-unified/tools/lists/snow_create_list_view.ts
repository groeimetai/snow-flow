/**
 * snow_create_list_view
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_list_view',
  description: 'Create custom list view',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'ui',
  use_cases: ['lists', 'views', 'ui-customization'],
  complexity: 'intermediate',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'View name' },
      table: { type: 'string', description: 'Table name' },
      fields: { type: 'array', items: { type: 'string' }, description: 'Fields to display' },
      filter: { type: 'string', description: 'Default filter' }
    },
    required: ['name', 'table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, fields, filter } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const viewData: any = { name, title: table };
    if (fields) viewData.fields = fields.join(',');
    if (filter) viewData.filter = filter;
    const response = await client.post('/api/now/table/sys_ui_list', viewData);
    return createSuccessResult({ created: true, view: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
