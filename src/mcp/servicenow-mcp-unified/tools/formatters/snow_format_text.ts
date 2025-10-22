/**
 * snow_format_text
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_format_text',
  description: 'Format text with various transformations',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'utilities',
  use_cases: ['formatting', 'text', 'transformation'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to format' },
      transform: { type: 'string', enum: ['uppercase', 'lowercase', 'titlecase', 'camelcase', 'snakecase'], default: 'lowercase' }
    },
    required: ['text']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { text, transform = 'lowercase' } = args;
  try {
    let formatted = text;

    switch (transform) {
      case 'uppercase':
        formatted = text.toUpperCase();
        break;
      case 'lowercase':
        formatted = text.toLowerCase();
        break;
      case 'titlecase':
        formatted = text.split(' ').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
        break;
      case 'camelcase':
        formatted = text.split(' ').map((word, i) =>
          i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join('');
        break;
      case 'snakecase':
        formatted = text.toLowerCase().replace(/\s+/g, '_');
        break;
    }

    return createSuccessResult({
      formatted,
      transform,
      original: text
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
