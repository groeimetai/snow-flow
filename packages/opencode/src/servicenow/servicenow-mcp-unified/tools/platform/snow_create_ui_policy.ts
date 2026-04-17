/**
 * snow_create_ui_policy - Create UI Policies
 *
 * Create declarative form behavior policies for field visibility,
 * mandatory state, and read-only control.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { linkUiPolicyReference, verifyUiPolicyLink } from "../ui-policies/link-ui-policy.js"

/**
 * Extract sys_id from API response - handles both string and object formats
 * ServiceNow Table API can return sys_id as:
 * - String: "abc123def456"
 * - Object: { value: "abc123def456", link: "...", display_value: "..." }
 */
function extractSysId(value: any): string {
  if (!value) return ""
  if (typeof value === "object" && value.value) {
    return value.value
  }
  return String(value)
}

function toActionValue(val: boolean | undefined): string {
  if (val === undefined) return "ignore"
  return val ? "true" : "false"
}

export const toolDefinition: MCPToolDefinition = {
  name: "snow_create_ui_policy",
  description: "Create UI Policy for form field control (visibility, mandatory, readonly)",
  // Metadata for tool discovery (not sent to LLM)
  category: "development",
  subcategory: "platform",
  use_cases: ["ui-policies", "form-control", "declarative-logic"],
  complexity: "intermediate",
  frequency: "high",

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
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
            field_name: { type: "string", description: "Field to control" },
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
          required: ["field_name"],
        },
      },
    },
    required: ["name", "table", "actions"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    name,
    table,
    condition = "",
    description = "",
    on_load = true,
    reverse_if_false = true,
    active = true,
    actions = [],
  } = args

  try {
    const client = await getAuthenticatedClient(context)

    if (actions.length === 0) {
      throw new Error("At least one action is required")
    }

    // Create UI Policy
    const uiPolicyData: any = {
      short_description: name,
      table,
      conditions: condition,
      description,
      on_load,
      reverse_if_false,
      active,
    }

    const policyResponse = await client.post("/api/now/table/sys_ui_policy", uiPolicyData)
    const uiPolicy = policyResponse.data.result

    // Extract the sys_id properly - API can return string or object
    const policySysId = extractSysId(uiPolicy.sys_id)

    // Create UI Policy Actions
    //
    // ServiceNow field mapping notes:
    //   - visible/mandatory/disabled are STRING fields: "true" | "false" | "ignore"
    //   - the column for "Read only" is named "disabled" (not "readonly")
    //   - "table" is required server-side; without it the action is created malformed
    //     (empty ui_policy/table) and orphaned — this was the root cause of issue #82
    const createdActions = []
    const unlinkableActions: string[] = []
    for (const action of actions) {
      const actionData: any = {
        ui_policy: policySysId,
        table,
        field: action.field_name,
        visible: toActionValue(action.visible),
        mandatory: toActionValue(action.mandatory),
        disabled: toActionValue(action.readonly),
        cleared: action.cleared === true,
      }

      const actionResponse = await client.post("/api/now/table/sys_ui_policy_action", actionData)
      const actionResult = actionResponse.data.result
      const actionSysId = extractSysId(actionResult.sys_id)

      // Verify ui_policy link; if POST didn't set it, use fallback chain
      const alreadyLinked = await verifyUiPolicyLink(client, actionSysId, policySysId)
      if (!alreadyLinked) {
        const linked = await linkUiPolicyReference(client, actionSysId, policySysId)
        if (!linked) unlinkableActions.push(action.field_name)
      }

      createdActions.push(actionResult)
    }

    const result: Record<string, any> = {
      created: true,
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
        ui_policy_linked: !unlinkableActions.includes(action.field),
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
      result.warning =
        "Some actions could not be linked to the UI policy: " +
        unlinkableActions.join(", ") +
        ". Link them manually in the ServiceNow UI."
    }

    return createSuccessResult(result)
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.1.0"
export const author = "Snow-Flow v8.41.16"
