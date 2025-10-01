/**
 * snow_exception_handler
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_exception_handler',
  description: 'Handle exceptions with logging',
  inputSchema: {
    type: 'object',
    properties: {
      exception_message: { type: 'string', description: 'Exception message' },
      severity: { type: 'string', enum: ['info', 'warning', 'error', 'critical'], default: 'error' },
      source: { type: 'string', description: 'Exception source' }
    },
    required: ['exception_message']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { exception_message, severity = 'error', source } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const exceptionData: any = {
      message: exception_message,
      severity,
      type: 'exception'
    };
    if (source) exceptionData.source = source;
    const response = await client.post('/api/now/table/syslog', exceptionData);
    return createSuccessResult({ logged: true, exception: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
