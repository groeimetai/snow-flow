/**
 * snow_test_connection
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_test_connection',
  description: 'Test ServiceNow connection',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'connectors',
  use_cases: ['connection-test', 'authentication', 'diagnostics'],
  complexity: 'beginner',
  frequency: 'high',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: READ - Read-only operation based on name pattern
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get('/api/now/table/sys_user', {
      params: { sysparm_limit: 1 }
    });
    return createSuccessResult({
      connected: true,
      instance: context.instanceUrl,
      user_count: response.data.result.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
