/**
 * snow_add_form_field
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_add_form_field',
  description: 'Add field to form section',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'forms',
  use_cases: ['forms', 'ui', 'fields'],
  complexity: 'intermediate',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      section_sys_id: { type: 'string', description: 'Section sys_id' },
      element: { type: 'string', description: 'Field name' },
      type: { type: 'string', description: 'Field type' },
      position: { type: 'number', description: 'Field position' }
    },
    required: ['section_sys_id', 'element']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { section_sys_id, element, type, position } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const fieldData: any = {
      sys_ui_section: section_sys_id,
      element
    };
    if (type) fieldData.type = type;
    if (position !== undefined) fieldData.position = position;
    const response = await client.post('/api/now/table/sys_ui_element', fieldData);
    return createSuccessResult({ added: true, field: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
