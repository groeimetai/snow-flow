/**
 * snow_sleep
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_sleep',
  description: 'Sleep for specified milliseconds',
  inputSchema: {
    type: 'object',
    properties: {
      milliseconds: { type: 'number', description: 'Sleep duration in ms', default: 1000 }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { milliseconds = 1000 } = args;
  try {
    await new Promise(resolve => setTimeout(resolve, milliseconds));
    return createSuccessResult({ slept: true, duration_ms: milliseconds });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
