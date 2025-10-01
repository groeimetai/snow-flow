/**
 * snow_decode_base64
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_decode_base64',
  description: 'Decode Base64 to string',
  inputSchema: {
    type: 'object',
    properties: {
      encoded: { type: 'string', description: 'Base64 encoded string' }
    },
    required: ['encoded']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { encoded } = args;
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
    return createSuccessResult({ decoded, encoded_length: encoded.length });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
