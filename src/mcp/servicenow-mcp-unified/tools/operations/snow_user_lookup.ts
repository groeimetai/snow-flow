/**
 * snow_user_lookup - User lookup
 *
 * Retrieves user information including roles, groups, and permissions.
 * Supports lookup by ID, email, or name.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_user_lookup',
  description: 'Retrieves user information including roles, groups, and permissions. Supports lookup by ID, email, or name.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'core-operations',
  subcategory: 'user-management',
  use_cases: ['users', 'lookup', 'permissions'],
  complexity: 'intermediate',
  frequency: 'high',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: READ - Read-only operation based on name pattern
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      identifier: {
        type: 'string',
        description: 'User ID, email, user_name, or name to search for'
      },
      include_roles: {
        type: 'boolean',
        description: 'Include user roles',
        default: true
      },
      include_groups: {
        type: 'boolean',
        description: 'Include user groups',
        default: true
      }
    },
    required: ['identifier']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { identifier, include_roles = true, include_groups = true } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Determine query strategy based on identifier
    let userQuery = '';
    if (identifier.includes('@')) {
      // Email lookup
      userQuery = `email=${identifier}`;
    } else if (identifier.includes('.')) {
      // User name lookup (e.g., john.doe)
      userQuery = `user_name=${identifier}`;
    } else {
      // General search - name or user_name or email
      userQuery = `nameLIKE${identifier}^ORuser_nameLIKE${identifier}^ORemailLIKE${identifier}`;
    }

    // Search for users
    const response = await client.get('/api/now/table/sys_user', {
      params: {
        sysparm_query: userQuery,
        sysparm_limit: 5
      }
    });

    const users = response.data.result || [];

    if (users.length === 0) {
      return createSuccessResult(
        {
          message: `No users found matching identifier: "${identifier}"`,
          total_results: 0,
          users: []
        },
        { identifier }
      );
    }

    let result: any = {
      total_results: users.length,
      query_used: userQuery,
      users: users.map((user: any) => ({
        sys_id: user.sys_id,
        user_name: user.user_name,
        name: user.name,
        email: user.email,
        title: user.title,
        department: user.department,
        location: user.location,
        active: user.active,
        locked_out: user.locked_out
      }))
    };

    // Get detailed information for the first user match
    if (users.length > 0 && (include_roles || include_groups)) {
      const primaryUser = users[0];
      const userDetails: any = {
        sys_id: primaryUser.sys_id,
        user_name: primaryUser.user_name,
        name: primaryUser.name
      };

      // Get user roles
      if (include_roles) {
        const rolesResponse = await client.get('/api/now/table/sys_user_has_role', {
          params: {
            sysparm_query: `user=${primaryUser.sys_id}`,
            sysparm_limit: 50
          }
        });

        userDetails.roles = rolesResponse.data.result.map((role: any) => ({
          role_name: role.role?.name || role.role,
          inherited: role.inherited,
          state: role.state
        })) || [];
      }

      // Get user groups
      if (include_groups) {
        const groupsResponse = await client.get('/api/now/table/sys_user_grmember', {
          params: {
            sysparm_query: `user=${primaryUser.sys_id}`,
            sysparm_limit: 50
          }
        });

        userDetails.groups = groupsResponse.data.result.map((membership: any) => ({
          group_name: membership.group?.name || membership.group,
          group_sys_id: membership.group?.value || membership.group
        })) || [];
      }

      result.user_details = userDetails;
    }

    return createSuccessResult(
      result,
      { identifier, users_found: users.length }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
