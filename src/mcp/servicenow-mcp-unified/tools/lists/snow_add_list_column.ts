/**
 * snow_add_list_column
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_add_list_column',
  description: 'Add column to list view',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'ui',
  use_cases: ['lists', 'views', 'ui-customization'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table name' },
      element: { type: 'string', description: 'Field name' },
      position: { type: 'number', description: 'Column position' },
      width: { type: 'number', description: 'Column width' }
    },
    required: ['table', 'element']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, element, position, width } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const columnData: any = { name: table, element };
    if (position !== undefined) columnData.position = position;
    if (width) columnData.width = width;
    const response = await client.post('/api/now/table/sys_ui_list_element', columnData);
    return createSuccessResult({ added: true, column: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
