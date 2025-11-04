/**
 * snow_create_catalog_ui_policy - Create catalog UI policy
 *
 * Creates comprehensive UI policies for catalog items with conditions and actions
 * to control form behavior dynamically.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_catalog_ui_policy',
  description: 'Creates comprehensive UI policies for catalog items with conditions and actions to control form behavior dynamically.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'service-catalog',
  use_cases: ['catalog', 'ui-policies', 'form-control'],
  complexity: 'advanced',
  frequency: 'medium',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      cat_item: { type: 'string', description: 'Catalog item sys_id' },
      short_description: { type: 'string', description: 'Policy name' },
      condition: { type: 'string', description: 'Legacy condition script (optional if conditions array provided)' },
      applies_to: { type: 'string', description: 'Applies to: item, set, or variable' },
      active: { type: 'boolean', description: 'Active status', default: true },
      on_load: { type: 'boolean', description: 'Run on form load', default: true },
      reverse_if_false: { type: 'boolean', description: 'Reverse actions if false', default: true },
      conditions: {
        type: 'array',
        description: 'Array of condition objects for dynamic policy evaluation',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Condition type (catalog_variable, javascript)', default: 'catalog_variable' },
            catalog_variable: { type: 'string', description: 'Target catalog variable sys_id or name' },
            operation: { type: 'string', description: 'Comparison operation: is, is_not, is_empty, is_not_empty, contains, does_not_contain', default: 'is' },
            value: { type: 'string', description: 'Comparison value' },
            and_or: { type: 'string', description: 'Logical operator with next condition: AND, OR', default: 'AND' }
          },
          required: ['catalog_variable', 'operation']
        }
      },
      actions: {
        type: 'array',
        description: 'Array of action objects to execute when conditions are met',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', description: 'Action type: set_mandatory, set_visible, set_readonly, set_value', default: 'set_visible' },
            catalog_variable: { type: 'string', description: 'Target catalog variable sys_id or name' },
            mandatory: { type: 'boolean', description: 'Set field as mandatory (for set_mandatory type)' },
            visible: { type: 'boolean', description: 'Set field visibility (for set_visible type)' },
            readonly: { type: 'boolean', description: 'Set field as readonly (for set_readonly type)' },
            value: { type: 'string', description: 'Value to set (for set_value type)' }
          },
          required: ['type', 'catalog_variable']
        }
      }
    },
    required: ['cat_item', 'short_description']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    cat_item,
    short_description,
    condition,
    applies_to = 'item',
    active = true,
    on_load = true,
    reverse_if_false = true,
    conditions,
    actions
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Create main UI policy
    const policyData: any = {
      catalog_item: cat_item,
      short_description,
      applies_catalog: true,
      active,
      applies_on: on_load ? 'true' : 'false',
      reverse_if_false
    };

    if (condition) policyData.catalog_conditions = condition;

    const policyResponse = await client.post('/api/now/table/catalog_ui_policy', policyData);
    const policyId = policyResponse.data.result.sys_id;

    // Create actions if provided
    const createdActions = [];
    if (actions && Array.isArray(actions)) {
      for (const action of actions) {
        const actionData: any = {
          ui_policy: policyId,
          catalog_item: cat_item,
          catalog_variable: action.catalog_variable,
          active: true
        };

        if (action.mandatory !== undefined) actionData.mandatory = action.mandatory;
        if (action.visible !== undefined) actionData.visible = action.visible;
        if (action.readonly !== undefined) actionData.disabled = action.readonly;
        if (action.value !== undefined) actionData.value = action.value;

        const actionResponse = await client.post('/api/now/table/catalog_ui_policy_action', actionData);
        createdActions.push(actionResponse.data.result);
      }
    }

    return createSuccessResult(
      {
        created: true,
        policy: policyResponse.data.result,
        policy_sys_id: policyId,
        actions: createdActions,
        actions_count: createdActions.length
      },
      {
        operation: 'create_catalog_ui_policy',
        name: short_description,
        actions_created: createdActions.length
      }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
