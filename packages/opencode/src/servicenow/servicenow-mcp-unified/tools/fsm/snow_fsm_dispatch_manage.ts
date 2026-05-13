/**
 * snow_fsm_dispatch_manage - Unified Field Service Management dispatch
 * workflow tool.
 *
 * Wraps the wm_agent (field technician), wm_dispatch_group, wm_skill
 * and wm_qualification tables installed by the Field Service Management
 * plugin (com.snc.work_management). Used by the dispatch workflow to
 * find the right technician for a work order based on skill, group and
 * availability.
 *
 * Notes:
 * - `suggest_agent` is a read-only smart query: it filters wm_agent by
 *   a required skill (via wm_qualification) and an availability window.
 *   It deliberately does NOT call FSM's AI dispatch / scheduling
 *   engines — those are separate plugins. The caller should treat the
 *   result as a candidate list, not a binding assignment.
 *
 * Greenfield: this is the first FSM coverage in the repo. Column names
 * are best-effort against the documented FSM data model — verify
 * against a live instance with com.snc.work_management activated
 * before relying on the smart-query output.
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"

const AGENT_TABLE = "wm_agent"
const DISPATCH_GROUP_TABLE = "wm_dispatch_group"
const SKILL_TABLE = "wm_skill"
const QUALIFICATION_TABLE = "wm_qualification"
const WORK_ORDER_TABLE = "wm_order"
const FSM_PLUGIN = "com.snc.work_management"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_fsm_dispatch_manage",
  description: `Unified tool for ServiceNow Field Service Management dispatch operations. Wraps the wm_agent, wm_dispatch_group, wm_skill and wm_qualification tables installed by the Field Service Management plugin (com.snc.work_management).

Actions:
- list_agents — list wm_agent rows (field technicians), optionally filtered by dispatch_group, skill, location or active flag
- list_groups — list wm_dispatch_group rows
- assign_agent — set a work order's assigned_to (and optionally assignment_group). Convenience wrapper for the same operation in snow_fsm_work_order_manage, scoped to dispatch workflows
- suggest_agent — read-only smart query that returns candidate agents filtered by required skill, dispatch group, and an availability window. Does NOT call FSM's AI dispatch engine
- check_availability — list agents whose schedule has no overlapping work orders during the given window

Use when: the agent needs to discover technicians for a work order, audit dispatch group membership, or pre-filter candidates before opening the Dispatcher Workspace. Requires the Field Service Management plugin (com.snc.work_management) — every action surfaces a clear PLUGIN_MISSING error if wm_agent is absent.

Returns: agent records with sys_id, name, user (sys_user reference), dispatch_group, location, active. Group records include sys_id, name, location and parent group. Suggestions include the matching skill, group membership flag, and a "reasons" array describing why the candidate matched.`,
  category: "itsm",
  subcategory: "field-service",
  use_cases: ["field-service", "dispatch", "scheduling", "technician", "fsm"],
  complexity: "intermediate",
  frequency: "medium",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "Management action to perform",
        enum: ["list_agents", "list_groups", "assign_agent", "suggest_agent", "check_availability"],
      },
      // Filters / identifiers
      dispatch_group: {
        type: "string",
        description: "[list_agents/suggest_agent/check_availability] Filter agents by wm_dispatch_group (sys_id or name)",
      },
      skill: {
        type: "string",
        description: "[list_agents/suggest_agent] Filter agents by required skill (wm_skill sys_id or name) — joined through wm_qualification",
      },
      location: {
        type: "string",
        description: "[list_agents/suggest_agent] Filter agents by location (cmn_location sys_id or name)",
      },
      active_only: {
        type: "boolean",
        description: "[list_agents/list_groups/suggest_agent/check_availability] Only return active rows",
        default: true,
      },
      // ASSIGN_AGENT fields
      work_order_sys_id: {
        type: "string",
        description: "[assign_agent] sys_id of the wm_order to assign",
      },
      work_order_number: {
        type: "string",
        description: "[assign_agent] number of the wm_order (used when work_order_sys_id is absent)",
      },
      agent: {
        type: "string",
        description: "[assign_agent] wm_agent sys_id or referenced sys_user sys_id/user_name to assign as assigned_to on the work order",
      },
      assignment_group: {
        type: "string",
        description: "[assign_agent] Optional sys_user_group sys_id or name to set on the work order",
      },
      // AVAILABILITY / SUGGEST window
      window_start: {
        type: "string",
        description: "[suggest_agent/check_availability] Window start datetime (YYYY-MM-DD HH:MM:SS in instance TZ)",
      },
      window_end: {
        type: "string",
        description: "[suggest_agent/check_availability] Window end datetime (YYYY-MM-DD HH:MM:SS in instance TZ)",
      },
      limit: {
        type: "number",
        description: "[list_agents/list_groups/suggest_agent/check_availability] Maximum records to return",
        default: 50,
      },
      fields: {
        type: "string",
        description: "[list_agents/list_groups] Comma-separated list of fields to return (defaults to a curated set)",
      },
    },
    required: ["action"],
  },
}

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const action = args.action as string

  try {
    switch (action) {
      case "list_agents":
        return await executeListAgents(args, context)
      case "list_groups":
        return await executeListGroups(args, context)
      case "assign_agent":
        return await executeAssignAgent(args, context)
      case "suggest_agent":
        return await executeSuggestAgent(args, context)
      case "check_availability":
        return await executeCheckAvailability(args, context)
      default:
        return createErrorResult(
          `Unknown action: ${action}. Valid actions: list_agents, list_groups, assign_agent, suggest_agent, check_availability`,
        )
    }
  } catch (error: unknown) {
    const err = error as Error
    const wrapped = wrapFsmError(err, action)
    return createErrorResult(wrapped)
  }
}

// ==================== HELPERS ====================

function wrapFsmError(err: Error, action: string): SnowFlowError {
  const msg = err.message || ""
  if (msg.indexOf("Invalid table") !== -1 || msg.indexOf("404") !== -1) {
    return new SnowFlowError(
      ErrorType.PLUGIN_MISSING,
      `Field Service Management tables are not available on this instance. Activate the Field Service Management plugin (${FSM_PLUGIN}) and retry.`,
      { details: { plugin: FSM_PLUGIN, originalMessage: msg } },
    )
  }
  if (err instanceof SnowFlowError) return err
  return new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, `FSM dispatch ${action} failed: ${msg}`, {
    originalError: err,
  })
}

async function resolveDispatchGroupSysId(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  ref: string,
): Promise<string | null> {
  // Accept either a sys_id (32-char hex) or a name lookup.
  if (/^[0-9a-f]{32}$/i.test(ref)) return ref
  const response = await client.get(`/api/now/table/${DISPATCH_GROUP_TABLE}`, {
    params: { sysparm_query: `name=${ref}`, sysparm_fields: "sys_id", sysparm_limit: 1 },
  })
  const rows = (response.data.result || []) as Array<Record<string, unknown>>
  if (rows.length > 0 && typeof rows[0].sys_id === "string") return rows[0].sys_id as string
  return null
}

async function resolveSkillSysId(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  ref: string,
): Promise<string | null> {
  if (/^[0-9a-f]{32}$/i.test(ref)) return ref
  const response = await client.get(`/api/now/table/${SKILL_TABLE}`, {
    params: { sysparm_query: `name=${ref}`, sysparm_fields: "sys_id", sysparm_limit: 1 },
  })
  const rows = (response.data.result || []) as Array<Record<string, unknown>>
  if (rows.length > 0 && typeof rows[0].sys_id === "string") return rows[0].sys_id as string
  return null
}

// ==================== LIST_AGENTS ====================

async function executeListAgents(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const dispatch_group = args.dispatch_group as string | undefined
  const skill = args.skill as string | undefined
  const location = args.location as string | undefined
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50
  // TODO: verify wm_agent column names on a live instance — some
  // variants expose `user` as the sys_user reference, others use
  // `agent` or rely on extending sys_user directly.
  const fields =
    (args.fields as string) || "sys_id,name,user,dispatch_group,location,active,sys_updated_on"

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (active_only) queryParts.push("active=true")
  if (dispatch_group) {
    const groupSysId = await resolveDispatchGroupSysId(client, dispatch_group)
    if (groupSysId) queryParts.push(`dispatch_group=${groupSysId}`)
  }
  if (location) queryParts.push(`location=${location}`)

  // If a skill was requested, resolve agents that hold the matching
  // qualification first, then scope the wm_agent query to those sys_ids.
  if (skill) {
    const skillSysId = await resolveSkillSysId(client, skill)
    if (!skillSysId) {
      return createSuccessResult({ action: "list_agents", count: 0, agents: [], note: `Skill not found: ${skill}` })
    }
    const qualifications = await client.get(`/api/now/table/${QUALIFICATION_TABLE}`, {
      params: {
        sysparm_query: `skill=${skillSysId}`,
        sysparm_fields: "agent",
        sysparm_limit: 500,
      },
    })
    const agentRefs = ((qualifications.data.result || []) as Array<Record<string, unknown>>)
      .map((row) => {
        const ref = row.agent
        if (typeof ref === "string") return ref
        if (ref && typeof ref === "object" && "value" in ref) return (ref as { value: string }).value
        return null
      })
      .filter((v): v is string => typeof v === "string" && v.length > 0)
    if (agentRefs.length === 0) {
      return createSuccessResult({ action: "list_agents", count: 0, agents: [], note: "No agents hold this skill" })
    }
    queryParts.push(`sys_idIN${agentRefs.join(",")}`)
  }

  const response = await client.get(`/api/now/table/${AGENT_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "name",
      sysparm_fields: fields,
    },
  })

  const agents = (response.data.result || []) as Array<Record<string, unknown>>

  return createSuccessResult({
    action: "list_agents",
    count: agents.length,
    agents: agents.map((a) => ({
      sys_id: a.sys_id,
      name: a.name,
      user: a.user,
      dispatch_group: a.dispatch_group,
      location: a.location,
      active: a.active,
      updated_at: a.sys_updated_on,
      url: `${context.instanceUrl}/nav_to.do?uri=${AGENT_TABLE}.do?sys_id=${a.sys_id}`,
    })),
  })
}

// ==================== LIST_GROUPS ====================

async function executeListGroups(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50
  // TODO: verify wm_dispatch_group columns — some variants expose
  // `parent` and `location`, others only carry a name + active flag.
  const fields = (args.fields as string) || "sys_id,name,parent,location,active,sys_updated_on"

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (active_only) queryParts.push("active=true")

  const response = await client.get(`/api/now/table/${DISPATCH_GROUP_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "name",
      sysparm_fields: fields,
    },
  })

  const groups = (response.data.result || []) as Array<Record<string, unknown>>

  return createSuccessResult({
    action: "list_groups",
    count: groups.length,
    groups: groups.map((g) => ({
      sys_id: g.sys_id,
      name: g.name,
      parent: g.parent,
      location: g.location,
      active: g.active,
      updated_at: g.sys_updated_on,
      url: `${context.instanceUrl}/nav_to.do?uri=${DISPATCH_GROUP_TABLE}.do?sys_id=${g.sys_id}`,
    })),
  })
}

// ==================== ASSIGN_AGENT ====================

async function executeAssignAgent(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const work_order_sys_id = args.work_order_sys_id as string | undefined
  const work_order_number = args.work_order_number as string | undefined
  const agent = args.agent as string | undefined
  const assignment_group = args.assignment_group as string | undefined

  if (!work_order_sys_id && !work_order_number) {
    return createErrorResult("work_order_sys_id or work_order_number is required for assign_agent action")
  }
  if (!agent) {
    return createErrorResult("agent is required for assign_agent action")
  }

  const client = await getAuthenticatedClient(context)

  // Resolve work order
  let targetSysId = work_order_sys_id
  if (!targetSysId && work_order_number) {
    const response = await client.get(`/api/now/table/${WORK_ORDER_TABLE}`, {
      params: { sysparm_query: `number=${work_order_number}`, sysparm_fields: "sys_id", sysparm_limit: 1 },
    })
    const rows = (response.data.result || []) as Array<Record<string, unknown>>
    if (rows.length === 0) {
      return createErrorResult(`Work order not found: ${work_order_number}`)
    }
    targetSysId = rows[0].sys_id as string
  }

  // The `agent` parameter can be a wm_agent sys_id, a sys_user sys_id,
  // or a sys_user username. The wm_order.assigned_to column refers to
  // sys_user, so when a wm_agent sys_id is supplied we dereference it
  // first.
  let assignedToUserSysId = agent
  // Heuristic: if it looks like a sys_id, see if a wm_agent row exists
  // and use its `user` reference; otherwise treat the value as-is and
  // let the ServiceNow reference qualifier resolve it.
  if (/^[0-9a-f]{32}$/i.test(agent)) {
    try {
      const agentResponse = await client.get(`/api/now/table/${AGENT_TABLE}/${agent}`)
      const row = agentResponse.data.result as Record<string, unknown> | undefined
      if (row && row.user) {
        const userRef = row.user
        if (typeof userRef === "string") assignedToUserSysId = userRef
        else if (userRef && typeof userRef === "object" && "value" in userRef) {
          assignedToUserSysId = (userRef as { value: string }).value
        }
      }
    } catch {
      // The sys_id may belong to sys_user directly. Fall through.
    }
  }

  const patch: Record<string, unknown> = { assigned_to: assignedToUserSysId }
  if (assignment_group) patch.assignment_group = assignment_group

  const response = await client.patch(`/api/now/table/${WORK_ORDER_TABLE}/${targetSysId}`, patch)
  const updated = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "assign_agent",
    assigned: true,
    sys_id: targetSysId,
    number: updated.number,
    assigned_to: updated.assigned_to,
    assignment_group: updated.assignment_group,
    work_order: updated,
    url: `${context.instanceUrl}/nav_to.do?uri=${WORK_ORDER_TABLE}.do?sys_id=${targetSysId}`,
  })
}

// ==================== SUGGEST_AGENT ====================

async function executeSuggestAgent(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const skill = args.skill as string | undefined
  const dispatch_group = args.dispatch_group as string | undefined
  const location = args.location as string | undefined
  const window_start = args.window_start as string | undefined
  const window_end = args.window_end as string | undefined
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50

  const client = await getAuthenticatedClient(context)

  // Resolve required skill (when supplied) into the set of qualified agents.
  let qualifiedAgentSysIds: string[] | null = null
  let resolvedSkillSysId: string | null = null
  if (skill) {
    resolvedSkillSysId = await resolveSkillSysId(client, skill)
    if (!resolvedSkillSysId) {
      return createSuccessResult({
        action: "suggest_agent",
        count: 0,
        candidates: [],
        note: `Skill not found: ${skill}`,
      })
    }
    const qualifications = await client.get(`/api/now/table/${QUALIFICATION_TABLE}`, {
      params: { sysparm_query: `skill=${resolvedSkillSysId}`, sysparm_fields: "agent", sysparm_limit: 500 },
    })
    qualifiedAgentSysIds = ((qualifications.data.result || []) as Array<Record<string, unknown>>)
      .map((row) => {
        const ref = row.agent
        if (typeof ref === "string") return ref
        if (ref && typeof ref === "object" && "value" in ref) return (ref as { value: string }).value
        return null
      })
      .filter((v): v is string => typeof v === "string" && v.length > 0)
    if (qualifiedAgentSysIds.length === 0) {
      return createSuccessResult({
        action: "suggest_agent",
        count: 0,
        candidates: [],
        note: "No agents hold the requested skill",
      })
    }
  }

  const queryParts: string[] = []
  if (active_only) queryParts.push("active=true")
  if (qualifiedAgentSysIds && qualifiedAgentSysIds.length > 0) {
    queryParts.push(`sys_idIN${qualifiedAgentSysIds.join(",")}`)
  }
  if (dispatch_group) {
    const groupSysId = await resolveDispatchGroupSysId(client, dispatch_group)
    if (groupSysId) queryParts.push(`dispatch_group=${groupSysId}`)
  }
  if (location) queryParts.push(`location=${location}`)

  const agentResponse = await client.get(`/api/now/table/${AGENT_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "name",
      sysparm_fields: "sys_id,name,user,dispatch_group,location,active",
    },
  })
  const candidates = (agentResponse.data.result || []) as Array<Record<string, unknown>>

  // For each candidate, check whether they have any overlapping wm_order
  // rows in the supplied window. We treat absence of overlap as a positive
  // signal but do NOT filter out candidates that have overlap — the caller
  // decides whether to honor it.
  const enriched: Array<Record<string, unknown>> = []
  for (const candidate of candidates) {
    const userRef = candidate.user
    const userSysId =
      typeof userRef === "string"
        ? userRef
        : userRef && typeof userRef === "object" && "value" in userRef
          ? (userRef as { value: string }).value
          : null

    const reasons: string[] = []
    if (resolvedSkillSysId) reasons.push("matches required skill")
    if (dispatch_group) reasons.push("belongs to requested dispatch group")
    if (location) reasons.push("located in requested area")

    let overlappingWorkOrders = 0
    if (userSysId && window_start && window_end) {
      try {
        const overlap = await client.get(`/api/now/table/${WORK_ORDER_TABLE}`, {
          params: {
            sysparm_query: `assigned_to=${userSysId}^work_start<${window_end}^work_end>${window_start}`,
            sysparm_fields: "sys_id",
            sysparm_limit: 5,
          },
        })
        overlappingWorkOrders = ((overlap.data.result || []) as Array<unknown>).length
        if (overlappingWorkOrders === 0) reasons.push("no scheduling conflict in window")
      } catch {
        // Window check is best-effort. A failure here should not block the suggestion.
      }
    }

    enriched.push({
      sys_id: candidate.sys_id,
      name: candidate.name,
      user: candidate.user,
      dispatch_group: candidate.dispatch_group,
      location: candidate.location,
      overlapping_work_orders: overlappingWorkOrders,
      reasons,
    })
  }

  return createSuccessResult({
    action: "suggest_agent",
    count: enriched.length,
    window: window_start && window_end ? { start: window_start, end: window_end } : null,
    skill: resolvedSkillSysId ? { sys_id: resolvedSkillSysId, label: skill } : null,
    candidates: enriched,
    note: "Read-only candidate list — does not call FSM AI dispatch/scheduling engines.",
  })
}

// ==================== CHECK_AVAILABILITY ====================

async function executeCheckAvailability(
  args: Record<string, unknown>,
  context: ServiceNowContext,
): Promise<ToolResult> {
  const dispatch_group = args.dispatch_group as string | undefined
  const window_start = args.window_start as string | undefined
  const window_end = args.window_end as string | undefined
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50

  if (!window_start || !window_end) {
    return createErrorResult("window_start and window_end are required for check_availability action")
  }

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (active_only) queryParts.push("active=true")
  if (dispatch_group) {
    const groupSysId = await resolveDispatchGroupSysId(client, dispatch_group)
    if (groupSysId) queryParts.push(`dispatch_group=${groupSysId}`)
  }

  const agentResponse = await client.get(`/api/now/table/${AGENT_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "name",
      sysparm_fields: "sys_id,name,user,dispatch_group,location,active",
    },
  })
  const agents = (agentResponse.data.result || []) as Array<Record<string, unknown>>

  const availability: Array<Record<string, unknown>> = []
  for (const agent of agents) {
    const userRef = agent.user
    const userSysId =
      typeof userRef === "string"
        ? userRef
        : userRef && typeof userRef === "object" && "value" in userRef
          ? (userRef as { value: string }).value
          : null

    let overlappingCount = 0
    let overlappingOrders: Array<Record<string, unknown>> = []
    if (userSysId) {
      try {
        const overlap = await client.get(`/api/now/table/${WORK_ORDER_TABLE}`, {
          params: {
            sysparm_query: `assigned_to=${userSysId}^work_start<${window_end}^work_end>${window_start}`,
            sysparm_fields: "sys_id,number,short_description,work_start,work_end",
            sysparm_limit: 5,
          },
        })
        overlappingOrders = (overlap.data.result || []) as Array<Record<string, unknown>>
        overlappingCount = overlappingOrders.length
      } catch {
        // Swallow — agent stays in the list with "unknown" overlap.
      }
    }

    availability.push({
      sys_id: agent.sys_id,
      name: agent.name,
      user: agent.user,
      dispatch_group: agent.dispatch_group,
      location: agent.location,
      available: overlappingCount === 0,
      overlapping_work_orders: overlappingOrders,
    })
  }

  return createSuccessResult({
    action: "check_availability",
    count: availability.length,
    available_count: availability.filter((a) => a.available === true).length,
    window: { start: window_start, end: window_end },
    agents: availability,
  })
}

export const version = "1.0.0"
export const author = "groeimetai"
