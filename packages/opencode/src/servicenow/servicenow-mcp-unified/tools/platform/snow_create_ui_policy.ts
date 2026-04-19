/**
 * snow_create_ui_policy - Create UI Policies
 *
 * Create declarative form behavior policies for field visibility,
 * mandatory state, and read-only control.
 *
 * Primary path: server-side GlideRecord via Scripted REST. The REST Table
 * API silently drops the ui_policy reference field on sys_ui_policy_action
 * (ACL / business-rule protection), so policy + actions are created in one
 * server-side transaction using GlideRecord. Falls back to Table API +
 * PATCH/PUT/GlideRecord chain for instances where Scripted REST can't be
 * deployed.
 */

import type { AxiosInstance } from "axios"
import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types"
import { getAuthenticatedClient } from "../../shared/auth"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler"
import { executeServerScript } from "../../shared/scripted-exec"
import { linkUiPolicyReference, verifyUiPolicyLink } from "../ui-policies/link-ui-policy"

interface NormalizedAction {
  field: string
  visible: string
  mandatory: string
  disabled: string
  cleared: boolean
}

function extractSysId(value: unknown): string {
  if (!value) return ""
  if (typeof value === "object" && value !== null && "value" in value) {
    return String((value as { value: unknown }).value ?? "")
  }
  return String(value)
}

function toActionValue(val: boolean | undefined): string {
  if (val === undefined) return "ignore"
  return val ? "true" : "false"
}

function normalizeActions(actions: Array<Record<string, unknown>>): NormalizedAction[] {
  return actions.map((a) => {
    const field = (a.field as string) || (a.field_name as string)
    if (!field) throw new Error("Each action must have 'field' (or legacy 'field_name') set")
    return {
      field,
      visible: toActionValue(a.visible as boolean | undefined),
      mandatory: toActionValue(a.mandatory as boolean | undefined),
      disabled: toActionValue(a.readonly as boolean | undefined),
      cleared: a.cleared === true,
    }
  })
}

export const toolDefinition: MCPToolDefinition = {
  name: "snow_create_ui_policy",
  description: "Create UI Policy for form field control (visibility, mandatory, readonly)",
  category: "development",
  subcategory: "platform",
  use_cases: ["ui-policies", "form-control", "declarative-logic"],
  complexity: "intermediate",
  frequency: "high",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "string",
        description: "UI Policy name",
      },
      table: {
        type: "string",
        description: "Table to attach policy to",
      },
      condition: {
        type: "string",
        description: "Condition (encoded query or script)",
      },
      description: {
        type: "string",
        description: "Policy description",
      },
      on_load: {
        type: "boolean",
        description: "Run on form load",
        default: true,
      },
      reverse_if_false: {
        type: "boolean",
        description: "Reverse actions when condition is false",
        default: true,
      },
      active: {
        type: "boolean",
        description: "Activate immediately",
        default: true,
      },
      actions: {
        type: "array",
        description: "UI Policy actions. Each action controls one field.",
        items: {
          type: "object",
          properties: {
            field: {
              type: "string",
              description: "Field to control (ServiceNow column name, e.g. 'close_notes'). Alias: 'field_name'.",
            },
            visible: {
              type: "boolean",
              description: "Set visibility. true = visible, false = hidden. Omit to leave unchanged.",
            },
            mandatory: {
              type: "boolean",
              description: "Set mandatory state. true = required, false = optional. Omit to leave unchanged.",
            },
            readonly: {
              type: "boolean",
              description: "Set read-only state. true = read-only, false = editable. Omit to leave unchanged.",
            },
            cleared: {
              type: "boolean",
              description: "Clear the field value when the policy condition is true. Default: false.",
            },
          },
          required: ["field"],
        },
      },
    },
    required: ["name", "table", "actions"],
  },
}

function buildServerScript(args: {
  name: string
  table: string
  condition: string
  description: string
  on_load: boolean
  reverse_if_false: boolean
  active: boolean
  actions: NormalizedAction[]
}): string {
  return `(function() {
  var INPUT = ${JSON.stringify(args)};

  var policy = new GlideRecord('sys_ui_policy');
  policy.initialize();
  policy.setValue('short_description', INPUT.name);
  policy.setValue('table', INPUT.table);
  policy.setValue('conditions', INPUT.condition);
  policy.setValue('description', INPUT.description);
  policy.setValue('on_load', INPUT.on_load);
  policy.setValue('reverse_if_false', INPUT.reverse_if_false);
  policy.setValue('active', INPUT.active);
  var policySysId = policy.insert();

  if (!policySysId) {
    return JSON.stringify({ error: 'Failed to insert sys_ui_policy' });
  }

  var createdActions = [];
  var failedActions = [];
  for (var i = 0; i < INPUT.actions.length; i++) {
    var a = INPUT.actions[i];
    var action = new GlideRecord('sys_ui_policy_action');
    action.initialize();
    action.setValue('ui_policy', policySysId);
    action.setValue('table', INPUT.table);
    action.setValue('field', a.field);
    action.setValue('visible', a.visible);
    action.setValue('mandatory', a.mandatory);
    action.setValue('disabled', a.disabled);
    action.setValue('cleared', a.cleared);
    var actionSysId = action.insert();

    if (!actionSysId) {
      failedActions.push(a.field);
      continue;
    }

    createdActions.push({
      sys_id: String(actionSysId),
      ui_policy: String(policySysId),
      table: INPUT.table,
      field: a.field,
      visible: a.visible,
      mandatory: a.mandatory,
      disabled: a.disabled,
      cleared: a.cleared
    });
  }

  return JSON.stringify({
    policy: {
      sys_id: String(policySysId),
      name: INPUT.name,
      table: INPUT.table,
      condition: INPUT.condition,
      on_load: INPUT.on_load,
      reverse_if_false: INPUT.reverse_if_false,
      active: INPUT.active
    },
    actions: createdActions,
    failed_actions: failedActions
  });
})();`
}

function parseScriptResult(raw: unknown): {
  policy: { sys_id: string; name: string; table: string; condition: string; on_load: boolean; reverse_if_false: boolean; active: boolean }
  actions: Array<NormalizedAction & { sys_id: string; ui_policy: string; table: string }>
  failed_actions: string[]
  error?: string
} | null {
  if (raw === null || raw === undefined) return null
  const str = typeof raw === "string" ? raw : null
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return null
  }
}

async function createViaServerScript(
  context: ServiceNowContext,
  args: Parameters<typeof buildServerScript>[0],
): Promise<ToolResult | null> {
  const script = buildServerScript(args)
  const result = await executeServerScript(context, script, {
    description: "Create UI Policy + actions via GlideRecord (bypasses Table API ui_policy restriction)",
  })

  if (!result.success) return null
  const parsed = parseScriptResult(result.result)
  if (!parsed || parsed.error || !parsed.policy?.sys_id) return null

  const data: Record<string, unknown> = {
    created: true,
    method: "server_side_glide_record",
    ui_policy: parsed.policy,
    actions: parsed.actions.map((a) => ({
      sys_id: a.sys_id,
      ui_policy: a.ui_policy,
      table: a.table,
      field: a.field,
      visible: a.visible === "true",
      mandatory: a.mandatory === "true",
      readonly: a.disabled === "true",
      cleared: a.cleared,
      ui_policy_linked: true,
    })),
    total_actions: parsed.actions.length,
    best_practices: [
      "UI Policies are declarative - use instead of client scripts when possible",
      "Conditions can be encoded queries or scripts",
      "reverse_if_false makes policy bidirectional",
      "Order matters when multiple policies affect same field",
      "Test with different user roles and data",
    ],
  }

  if (parsed.failed_actions?.length > 0) {
    data.warning = "Some actions failed to create server-side: " + parsed.failed_actions.join(", ")
  }

  return createSuccessResult(data)
}

async function createViaTableApi(
  client: AxiosInstance,
  args: {
    name: string
    table: string
    condition: string
    description: string
    on_load: boolean
    reverse_if_false: boolean
    active: boolean
    actions: NormalizedAction[]
  },
): Promise<ToolResult> {
  const policyResponse = await client.post("/api/now/table/sys_ui_policy", {
    short_description: args.name,
    table: args.table,
    conditions: args.condition,
    description: args.description,
    on_load: args.on_load,
    reverse_if_false: args.reverse_if_false,
    active: args.active,
  })
  const uiPolicy = policyResponse.data.result
  const policySysId = extractSysId(uiPolicy.sys_id)

  const createdActions: Array<Record<string, unknown>> = []
  const unlinkableActions: string[] = []
  for (const action of args.actions) {
    const actionResponse = await client.post("/api/now/table/sys_ui_policy_action", {
      ui_policy: policySysId,
      table: args.table,
      field: action.field,
      visible: action.visible,
      mandatory: action.mandatory,
      disabled: action.disabled,
      cleared: action.cleared,
    })
    const actionResult = actionResponse.data.result
    const actionSysId = extractSysId(actionResult.sys_id)

    const alreadyLinked = await verifyUiPolicyLink(client, actionSysId, policySysId)
    if (!alreadyLinked) {
      const linked = await linkUiPolicyReference(client, actionSysId, policySysId)
      if (!linked) unlinkableActions.push(action.field)
    }

    createdActions.push(actionResult)
  }

  const data: Record<string, unknown> = {
    created: true,
    method: "table_api_fallback",
    ui_policy: {
      sys_id: policySysId,
      name: uiPolicy.short_description,
      table: uiPolicy.table,
      condition: uiPolicy.conditions,
      on_load: uiPolicy.on_load === "true",
      reverse_if_false: uiPolicy.reverse_if_false === "true",
      active: uiPolicy.active === "true",
    },
    actions: createdActions.map((action) => ({
      sys_id: extractSysId(action.sys_id),
      field: action.field,
      visible: action.visible === "true",
      mandatory: action.mandatory === "true",
      readonly: action.disabled === "true",
      cleared: action.cleared === "true",
      ui_policy_linked: !unlinkableActions.includes(action.field as string),
    })),
    total_actions: createdActions.length,
    best_practices: [
      "UI Policies are declarative - use instead of client scripts when possible",
      "Conditions can be encoded queries or scripts",
      "reverse_if_false makes policy bidirectional",
      "Order matters when multiple policies affect same field",
      "Test with different user roles and data",
    ],
  }

  if (unlinkableActions.length > 0) {
    data.warning =
      "Some actions could not be linked to the UI policy: " +
      unlinkableActions.join(", ") +
      ". Link them manually in the ServiceNow UI."
  }

  return createSuccessResult(data)
}

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const name = args.name as string
  const table = args.table as string
  const condition = (args.condition as string) || ""
  const description = (args.description as string) || ""
  const on_load = args.on_load !== false
  const reverse_if_false = args.reverse_if_false !== false
  const active = args.active !== false
  const rawActions = (args.actions as Array<Record<string, unknown>>) || []

  try {
    if (rawActions.length === 0) {
      throw new Error("At least one action is required")
    }

    const actions = normalizeActions(rawActions)
    const normalized = { name, table, condition, description, on_load, reverse_if_false, active, actions }

    const viaScript = await createViaServerScript(context, normalized).catch(() => null)
    if (viaScript) return viaScript

    const client = await getAuthenticatedClient(context)
    return await createViaTableApi(client, normalized)
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error)
    return createErrorResult(msg)
  }
}

export const version = "2.0.0"
export const author = "Snow-Flow v8.41.17"
