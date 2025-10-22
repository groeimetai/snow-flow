/**
 * snow_ensure_active_update_set - Ensure active Update Set
 *
 * Ensures an Update Set is active and optionally syncs it as the user's
 * current Update Set in ServiceNow. Critical for change tracking.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_ensure_active_update_set',
  description: 'Ensure Update Set is active and optionally set as current for user',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'update-sets',
  use_cases: ['update-sets', 'activation', 'change-tracking'],
  complexity: 'intermediate',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Update Set name (creates if doesn\'t exist)'
      },
      description: {
        type: 'string',
        description: 'Description for new Update Set'
      },
      sync_with_user: {
        type: 'boolean',
        description: 'Set this as user\'s current Update Set in ServiceNow',
        default: true
      },
      create_if_missing: {
        type: 'boolean',
        description: 'Create Update Set if it doesn\'t exist',
        default: true
      }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    description = `Snow-Flow: ${name}`,
    sync_with_user = true,
    create_if_missing = true
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Check if Update Set exists
    const existingResponse = await client.get('/api/now/table/sys_update_set', {
      params: {
        sysparm_query: `name=${name}`,
        sysparm_limit: 1
      }
    });

    let updateSet: any;

    if (existingResponse.data.result.length > 0) {
      updateSet = existingResponse.data.result[0];

      // Ensure it's in progress (not complete)
      if (updateSet.state !== 'in progress') {
        await client.put(`/api/now/table/sys_update_set/${updateSet.sys_id}`, {
          state: 'in progress'
        });
      }

    } else if (create_if_missing) {
      // Create new Update Set
      const createResponse = await client.post('/api/now/table/sys_update_set', {
        name,
        description,
        state: 'in progress',
        application: 'global'
      });
      updateSet = createResponse.data.result;

    } else {
      return createErrorResult(`Update Set not found: ${name}`);
    }

    // Set as current if sync_with_user is true
    if (sync_with_user) {
      await client.put(`/api/now/table/sys_update_set/${updateSet.sys_id}`, {
        is_current: true
      });

      // Also update user preferences to use this Update Set
      await client.post('/api/now/table/sys_user_preference', {
        name: 'sys.update_set',
        value: updateSet.sys_id,
        user: 'current' // Current authenticated user
      });
    }

    return createSuccessResult({
      sys_id: updateSet.sys_id,
      name: updateSet.name,
      description: updateSet.description,
      state: 'in progress',
      is_current: sync_with_user,
      created: existingResponse.data.result.length === 0
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
