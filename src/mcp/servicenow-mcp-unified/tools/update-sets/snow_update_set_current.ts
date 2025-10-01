/**
 * snow_update_set_current - Get current Update Set
 *
 * Retrieves information about the currently active Update Set including
 * ID, name, state, and tracked artifacts.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_current',
  description: 'Get information about the currently active Update Set',
  inputSchema: {
    type: 'object',
    properties: {}
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  try {
    const client = await getAuthenticatedClient(context);

    // Get current Update Set
    const response = await client.get('/api/now/table/sys_update_set', {
      params: {
        sysparm_query: 'is_current=true',
        sysparm_fields: 'sys_id,name,description,state,sys_created_on,sys_created_by',
        sysparm_limit: 1
      }
    });

    if (!response.data.result || response.data.result.length === 0) {
      return createSuccessResult({
        active: false,
        message: 'No active Update Set found'
      });
    }

    const updateSet = response.data.result[0];

    // Get artifact count (sys_update_xml records)
    const artifactsResponse = await client.get('/api/now/table/sys_update_xml', {
      params: {
        sysparm_query: `update_set=${updateSet.sys_id}`,
        sysparm_fields: 'sys_id',
        sysparm_limit: 1000
      }
    });

    const artifactCount = artifactsResponse.data.result?.length || 0;

    return createSuccessResult({
      active: true,
      sys_id: updateSet.sys_id,
      name: updateSet.name,
      description: updateSet.description,
      state: updateSet.state,
      created_at: updateSet.sys_created_on,
      created_by: updateSet.sys_created_by,
      artifact_count: artifactCount
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
