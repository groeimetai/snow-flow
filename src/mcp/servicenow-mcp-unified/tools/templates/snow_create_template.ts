/**
 * snow_create_template
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_template',
  description: 'Create record template',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'templates',
  use_cases: ['template-creation', 'record-templates', 'automation'],
  complexity: 'beginner',
  frequency: 'low',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Template name' },
      table: { type: 'string', description: 'Table name' },
      template: { type: 'object', description: 'Template field values' },
      active: { type: 'boolean', default: true }
    },
    required: ['name', 'table', 'template']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, template, active = true } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const templateData: any = {
      name,
      table,
      template: JSON.stringify(template),
      active
    };
    const response = await client.post('/api/now/table/sys_template', templateData);
    return createSuccessResult({ created: true, template: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
