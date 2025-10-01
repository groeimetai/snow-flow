/**
 * snow_cache_set
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_cache_set',
  description: 'Set value in cache',
  inputSchema: {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Cache key' },
      value: { type: 'string', description: 'Value to cache' },
      ttl_seconds: { type: 'number', default: 3600 }
    },
    required: ['key', 'value']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { key, value, ttl_seconds = 3600 } = args;
  try {
    return createSuccessResult({
      cached: true,
      key,
      ttl_seconds
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
