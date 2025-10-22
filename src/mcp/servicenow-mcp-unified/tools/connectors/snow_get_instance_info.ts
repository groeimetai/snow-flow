/**
 * snow_get_instance_info
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_get_instance_info',
  description: 'Get ServiceNow instance information',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'discovery',
  use_cases: ['instance-info', 'version-check', 'diagnostics'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  try {
    const client = await getAuthenticatedClient(context);
    const response = await client.get('/api/now/table/sys_properties', {
      params: {
        sysparm_query: 'name=instance.name^ORname=glide.product.version',
        sysparm_limit: 10
      }
    });
    return createSuccessResult({
      instance_url: context.instanceUrl,
      properties: response.data.result
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
