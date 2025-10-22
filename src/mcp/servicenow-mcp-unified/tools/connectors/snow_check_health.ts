/**
 * snow_check_health
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_check_health',
  description: 'Check ServiceNow instance health',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'monitoring',
  use_cases: ['health-check', 'monitoring', 'diagnostics'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  try {
    const client = await getAuthenticatedClient(context);
    const startTime = Date.now();
    await client.get('/api/now/table/sys_user', { params: { sysparm_limit: 1 } });
    const responseTime = Date.now() - startTime;

    return createSuccessResult({
      healthy: true,
      response_time_ms: responseTime,
      status: responseTime < 1000 ? 'good' : responseTime < 3000 ? 'fair' : 'slow'
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
