/**
 * snow_encode_url
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_encode_url',
  description: 'URL encode string',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to encode' }
    },
    required: ['text']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { text } = args;
  try {
    const encoded = encodeURIComponent(text);
    return createSuccessResult({ encoded, original: text });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
