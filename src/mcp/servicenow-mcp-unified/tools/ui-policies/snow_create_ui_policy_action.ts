/**
 * snow_create_ui_policy_action
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_ui_policy_action',
  description: 'Create UI policy action',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'platform',
  use_cases: ['ui-policy-actions', 'form-control', 'ui-automation'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      ui_policy_sys_id: { type: 'string', description: 'UI policy sys_id' },
      field: { type: 'string', description: 'Field name' },
      visible: { type: 'boolean', description: 'Make visible' },
      mandatory: { type: 'boolean', description: 'Make mandatory' },
      readonly: { type: 'boolean', description: 'Make readonly' }
    },
    required: ['ui_policy_sys_id', 'field']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { ui_policy_sys_id, field, visible, mandatory, readonly } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const actionData: any = {
      ui_policy: ui_policy_sys_id,
      field
    };
    if (visible !== undefined) actionData.visible = visible;
    if (mandatory !== undefined) actionData.mandatory = mandatory;
    if (readonly !== undefined) actionData.readonly = readonly;
    const response = await client.post('/api/now/table/sys_ui_policy_action', actionData);
    return createSuccessResult({ created: true, action: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
