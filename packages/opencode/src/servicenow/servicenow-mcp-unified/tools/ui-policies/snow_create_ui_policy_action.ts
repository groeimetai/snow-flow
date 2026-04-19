/**
 * snow_create_ui_policy_action
 *
 * Creates a UI Policy Action (sys_ui_policy_action) that controls field
 * visibility, mandatory state, or read-only state when a UI policy's
 * conditions are met.
 *
 * Primary path: server-side GlideRecord via Scripted REST. The Table API
 * silently drops the ui_policy reference field (ACL / business-rule
 * protection), so we insert via GlideRecord which bypasses that. Falls
 * back to Table API + PATCH/PUT chain if Scripted REST can't be deployed.
 *
 * ServiceNow field mapping:
 *   - visible/mandatory/disabled are STRING fields with values: "true", "false", "ignore"
 *   - "disabled" is the actual column name for "Read only" in the UI
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types"
import { getAuthenticatedClient } from "../../shared/auth"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler"
import { executeServerScript } from "../../shared/scripted-exec"
import { linkUiPolicyReference, verifyUiPolicyLink } from "./link-ui-policy"

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

function buildServerScript(input: {
  ui_policy_sys_id: string
  table: string
  field: string
  visible: string
  mandatory: string
  disabled: string
  cleared: boolean
}): string {
  return `(function() {
  var INPUT = ${JSON.stringify(input)};

  var policyCheck = new GlideRecord('sys_ui_policy');
  if (!policyCheck.get(INPUT.ui_policy_sys_id)) {
    return JSON.stringify({ error: 'UI Policy not found with sys_id: ' + INPUT.ui_policy_sys_id });
  }

  var action = new GlideRecord('sys_ui_policy_action');
  action.initialize();
  action.setValue('ui_policy', INPUT.ui_policy_sys_id);
  action.setValue('table', INPUT.table);
  action.setValue('field', INPUT.field);
  action.setValue('visible', INPUT.visible);
  action.setValue('mandatory', INPUT.mandatory);
  action.setValue('disabled', INPUT.disabled);
  action.setValue('cleared', INPUT.cleared);
  var sysId = action.insert();

  if (!sysId) {
    return JSON.stringify({ error: 'Failed to insert sys_ui_policy_action' });
  }

  return JSON.stringify({
    sys_id: String(sysId),
    ui_policy: INPUT.ui_policy_sys_id,
    table: INPUT.table,
    field: INPUT.field,
    visible: INPUT.visible,
    mandatory: INPUT.mandatory,
    disabled: INPUT.disabled,
    cleared: INPUT.cleared
  });
})();`
}

function parseScriptResult(raw: unknown):
  | {
      sys_id: string
      ui_policy: string
      table: string
      field: string
      visible: string
      mandatory: string
      disabled: string
      cleared: boolean
      error?: string
    }
  | null {
  if (typeof raw !== "string") return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const uid = args.ui_policy_sys_id as string
  const table = args.table as string
  const field = args.field as string
  const visible = toActionValue(args.visible as boolean | undefined)
  const mandatory = toActionValue(args.mandatory as boolean | undefined)
  const disabled = toActionValue(args.readonly as boolean | undefined)
  const cleared = args.cleared === true

  try {
    const script = buildServerScript({
      ui_policy_sys_id: uid,
      table,
      field,
      visible,
      mandatory,
      disabled,
      cleared,
    })

    const scriptResult = await executeServerScript(context, script, {
      description: "Create sys_ui_policy_action via GlideRecord",
    }).catch(() => null)

    if (scriptResult?.success) {
      const parsed = parseScriptResult(scriptResult.result)
      if (parsed?.error) return createErrorResult(parsed.error)
      if (parsed?.sys_id) {
        return createSuccessResult({
          created: true,
          method: "server_side_glide_record",
          action: {
            sys_id: parsed.sys_id,
            ui_policy: parsed.ui_policy,
            ui_policy_linked: true,
            table: parsed.table,
            field: parsed.field,
            visible: parsed.visible,
            mandatory: parsed.mandatory,
            disabled: parsed.disabled,
            cleared: parsed.cleared,
          },
        })
      }
    }

    const client = await getAuthenticatedClient(context)

    const policyRes = await client.get(
      "/api/now/table/sys_ui_policy/" + uid + "?sysparm_fields=sys_id,table,short_description",
    )
    const policy = policyRes.data.result
    if (!policy?.sys_id) {
      return createErrorResult("UI Policy not found with sys_id: " + uid)
    }

    const response = await client.post("/api/now/table/sys_ui_policy_action", {
      ui_policy: uid,
      table,
      field,
      visible,
      mandatory,
      disabled,
      cleared,
    })
    const action = response.data.result
    const actionSysId = action.sys_id?.value || action.sys_id

    const alreadyLinked = await verifyUiPolicyLink(client, actionSysId, uid)
    const linked = alreadyLinked || (await linkUiPolicyReference(client, actionSysId, uid))

    const refVal = action.ui_policy
    const resolvedRef = typeof refVal === "object" && refVal !== null ? refVal.value : refVal

    return createSuccessResult({
      created: true,
      method: "table_api_fallback",
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
        : "The ui_policy reference field could not be set via the REST API and server-side GlideRecord execution also failed. The action was created but is not linked to the parent UI policy. Link it manually in the ServiceNow UI.",
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return createErrorResult(msg)
  }
}

export const version = "2.0.0"
export const author = "Snow-Flow SDK Migration"
