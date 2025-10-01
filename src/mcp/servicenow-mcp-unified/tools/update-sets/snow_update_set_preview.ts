/**
 * snow_update_set_preview - Preview Update Set changes
 *
 * Generates a detailed preview of all changes contained in an Update Set.
 * Shows modified tables, fields, and potential deployment impacts.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_preview',
  description: 'Preview all changes in an Update Set before deployment',
  inputSchema: {
    type: 'object',
    properties: {
      update_set_id: {
        type: 'string',
        description: 'Update Set sys_id (uses current if not specified)'
      },
      include_payload: {
        type: 'boolean',
        description: 'Include XML payload details',
        default: false
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id, include_payload = false } = args;

  try {
    const client = await getAuthenticatedClient(context);

    let targetId = update_set_id;

    // If no ID specified, use current Update Set
    if (!targetId) {
      const currentResponse = await client.get('/api/now/table/sys_update_set', {
        params: {
          sysparm_query: 'is_current=true',
          sysparm_fields: 'sys_id,name',
          sysparm_limit: 1
        }
      });

      if (!currentResponse.data.result || currentResponse.data.result.length === 0) {
        return createErrorResult('No Update Set specified and no active Update Set found');
      }

      targetId = currentResponse.data.result[0].sys_id;
    }

    // Get Update Set details
    const updateSetResponse = await client.get(`/api/now/table/sys_update_set/${targetId}`, {
      params: {
        sysparm_fields: 'sys_id,name,description,state,sys_created_on'
      }
    });

    if (!updateSetResponse.data.result) {
      return createErrorResult(`Update Set not found: ${targetId}`);
    }

    const updateSet = updateSetResponse.data.result;

    // Get all changes (sys_update_xml records)
    const changesResponse = await client.get('/api/now/table/sys_update_xml', {
      params: {
        sysparm_query: `update_set=${targetId}`,
        sysparm_fields: include_payload
          ? 'sys_id,type,name,target_name,action,sys_updated_on,sys_updated_by,payload'
          : 'sys_id,type,name,target_name,action,sys_updated_on,sys_updated_by',
        sysparm_limit: 1000
      }
    });

    const changes = changesResponse.data.result || [];

    // Group changes by type
    const changesByType: Record<string, any[]> = {};
    changes.forEach((change: any) => {
      const type = change.type || 'Unknown';
      if (!changesByType[type]) {
        changesByType[type] = [];
      }
      changesByType[type].push({
        name: change.name,
        target: change.target_name,
        action: change.action,
        updated_at: change.sys_updated_on,
        updated_by: change.sys_updated_by,
        ...(include_payload && { payload: change.payload })
      });
    });

    return createSuccessResult({
      update_set: {
        sys_id: updateSet.sys_id,
        name: updateSet.name,
        description: updateSet.description,
        state: updateSet.state,
        created_at: updateSet.sys_created_on
      },
      changes: {
        total_count: changes.length,
        by_type: changesByType,
        type_summary: Object.entries(changesByType).map(([type, items]) => ({
          type,
          count: items.length
        }))
      },
      preview_generated_at: new Date().toISOString()
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
