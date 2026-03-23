/**
 * snow_create_ui_policy_action
 *
 * Creates a UI Policy Action (sys_ui_policy_action) that controls field
 * visibility, mandatory state, or read-only state when a UI policy's
 * conditions are met.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_create_ui_policy_action",
  description:
    "Create a UI policy action to control field behavior (visible/mandatory/readonly) when a UI policy condition is met. Requires the parent UI policy sys_id and the target table name.",
  category: "development",
  subcategory: "platform",
  use_cases: ["ui-policy-actions", "form-control", "ui-automation"],
  complexity: "intermediate",
  frequency: "medium",

  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      ui_policy_sys_id: {
        type: "string",
        description: "sys_id of the parent UI policy (sys_ui_policy)",
      },
      table: {
        type: "string",
        description: "Table name the UI policy applies to (e.g. 'incident', 'change_request'). Must match the table on the parent UI policy.",
      },
      field: {
        type: "string",
        description: "Field name to control (e.g. 'close_notes', 'assignment_group')",
      },
      visible: {
        type: "boolean",
        description: "Set field visibility. true = visible, false = hidden. Omit to leave unchanged.",
      },
      mandatory: {
        type: "boolean",
        description: "Set field mandatory state. true = required, false = optional. Omit to leave unchanged.",
      },
      readonly: {
        type: "boolean",
        description: "Set field read-only state. true = read-only, false = editable. Omit to leave unchanged.",
      },
      cleared: {
        type: "boolean",
        description: "Clear the field value when the policy condition is true. Default: false.",
      },
    },
    required: ["ui_policy_sys_id", "table", "field"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { ui_policy_sys_id, table, field, visible, mandatory, readonly, cleared } = args
  try {
    const client = await getAuthenticatedClient(context)

    // Look up the parent UI policy to validate it exists and get its table
    const policyResponse = await client.get(
      "/api/now/table/sys_ui_policy/" + ui_policy_sys_id + "?sysparm_fields=sys_id,table,short_description",
    )
    const policy = policyResponse.data.result
    if (!policy || !policy.sys_id) {
      return createErrorResult("UI Policy not found with sys_id: " + ui_policy_sys_id)
    }

    const actionData: any = {
      ui_policy: ui_policy_sys_id,
      table: table,
      field: field,
      visible: visible !== undefined ? visible : true,
      mandatory: mandatory !== undefined ? mandatory : false,
      readonly: readonly !== undefined ? readonly : false,
      cleared: cleared !== undefined ? cleared : false,
    }

    const response = await client.post("/api/now/table/sys_ui_policy_action", actionData)
    const action = response.data.result

    return createSuccessResult({
      created: true,
      action: {
        sys_id: action.sys_id,
        ui_policy: ui_policy_sys_id,
        table: table,
        field: action.field,
        visible: action.visible,
        mandatory: action.mandatory,
        readonly: action.readonly,
        cleared: action.cleared,
      },
    })
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.0.0"
export const author = "Snow-Flow SDK Migration"
