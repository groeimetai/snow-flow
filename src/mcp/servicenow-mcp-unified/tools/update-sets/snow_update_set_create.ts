/**
 * snow_update_set_create - Create new Update Set
 *
 * Creates a new Update Set for tracking changes. Essential for ServiceNow
 * change management and deployment tracking.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_create',
  description: 'Create a new Update Set for tracking ServiceNow changes',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Update Set name (e.g., "STORY-123: Add incident widget")'
      },
      description: {
        type: 'string',
        description: 'Detailed description of changes'
      },
      user_story: {
        type: 'string',
        description: 'User story or ticket number'
      },
      release_date: {
        type: 'string',
        description: 'Target release date (optional)'
      },
      auto_switch: {
        type: 'boolean',
        description: 'Automatically switch to the created Update Set',
        default: true
      }
    },
    required: ['name', 'description']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    description,
    user_story,
    release_date,
    auto_switch = true
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Create Update Set
    const response = await client.post('/api/now/table/sys_update_set', {
      name,
      description,
      state: 'in progress',
      application: 'global',
      release_date: release_date || ''
    });

    const updateSet = response.data.result;

    // Auto-switch if requested
    if (auto_switch) {
      await client.put(`/api/now/table/sys_update_set/${updateSet.sys_id}`, {
        is_current: true
      });
    }

    return createSuccessResult({
      sys_id: updateSet.sys_id,
      name: updateSet.name,
      description: updateSet.description,
      state: 'in progress',
      auto_switched: auto_switch,
      created_at: updateSet.sys_created_on,
      created_by: updateSet.sys_created_by,
      user_story
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
