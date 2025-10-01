/**
 * snow_update_set_list - List Update Sets
 *
 * Lists Update Sets filtered by state (in_progress, complete, released).
 * Provides overview of recent changes and deployment readiness.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_list',
  description: 'List Update Sets filtered by state and recency',
  inputSchema: {
    type: 'object',
    properties: {
      state: {
        type: 'string',
        description: 'Filter by state',
        enum: ['in progress', 'complete', 'released']
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results',
        default: 10
      },
      order_by: {
        type: 'string',
        description: 'Order by field (default: sys_created_on DESC)',
        default: 'sys_created_on'
      }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { state, limit = 10, order_by = 'sys_created_on' } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Build query
    let query = '';
    if (state) {
      query = `state=${state}`;
    }

    // Get Update Sets
    const response = await client.get('/api/now/table/sys_update_set', {
      params: {
        sysparm_query: query,
        sysparm_fields: 'sys_id,name,description,state,sys_created_on,sys_created_by,sys_updated_on',
        sysparm_limit: limit,
        sysparm_orderby: `DESC${order_by}`
      }
    });

    const updateSets = response.data.result || [];

    // Enrich with artifact counts
    const enrichedSets = await Promise.all(
      updateSets.map(async (us: any) => {
        const artifactsResponse = await client.get('/api/now/table/sys_update_xml', {
          params: {
            sysparm_query: `update_set=${us.sys_id}`,
            sysparm_fields: 'sys_id',
            sysparm_limit: 1
          }
        });

        return {
          sys_id: us.sys_id,
          name: us.name,
          description: us.description,
          state: us.state,
          created_at: us.sys_created_on,
          created_by: us.sys_created_by,
          updated_at: us.sys_updated_on,
          artifact_count: artifactsResponse.data.result?.length || 0
        };
      })
    );

    return createSuccessResult({
      update_sets: enrichedSets,
      count: enrichedSets.length,
      filtered_by: state || 'all',
      limit
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
