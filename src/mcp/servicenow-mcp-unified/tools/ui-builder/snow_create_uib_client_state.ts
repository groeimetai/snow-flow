/**
 * snow_create_uib_client_state - Create client state
 *
 * Creates client state management for UI Builder pages to manage
 * page state and persistence.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_uib_client_state',
  description: 'Create client state management for UI Builder pages',
  // Metadata for tool discovery (not sent to LLM)
  category: 'ui-builder',
  subcategory: 'state-management',
  use_cases: ['ui-builder', 'state', 'persistence'],
  complexity: 'intermediate',
  frequency: 'medium',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      page_id: {
        type: 'string',
        description: 'Target page sys_id'
      },
      name: {
        type: 'string',
        description: 'State variable name'
      },
      initial_value: {
        type: 'string',
        description: 'Initial state value (JSON string)'
      },
      persistent: {
        type: 'boolean',
        description: 'Persist state across sessions',
        default: false
      },
      scope: {
        type: 'string',
        description: 'State scope (page, session, global)',
        default: 'page'
      }
    },
    required: ['page_id', 'name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    page_id,
    name,
    initial_value = '{}',
    persistent = false,
    scope = 'page'
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    const response = await client.post('/api/now/table/sys_ux_client_state', {
      page: page_id,
      name,
      initial_value,
      persistent,
      scope
    });

    return createSuccessResult({
      client_state: {
        sys_id: response.data.result.sys_id,
        name,
        scope,
        persistent,
        page_id
      }
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
