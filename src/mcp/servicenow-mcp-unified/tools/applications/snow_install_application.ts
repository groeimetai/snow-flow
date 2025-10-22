/**
 * snow_install_application
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_install_application',
  description: 'Install application from store',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'applications',
  use_cases: ['app-install', 'store', 'deployment'],
  complexity: 'beginner',
  frequency: 'low',
  inputSchema: {
    type: 'object',
    properties: {
      app_id: { type: 'string', description: 'Application ID from store' },
      version: { type: 'string', description: 'Version to install' }
    },
    required: ['app_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { app_id, version } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const installData: any = { sys_id: app_id };
    if (version) installData.version = version;
    const response = await client.post('/api/now/table/sys_store_app', installData);
    return createSuccessResult({ installed: true, application: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
