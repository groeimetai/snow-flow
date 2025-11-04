/**
 * snow_test_rest_message
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_test_rest_message',
  description: 'Test REST message method',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'rest-api',
  use_cases: ['rest-testing', 'integration-testing', 'api'],
  complexity: 'beginner',
  frequency: 'high',

  // Permission enforcement
  // Classification: READ - Read-only operation based on name pattern
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      rest_message_name: { type: 'string', description: 'REST message name' },
      method_name: { type: 'string', description: 'Method name' },
      parameters: { type: 'object', description: 'Request parameters' }
    },
    required: ['rest_message_name', 'method_name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { rest_message_name, method_name, parameters = {} } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const testScript = `
var rm = new sn_ws.RESTMessageV2('${rest_message_name}', '${method_name}');
${Object.entries(parameters).map(([key, value]) => `rm.setStringParameter('${key}', '${value}');`).join('\n')}
var response = rm.execute();
var statusCode = response.getStatusCode();
var body = response.getBody();
gs.info('Status: ' + statusCode + ', Body: ' + body);
    `;
    const response = await client.post('/api/now/table/sys_script_execution', { script: testScript });
    return createSuccessResult({
      tested: true,
      rest_message: rest_message_name,
      method: method_name
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
