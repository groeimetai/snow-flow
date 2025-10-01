/**
 * snow_hash_string
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import crypto from 'crypto';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_hash_string',
  description: 'Hash string using various algorithms',
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'Text to hash' },
      algorithm: { type: 'string', enum: ['md5', 'sha1', 'sha256', 'sha512'], default: 'sha256' }
    },
    required: ['text']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { text, algorithm = 'sha256' } = args;
  try {
    const hash = crypto.createHash(algorithm).update(text).digest('hex');
    return createSuccessResult({ hash, algorithm, original_length: text.length });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
