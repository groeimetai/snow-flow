/**
 * snow_create_user_group - Create user group
 *
 * Creates a new user group in ServiceNow with specified properties.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_user_group',
  description: 'Creates a new user group in ServiceNow with specified properties',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'user-management',
  use_cases: ['groups', 'access-control'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Group name'
      },
      description: {
        type: 'string',
        description: 'Group description'
      },
      type: {
        type: 'string',
        description: 'Group type',
        enum: ['group', 'role', 'team'],
        default: 'group'
      },
      manager: {
        type: 'string',
        description: 'Manager sys_id or user_name'
      },
      parent: {
        type: 'string',
        description: 'Parent group sys_id'
      },
      active: {
        type: 'boolean',
        description: 'Active status',
        default: true
      }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, description, type = 'group', manager, parent, active = true } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Check if group already exists
    const existingResponse = await client.get('/api/now/table/sys_user_group', {
      params: {
        sysparm_query: `name=${name}`,
        sysparm_limit: 1
      }
    });

    if (existingResponse.data.result && existingResponse.data.result.length > 0) {
      return createErrorResult(`Group with name "${name}" already exists`);
    }

    // Resolve manager if provided
    let managerSysId;
    if (manager) {
      const managerQuery = manager.includes('@') ? `email=${manager}` : `user_name=${manager}`;
      const managerResponse = await client.get('/api/now/table/sys_user', {
        params: {
          sysparm_query: managerQuery,
          sysparm_limit: 1
        }
      });

      if (managerResponse.data.result && managerResponse.data.result.length > 0) {
        managerSysId = managerResponse.data.result[0].sys_id;
      }
    }

    // Create the group
    const groupData: any = {
      name,
      description,
      type,
      active
    };

    if (managerSysId) {
      groupData.manager = managerSysId;
    }

    if (parent) {
      groupData.parent = parent;
    }

    const response = await client.post('/api/now/table/sys_user_group', groupData);

    const createdGroup = response.data.result;

    return createSuccessResult(
      {
        message: `Group "${name}" created successfully`,
        group: {
          sys_id: createdGroup.sys_id,
          name: createdGroup.name,
          description: createdGroup.description,
          type: createdGroup.type,
          active: createdGroup.active,
          manager: createdGroup.manager
        }
      },
      { name, sys_id: createdGroup.sys_id }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
