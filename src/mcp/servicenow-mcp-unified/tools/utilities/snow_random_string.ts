/**
 * snow_random_string
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import crypto from 'crypto';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_random_string',
  description: 'Generate random string',
  inputSchema: {
    type: 'object',
    properties: {
      length: { type: 'number', default: 16 },
      charset: { type: 'string', enum: ['alphanumeric', 'alpha', 'numeric', 'hex'], default: 'alphanumeric' }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { length = 16, charset = 'alphanumeric' } = args;
  try {
    const charsets: any = {
      'alphanumeric': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
      'alpha': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      'numeric': '0123456789',
      'hex': '0123456789abcdef'
    };

    const chars = charsets[charset];
    let result = '';

    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return createSuccessResult({ random_string: result, length, charset });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
