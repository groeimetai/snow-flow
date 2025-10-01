/**
 * snow_create_form_section
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_form_section',
  description: 'Create form section',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Section name' },
      table: { type: 'string', description: 'Table name' },
      view: { type: 'string', description: 'Form view' },
      caption: { type: 'string', description: 'Section caption' },
      position: { type: 'number', description: 'Section position' }
    },
    required: ['name', 'table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, view, caption, position } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const sectionData: any = { name, table };
    if (view) sectionData.view = view;
    if (caption) sectionData.caption = caption;
    if (position !== undefined) sectionData.position = position;
    const response = await client.post('/api/now/table/sys_ui_section', sectionData);
    return createSuccessResult({ created: true, section: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
