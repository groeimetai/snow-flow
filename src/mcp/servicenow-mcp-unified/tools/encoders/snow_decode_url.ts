/**
 * snow_decode_url
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_decode_url',
  description: 'URL decode string',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'utilities',
  use_cases: ['encoding', 'decoding', 'url'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      encoded: { type: 'string', description: 'URL encoded string' }
    },
    required: ['encoded']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { encoded } = args;
  try {
    const decoded = decodeURIComponent(encoded);
    return createSuccessResult({ decoded, encoded });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
