/**
 * snow_create_variable
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_variable',
  description: 'Create catalog variable',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'catalog',
  use_cases: ['catalog-variables', 'service-catalog', 'form-fields'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Variable name' },
      question_text: { type: 'string', description: 'Question text' },
      type: { type: 'string', enum: ['string', 'multi_line_text', 'select_box', 'checkbox', 'reference'], default: 'string' },
      mandatory: { type: 'boolean', default: false },
      order: { type: 'number', description: 'Display order' }
    },
    required: ['name', 'question_text']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, question_text, type = 'string', mandatory = false, order } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const variableData: any = {
      name,
      question_text,
      type,
      mandatory
    };
    if (order !== undefined) variableData.order = order;
    const response = await client.post('/api/now/table/item_option_new', variableData);
    return createSuccessResult({ created: true, variable: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
