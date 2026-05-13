/**
 * snow_oncall_manage - Unified On-Call Scheduling operations
 *
 * Manages ServiceNow On-Call Scheduling (OCS) artifacts: rotations
 * (cmn_rota), rotation members (cmn_rota_member), and roster assignments
 * (cmn_rota_roster). Used by ITSM teams to define who is responsible for
 * which group at which time, and to answer "who is on call right now".
 *
 * Companion to snow_create_schedule and snow_add_schedule_entry (which
 * manage the underlying cmn_schedule structures that rotations reference).
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_oncall_manage",
  description: `Unified tool for ServiceNow On-Call Scheduling. Operates over cmn_rota (rotations), cmn_rota_member (members in a rotation), and cmn_rota_roster (shift assignments) to manage who covers which group at which time.

Actions:
- list_rotations — list rotations, optionally filtered by assignment group
- get_current_oncall — resolve who is on call right now for a given rotation (queries cmn_rota_roster against the current GlideDateTime via a server-side helper)
- list_shifts — list upcoming shifts/rosters for a rotation within a time window
- swap_shift — reassign a roster entry from one rotation member to another

Use when: ITSM teams need visibility into on-call coverage, the agent must page the correct person, or a user requests a one-time shift swap. Companion to snow_create_schedule for the underlying schedule definitions.

Returns: action-specific structures. list_rotations returns rotation records with assignment_group and schedule references. get_current_oncall returns the active rotation member (sys_user link) plus the roster row that grants coverage. list_shifts returns roster rows ordered by start time. swap_shift returns the updated roster record.`,
  category: "schedules",
  subcategory: "schedules",
  use_cases: ["on-call", "scheduling", "itsm", "rosters", "rotation"],
  complexity: "intermediate",
  frequency: "medium",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "On-call action to perform",
        enum: ["list_rotations", "get_current_oncall", "list_shifts", "swap_shift"],
      },
      // Rotation identifiers
      rotation_sys_id: {
        type: "string",
        description: "[get_current_oncall/list_shifts/swap_shift] sys_id of the cmn_rota rotation",
      },
      rotation_name: {
        type: "string",
        description: "[get_current_oncall/list_shifts] Rotation name (alternative to rotation_sys_id)",
      },
      assignment_group: {
        type: "string",
        description: "[list_rotations] Filter rotations by assignment group sys_id or name",
      },
      active_only: {
        type: "boolean",
        description: "[list_rotations] Only return active rotations",
        default: true,
      },
      // Time window
      start_time: {
        type: "string",
        description: "[list_shifts] Window start in ServiceNow datetime format (YYYY-MM-DD HH:MM:SS, UTC). Defaults to now.",
      },
      end_time: {
        type: "string",
        description: "[list_shifts] Window end in ServiceNow datetime format. Defaults to start_time + 7 days.",
      },
      // SWAP_SHIFT parameters
      roster_sys_id: {
        type: "string",
        description: "[swap_shift] sys_id of the cmn_rota_roster row to reassign",
      },
      from_member_sys_id: {
        type: "string",
        description: "[swap_shift] sys_id of the cmn_rota_member currently assigned (used as a guard)",
      },
      to_member_sys_id: {
        type: "string",
        description: "[swap_shift] sys_id of the cmn_rota_member taking the shift",
      },
      reason: {
        type: "string",
        description: "[swap_shift] Optional reason recorded on the roster row",
      },
      // Common
      limit: {
        type: "number",
        description: "[list_rotations/list_shifts] Maximum records to return",
        default: 50,
      },
    },
    required: ["action"],
  },
}

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const action = args.action as string

  try {
    switch (action) {
      case "list_rotations":
        return await executeListRotations(args, context)
      case "get_current_oncall":
        return await executeGetCurrentOncall(args, context)
      case "list_shifts":
        return await executeListShifts(args, context)
      case "swap_shift":
        return await executeSwapShift(args, context)
      default:
        return createErrorResult(
          `Unknown action: ${action}. Valid actions: list_rotations, get_current_oncall, list_shifts, swap_shift`,
        )
    }
  } catch (error: unknown) {
    const err = error as Error
    return createErrorResult(
      err instanceof SnowFlowError
        ? err
        : new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, `On-call ${action} failed: ${err.message}`, {
            originalError: err,
          }),
    )
  }
}

// ==================== HELPERS ====================

async function resolveAssignmentGroupSysId(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  group: string,
): Promise<string | null> {
  // Accept either a sys_id directly or a group name.
  if (/^[0-9a-f]{32}$/i.test(group)) return group
  const response = await client.get("/api/now/table/sys_user_group", {
    params: { sysparm_query: `name=${group}`, sysparm_limit: 1, sysparm_fields: "sys_id" },
  })
  const rows = (response.data.result || []) as Array<Record<string, unknown>>
  return rows.length > 0 ? (rows[0].sys_id as string) : null
}

async function findRotation(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  sysId: string | undefined,
  name: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (sysId) {
    const direct = await client.get(`/api/now/table/cmn_rota/${sysId}`)
    if (direct.data.result && direct.data.result.sys_id) return direct.data.result
  }
  if (name) {
    const search = await client.get("/api/now/table/cmn_rota", {
      params: { sysparm_query: `name=${name}`, sysparm_limit: 1 },
    })
    const rows = (search.data.result || []) as Array<Record<string, unknown>>
    if (rows.length > 0) return rows[0]
  }
  return null
}

// ==================== LIST_ROTATIONS ====================

async function executeListRotations(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const assignment_group = args.assignment_group as string | undefined
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (active_only) queryParts.push("active=true")

  if (assignment_group) {
    const groupSysId = await resolveAssignmentGroupSysId(client, assignment_group)
    if (!groupSysId) {
      return createErrorResult(`Assignment group '${assignment_group}' not found`)
    }
    queryParts.push(`group=${groupSysId}`)
  }

  const response = await client.get("/api/now/table/cmn_rota", {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "name",
      sysparm_fields: "sys_id,name,group,schedule,active,time_zone,start_date,end_date,sys_updated_on",
    },
  })

  const rotations = ((response.data.result || []) as Array<Record<string, unknown>>).map((r) => ({
    sys_id: r.sys_id,
    name: r.name,
    group: r.group,
    schedule: r.schedule,
    time_zone: r.time_zone,
    active: r.active,
    start_date: r.start_date,
    end_date: r.end_date,
    updated_at: r.sys_updated_on,
    url: `${context.instanceUrl}/nav_to.do?uri=cmn_rota.do?sys_id=${r.sys_id}`,
  }))

  return createSuccessResult({
    action: "list_rotations",
    count: rotations.length,
    rotations,
  })
}

// ==================== GET_CURRENT_ONCALL ====================

async function executeGetCurrentOncall(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const rotation_sys_id = args.rotation_sys_id as string | undefined
  const rotation_name = args.rotation_name as string | undefined

  if (!rotation_sys_id && !rotation_name) {
    return createErrorResult("rotation_sys_id or rotation_name is required for get_current_oncall action")
  }

  const client = await getAuthenticatedClient(context)
  const rotation = await findRotation(client, rotation_sys_id, rotation_name)
  if (!rotation) {
    return createErrorResult(`Rotation not found: ${rotation_sys_id || rotation_name}`)
  }

  const rotationSysId = rotation.sys_id as string

  // Find the roster row whose window covers "now" and that points at an active member.
  // Use an encoded query that combines start_date_time <= now and end_date_time >= now.
  // The platform's exact column names on cmn_rota_roster vary slightly across releases;
  // we use the documented start_date_time / end_date_time pair.
  // TODO: verify column names against a live instance.
  const rosterResponse = await client.get("/api/now/table/cmn_rota_roster", {
    params: {
      sysparm_query: `rota=${rotationSysId}^start_date_time<=javascript:gs.nowDateTime()^end_date_time>=javascript:gs.nowDateTime()`,
      sysparm_limit: 5,
      sysparm_orderby: "start_date_time",
    },
  })

  const rosterRows = (rosterResponse.data.result || []) as Array<Record<string, unknown>>
  if (rosterRows.length === 0) {
    return createSuccessResult({
      action: "get_current_oncall",
      rotation: { sys_id: rotationSysId, name: rotation.name },
      on_call: null,
      message: "No active roster entry covers the current time for this rotation.",
    })
  }

  // The roster row references a cmn_rota_member; the member references a sys_user.
  // Resolve them in turn for a useful payload.
  const primary = rosterRows[0]
  const memberRef = primary.member
  const memberSysId =
    typeof memberRef === "string"
      ? memberRef
      : memberRef && typeof memberRef === "object" && "value" in memberRef
        ? (memberRef as { value: string }).value
        : null

  let member: Record<string, unknown> | null = null
  let user: Record<string, unknown> | null = null
  if (memberSysId) {
    const memberResponse = await client.get(`/api/now/table/cmn_rota_member/${memberSysId}`)
    member = (memberResponse.data.result as Record<string, unknown>) ?? null

    const userRef = member?.user
    const userSysId =
      typeof userRef === "string"
        ? userRef
        : userRef && typeof userRef === "object" && "value" in userRef
          ? (userRef as { value: string }).value
          : null
    if (userSysId) {
      const userResponse = await client.get(`/api/now/table/sys_user/${userSysId}`, {
        params: { sysparm_fields: "sys_id,user_name,name,email,phone,active" },
      })
      user = (userResponse.data.result as Record<string, unknown>) ?? null
    }
  }

  return createSuccessResult({
    action: "get_current_oncall",
    rotation: { sys_id: rotationSysId, name: rotation.name },
    on_call: {
      roster_sys_id: primary.sys_id,
      member: member
        ? { sys_id: member.sys_id, order: member.order, escalation_step: member.escalation_step }
        : null,
      user,
      window: {
        start: primary.start_date_time,
        end: primary.end_date_time,
      },
    },
    additional_rosters: rosterRows.slice(1).map((r) => ({
      roster_sys_id: r.sys_id,
      start: r.start_date_time,
      end: r.end_date_time,
    })),
  })
}

// ==================== LIST_SHIFTS ====================

async function executeListShifts(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const rotation_sys_id = args.rotation_sys_id as string | undefined
  const rotation_name = args.rotation_name as string | undefined
  const start_time = args.start_time as string | undefined
  const end_time = args.end_time as string | undefined
  const limit = (args.limit as number) || 50

  const client = await getAuthenticatedClient(context)
  const rotation = await findRotation(client, rotation_sys_id, rotation_name)
  if (!rotation) {
    return createErrorResult(`Rotation not found: ${rotation_sys_id || rotation_name}`)
  }

  const rotationSysId = rotation.sys_id as string

  // Default window: from now to now+7d, expressed as javascript: clauses so the
  // server evaluates them in the instance's timezone.
  const startClause = start_time ? `start_date_time>=${start_time}` : `start_date_time>=javascript:gs.nowDateTime()`
  const endClause = end_time
    ? `end_date_time<=${end_time}`
    : `end_date_time<=javascript:gs.daysAgoEnd(-7)`

  const response = await client.get("/api/now/table/cmn_rota_roster", {
    params: {
      sysparm_query: `rota=${rotationSysId}^${startClause}^${endClause}`,
      sysparm_limit: limit,
      sysparm_orderby: "start_date_time",
      sysparm_fields: "sys_id,member,start_date_time,end_date_time,override,override_reason",
    },
  })

  const shifts = ((response.data.result || []) as Array<Record<string, unknown>>).map((r) => ({
    sys_id: r.sys_id,
    member: r.member,
    start_date_time: r.start_date_time,
    end_date_time: r.end_date_time,
    override: r.override,
    override_reason: r.override_reason,
  }))

  return createSuccessResult({
    action: "list_shifts",
    rotation: { sys_id: rotationSysId, name: rotation.name },
    window: {
      start: start_time || "now",
      end: end_time || "now + 7 days",
    },
    count: shifts.length,
    shifts,
  })
}

// ==================== SWAP_SHIFT ====================

async function executeSwapShift(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const roster_sys_id = args.roster_sys_id as string | undefined
  const from_member_sys_id = args.from_member_sys_id as string | undefined
  const to_member_sys_id = args.to_member_sys_id as string | undefined
  const reason = args.reason as string | undefined

  if (!roster_sys_id) return createErrorResult("roster_sys_id is required for swap_shift action")
  if (!to_member_sys_id) return createErrorResult("to_member_sys_id is required for swap_shift action")

  const client = await getAuthenticatedClient(context)

  // Optional safety check: confirm the current member matches from_member_sys_id when provided.
  const currentResponse = await client.get(`/api/now/table/cmn_rota_roster/${roster_sys_id}`)
  const current = currentResponse.data.result as Record<string, unknown> | undefined
  if (!current || !current.sys_id) {
    return createErrorResult(`Roster row ${roster_sys_id} not found`)
  }

  if (from_member_sys_id) {
    const currentMember = current.member
    const currentMemberId =
      typeof currentMember === "string"
        ? currentMember
        : currentMember && typeof currentMember === "object" && "value" in currentMember
          ? (currentMember as { value: string }).value
          : null
    if (currentMemberId !== from_member_sys_id) {
      return createErrorResult(
        `Current roster member (${currentMemberId}) does not match expected from_member_sys_id (${from_member_sys_id})`,
      )
    }
  }

  // Apply the swap. We mark the roster row as an override and record the reason.
  // TODO: verify override/override_reason field names against a live instance.
  const patchPayload: Record<string, unknown> = {
    member: to_member_sys_id,
    override: true,
  }
  if (reason) patchPayload.override_reason = reason

  const updateResponse = await client.patch(`/api/now/table/cmn_rota_roster/${roster_sys_id}`, patchPayload)
  const updated = updateResponse.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "swap_shift",
    swapped: true,
    roster_sys_id,
    previous_member: from_member_sys_id || current.member,
    new_member: to_member_sys_id,
    roster: updated,
    url: `${context.instanceUrl}/nav_to.do?uri=cmn_rota_roster.do?sys_id=${roster_sys_id}`,
  })
}

export const version = "1.0.0"
export const author = "groeimetai"
