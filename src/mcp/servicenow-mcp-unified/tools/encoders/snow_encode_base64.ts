/**
 * snow_encode_base64
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_encode_base64',
  description: 'Encode string to Base64',
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
    const encoded = Buffer.from(text).toString('base64');
    return createSuccessResult({ encoded, original_length: text.length });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
