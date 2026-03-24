/**
 * snow_create_ui_policy_action
 *
 * Creates a UI Policy Action (sys_ui_policy_action) that controls field
 * visibility, mandatory state, or read-only state when a UI policy's
 * conditions are met.
 *
 * ServiceNow field mapping:
 *   - visible/mandatory/disabled are STRING fields with values: "true", "false", "ignore"
 *   - "disabled" is the actual column name for "Read only" in the UI
 *   - "table" is auto-derived from the parent UI policy but must be sent for field validation
 *
 * The "ui_policy" reference field is set via POST during creation. If the
 * platform silently ignores it, a cascading fallback (PATCH → PUT → GlideRecord)
 * ensures the link is established.
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { linkUiPolicyReference, verifyUiPolicyLink } from "./link-ui-policy.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_create_ui_policy_action",
  description:
    "Create a UI policy action to control field behavior (visible/mandatory/readonly) when a UI policy condition is met. Requires the parent UI policy sys_id and the target table name.",
  category: "development",
  subcategory: "ui-policies",
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
        description:
          "Table name the UI policy applies to (e.g. 'incident', 'change_request'). Must match the table on the parent UI policy.",
      },
      field: {
        type: "string",
        description: "Field name to control (e.g. 'close_notes', 'assignment_group')",
      },
      visible: {
        type: "boolean",
        description: "Set field visibility. true = visible, false = hidden. Omit to leave unchanged ('ignore').",
      },
      mandatory: {
        type: "boolean",
        description:
          "Set field mandatory state. true = required, false = optional. Omit to leave unchanged ('ignore').",
      },
      readonly: {
        type: "boolean",
        description:
          "Set field read-only state. true = read-only, false = editable. Omit to leave unchanged ('ignore').",
      },
      cleared: {
        type: "boolean",
        description: "Clear the field value when the policy condition is true. Default: false.",
      },
    },
    required: ["ui_policy_sys_id", "table", "field"],
  },
}

function toActionValue(val: boolean | undefined): string {
  if (val === undefined) return "ignore"
  return val ? "true" : "false"
}

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const uid = args.ui_policy_sys_id as string
  const table = args.table as string
  const field = args.field as string
  const visible = args.visible as boolean | undefined
  const mandatory = args.mandatory as boolean | undefined
  const readonly = args.readonly as boolean | undefined
  const cleared = args.cleared as boolean | undefined

  try {
    const client = await getAuthenticatedClient(context)

    const policyRes = await client.get(
      "/api/now/table/sys_ui_policy/" + uid + "?sysparm_fields=sys_id,table,short_description",
    )
    const policy = policyRes.data.result
    if (!policy || !policy.sys_id) {
      return createErrorResult("UI Policy not found with sys_id: " + uid)
    }

    const payload: Record<string, string | boolean> = {
      ui_policy: uid,
      table: table,
      field: field,
      visible: toActionValue(visible),
      mandatory: toActionValue(mandatory),
      disabled: toActionValue(readonly),
      cleared: cleared === true,
    }

    const response = await client.post("/api/now/table/sys_ui_policy_action", payload)
    const action = response.data.result
    const actionSysId = action.sys_id?.value || action.sys_id

    // Check if the POST already set the reference; if not, use the fallback chain
    const alreadyLinked = await verifyUiPolicyLink(client, actionSysId, uid)
    const linked = alreadyLinked || (await linkUiPolicyReference(client, actionSysId, uid))

    const refVal = action.ui_policy
    const resolvedRef = typeof refVal === "object" && refVal !== null ? refVal.value : refVal

    return createSuccessResult({
      created: true,
      action: {
        sys_id: actionSysId,
        ui_policy: linked ? uid : resolvedRef || "",
        ui_policy_linked: linked,
        table: action.table?.value || action.table,
        field: action.field?.value || action.field,
        visible: action.visible?.value || action.visible,
        mandatory: action.mandatory?.value || action.mandatory,
        disabled: action.disabled?.value || action.disabled,
        cleared: action.cleared?.value || action.cleared,
      },
      warning: linked
        ? undefined
        : "The ui_policy reference field could not be set via the REST API (ServiceNow platform limitation). The action was created but is not linked to the parent UI policy. Link it manually in the ServiceNow UI.",
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return createErrorResult(msg)
  }
}

export const version = "1.1.0"
export const author = "Snow-Flow SDK Migration"
