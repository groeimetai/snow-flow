/**
 * snow_create_ui_policy - Create UI Policies
 *
 * Create declarative form behavior policies for field visibility,
 * mandatory state, and read-only control.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_ui_policy',
  description: 'Create UI Policy for form field control (visibility, mandatory, readonly)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'platform',
  use_cases: ['ui-policies', 'form-control', 'declarative-logic'],
  complexity: 'intermediate',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'UI Policy name'
      },
      table: {
        type: 'string',
        description: 'Table to attach policy to'
      },
      condition: {
        type: 'string',
        description: 'Condition (encoded query or script)'
      },
      description: {
        type: 'string',
        description: 'Policy description'
      },
      on_load: {
        type: 'boolean',
        description: 'Run on form load',
        default: true
      },
      reverse_if_false: {
        type: 'boolean',
        description: 'Reverse actions when condition is false',
        default: true
      },
      active: {
        type: 'boolean',
        description: 'Activate immediately',
        default: true
      },
      actions: {
        type: 'array',
        description: 'UI Policy actions',
        items: {
          type: 'object',
          properties: {
            field_name: { type: 'string', description: 'Field to control' },
            visible: { type: 'boolean', description: 'Make field visible' },
            mandatory: { type: 'boolean', description: 'Make field mandatory' },
            readonly: { type: 'boolean', description: 'Make field readonly' },
            cleared: { type: 'boolean', description: 'Clear field value' }
          },
          required: ['field_name']
        }
      }
    },
    required: ['name', 'table', 'actions']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    table,
    condition = '',
    description = '',
    on_load = true,
    reverse_if_false = true,
    active = true,
    actions = []
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    if (actions.length === 0) {
      throw new Error('At least one action is required');
    }

    // Create UI Policy
    const uiPolicyData: any = {
      short_description: name,
      table,
      conditions: condition,
      description,
      on_load,
      reverse_if_false,
      active
    };

    const policyResponse = await client.post('/api/now/table/sys_ui_policy', uiPolicyData);
    const uiPolicy = policyResponse.data.result;

    // Create UI Policy Actions
    const createdActions = [];
    for (const action of actions) {
      const actionData: any = {
        ui_policy: uiPolicy.sys_id,
        field: action.field_name,
        visible: action.visible !== undefined ? action.visible : true,
        mandatory: action.mandatory || false,
        readonly: action.readonly || false,
        cleared: action.cleared || false
      };

      const actionResponse = await client.post('/api/now/table/sys_ui_policy_action', actionData);
      createdActions.push(actionResponse.data.result);
    }

    return createSuccessResult({
      created: true,
      ui_policy: {
        sys_id: uiPolicy.sys_id,
        name: uiPolicy.short_description,
        table: uiPolicy.table,
        condition: uiPolicy.conditions,
        on_load: uiPolicy.on_load === 'true',
        reverse_if_false: uiPolicy.reverse_if_false === 'true',
        active: uiPolicy.active === 'true'
      },
      actions: createdActions.map(action => ({
        sys_id: action.sys_id,
        field: action.field,
        visible: action.visible === 'true',
        mandatory: action.mandatory === 'true',
        readonly: action.readonly === 'true',
        cleared: action.cleared === 'true'
      })),
      total_actions: createdActions.length,
      best_practices: [
        'UI Policies are declarative - use instead of client scripts when possible',
        'Conditions can be encoded queries or scripts',
        'reverse_if_false makes policy bidirectional',
        'Order matters when multiple policies affect same field',
        'Test with different user roles and data'
      ]
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
