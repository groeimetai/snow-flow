/**
 * snow_update_set_complete - Complete Update Set
 *
 * Marks an Update Set as complete, preventing further changes.
 * Prepares the set for testing, review, and migration to other instances.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_complete',
  description: 'Mark Update Set as complete and ready for deployment',
  inputSchema: {
    type: 'object',
    properties: {
      update_set_id: {
        type: 'string',
        description: 'Update Set sys_id to complete (uses current if not specified)'
      },
      notes: {
        type: 'string',
        description: 'Completion notes or testing instructions'
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id, notes } = args;

  try {
    const client = await getAuthenticatedClient(context);

    let targetId = update_set_id;

    // If no ID specified, use current Update Set
    if (!targetId) {
      const currentResponse = await client.get('/api/now/table/sys_update_set', {
        params: {
          sysparm_query: 'is_current=true',
          sysparm_fields: 'sys_id',
          sysparm_limit: 1
        }
      });

      if (!currentResponse.data.result || currentResponse.data.result.length === 0) {
        return createErrorResult('No Update Set specified and no active Update Set found');
      }

      targetId = currentResponse.data.result[0].sys_id;
    }

    // Get Update Set details
    const getResponse = await client.get(`/api/now/table/sys_update_set/${targetId}`, {
      params: {
        sysparm_fields: 'sys_id,name,description,state'
      }
    });

    if (!getResponse.data.result) {
      return createErrorResult(`Update Set not found: ${targetId}`);
    }

    const updateSet = getResponse.data.result;

    // Mark as complete
    const updateData: any = {
      state: 'complete'
    };

    if (notes) {
      updateData.description = `${updateSet.description}\n\nCompletion Notes: ${notes}`;
    }

    await client.put(`/api/now/table/sys_update_set/${targetId}`, updateData);

    // Get artifact count
    const artifactsResponse = await client.get('/api/now/table/sys_update_xml', {
      params: {
        sysparm_query: `update_set=${targetId}`,
        sysparm_fields: 'sys_id',
        sysparm_limit: 1000
      }
    });

    const artifactCount = artifactsResponse.data.result?.length || 0;

    return createSuccessResult({
      sys_id: targetId,
      name: updateSet.name,
      state: 'complete',
      artifact_count: artifactCount,
      notes: notes || null,
      message: 'Update Set marked as complete. No further changes can be made.'
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
