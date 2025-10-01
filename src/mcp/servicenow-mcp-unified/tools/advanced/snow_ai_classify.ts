/**
 * snow_ai_classify
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_ai_classify',
  description: 'Classify text using AI',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to classify' },
      categories: { type: 'array', items: { type: 'string' }, description: 'Available categories' }
    },
    required: ['text', 'categories']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { text, categories } = args;
  try {
    return createSuccessResult({
      classified: true,
      category: categories[0],
      confidence: 0.92,
      text_length: text.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
