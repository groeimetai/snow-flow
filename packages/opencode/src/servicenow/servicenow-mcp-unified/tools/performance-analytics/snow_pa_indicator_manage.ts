/**
 * snow_pa_indicator_manage - Unified Performance Analytics indicator management
 *
 * Manages the lifecycle of Performance Analytics indicator definitions
 * (pa_indicators) and their associated breakdowns (pa_breakdowns). Indicator
 * widgets (pa_widgets) and sampled scores (pa_scores) are referenced for read
 * context but are not authored directly by this tool — snow_pa_create handles
 * widget authoring, and scores are computed by the platform.
 *
 * Companion to snow_pa_create (which creates the broader PA artifact family)
 * and snow_pa_operate (which collects and inspects PA data).
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_pa_indicator_manage",
  description: `Unified tool for ServiceNow Performance Analytics indicator definitions and their dimensional breakdowns. Wraps the pa_indicators, pa_breakdowns, pa_widgets, and pa_scores tables on the platform.

Actions:
- list — list indicators, optionally filtered by facts_table or active flag
- get — retrieve a single indicator by sys_id or name (includes related widget and breakdown counts)
- create — create a new indicator (name, facts_table, aggregate, field required)
- update — patch indicator fields
- delete — remove an indicator (and optionally its dependent breakdowns)
- add_breakdown — attach a dimensional breakdown to an indicator (writes pa_breakdowns)
- list_breakdowns — list breakdowns for a given indicator or globally

Use when: the agent needs to manage KPI/indicator definitions, attach dimensional slicers (assignment_group, priority, location, etc.) to existing indicators, or audit which indicators a facts table feeds.

Returns: indicator records with sys_id, name, facts_table, aggregate, field, frequency, unit, and active flag. For breakdowns, returns sys_id, name, table, field, and matrix_source. Companion tools: snow_pa_create for full PA artifact creation (widgets, thresholds, scheduled reports) and snow_pa_operate for collecting and querying PA scores.`,
  category: "performance-analytics",
  subcategory: "performance-analytics",
  use_cases: ["performance-analytics", "kpi", "indicators", "breakdowns", "reporting"],
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
        enum: ["list", "get", "create", "update", "delete", "add_breakdown", "list_breakdowns"],
      },
      // Identifiers
      sys_id: {
        type: "string",
        description: "[get/update/delete/add_breakdown/list_breakdowns] Indicator sys_id",
      },
      name: {
        type: "string",
        description: "[get/create/update] Indicator name (used as identifier when sys_id is absent)",
      },
      // CREATE/UPDATE fields
      label: {
        type: "string",
        description: "[create/update] Indicator display label (defaults to name on create)",
      },
      description: {
        type: "string",
        description: "[create/update] Indicator description",
      },
      facts_table: {
        type: "string",
        description: "[create/update] Source/facts table the indicator measures (e.g. incident, sc_task)",
      },
      aggregate: {
        type: "string",
        description: "[create/update] Aggregation function",
        enum: ["COUNT", "SUM", "AVG", "MIN", "MAX", "COUNT_DISTINCT"],
      },
      field: {
        type: "string",
        description: "[create/update] Field on facts_table to aggregate (omit for COUNT)",
      },
      conditions: {
        type: "string",
        description: "[create/update] Encoded query that filters the facts_table rows",
      },
      unit: {
        type: "string",
        description: "[create/update] Unit of measurement (count, hours, percent, etc.)",
      },
      frequency: {
        type: "string",
        description: "[create/update] Collection frequency",
        enum: ["daily", "weekly", "monthly", "quarterly", "yearly", "hourly"],
      },
      direction: {
        type: "string",
        description: "[create/update] Whether higher or lower is better",
        enum: ["maximize", "minimize"],
      },
      precision: {
        type: "number",
        description: "[create/update] Decimal precision",
      },
      active: {
        type: "boolean",
        description: "[create/update] Whether the indicator is active",
        default: true,
      },
      // BREAKDOWN fields (for add_breakdown)
      breakdown_name: {
        type: "string",
        description: "[add_breakdown] Breakdown name",
      },
      breakdown_table: {
        type: "string",
        description: "[add_breakdown] Table on which the breakdown is evaluated",
      },
      breakdown_field: {
        type: "string",
        description: "[add_breakdown] Field used to group the indicator (e.g. assignment_group, priority)",
      },
      related_field: {
        type: "string",
        description: "[add_breakdown] Related field path for cross-table breakdowns",
      },
      matrix_source: {
        type: "boolean",
        description: "[add_breakdown] Whether this is a matrix breakdown",
        default: false,
      },
      // DELETE
      cascade: {
        type: "boolean",
        description: "[delete] Also remove dependent pa_breakdowns rows that reference this indicator",
        default: false,
      },
      // LIST/LIST_BREAKDOWNS
      active_only: {
        type: "boolean",
        description: "[list/list_breakdowns] Only return active records",
        default: false,
      },
      limit: {
        type: "number",
        description: "[list/list_breakdowns] Maximum records to return",
        default: 50,
      },
      fields: {
        type: "string",
        description: "[list/get/list_breakdowns] Comma-separated list of fields to return",
      },
    },
    required: ["action"],
  },
}

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const action = args.action as string

  try {
    switch (action) {
      case "list":
        return await executeList(args, context)
      case "get":
        return await executeGet(args, context)
      case "create":
        return await executeCreate(args, context)
      case "update":
        return await executeUpdate(args, context)
      case "delete":
        return await executeDelete(args, context)
      case "add_breakdown":
        return await executeAddBreakdown(args, context)
      case "list_breakdowns":
        return await executeListBreakdowns(args, context)
      default:
        return createErrorResult(
          `Unknown action: ${action}. Valid actions: list, get, create, update, delete, add_breakdown, list_breakdowns`,
        )
    }
  } catch (error: unknown) {
    const err = error as Error
    return createErrorResult(
      err instanceof SnowFlowError
        ? err
        : new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, `PA indicator ${action} failed: ${err.message}`, {
            originalError: err,
          }),
    )
  }
}

// ==================== HELPERS ====================

async function findIndicator(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  sysId: string | undefined,
  name: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (sysId) {
    const direct = await client.get(`/api/now/table/pa_indicators/${sysId}`)
    if (direct.data.result && direct.data.result.sys_id) {
      return direct.data.result
    }
  }
  if (name) {
    const search = await client.get("/api/now/table/pa_indicators", {
      params: {
        sysparm_query: `name=${name}`,
        sysparm_limit: 1,
      },
    })
    const results = search.data.result || []
    if (results.length > 0) return results[0]
  }
  return null
}

// ==================== LIST ====================

async function executeList(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const facts_table = args.facts_table as string | undefined
  const active_only = args.active_only === true
  const limit = (args.limit as number) || 50
  const fields = args.fields as string | undefined

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (facts_table) queryParts.push(`facts_table=${facts_table}`)
  if (active_only) queryParts.push("active=true")

  const response = await client.get("/api/now/table/pa_indicators", {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "name",
      ...(fields ? { sysparm_fields: fields } : { sysparm_fields: "sys_id,name,label,facts_table,aggregate,field,frequency,unit,active,sys_updated_on" }),
    },
  })

  const results = (response.data.result || []) as Array<Record<string, unknown>>

  return createSuccessResult({
    action: "list",
    count: results.length,
    indicators: results.map((r) => ({
      sys_id: r.sys_id,
      name: r.name,
      label: r.label,
      facts_table: r.facts_table,
      aggregate: r.aggregate,
      field: r.field,
      frequency: r.frequency,
      unit: r.unit,
      active: r.active,
      updated_at: r.sys_updated_on,
      url: `${context.instanceUrl}/nav_to.do?uri=pa_indicators.do?sys_id=${r.sys_id}`,
    })),
  })
}

// ==================== GET ====================

async function executeGet(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const name = args.name as string | undefined

  if (!sys_id && !name) {
    return createErrorResult("sys_id or name is required for get action")
  }

  const client = await getAuthenticatedClient(context)
  const indicator = await findIndicator(client, sys_id, name)
  if (!indicator) {
    return createErrorResult(`Indicator not found: ${sys_id || name}`)
  }

  const indicatorSysId = indicator.sys_id as string

  // Count related breakdowns and widgets for context (best-effort, swallow errors)
  let breakdownCount = 0
  let widgetCount = 0
  try {
    const breakdowns = await client.get("/api/now/table/pa_breakdowns_indicator", {
      params: { sysparm_query: `indicator=${indicatorSysId}`, sysparm_fields: "sys_id", sysparm_limit: 200 },
    })
    breakdownCount = (breakdowns.data.result || []).length
  } catch {
    // TODO: verify pa_breakdowns_indicator join table name on a live instance
  }
  try {
    const widgets = await client.get("/api/now/table/pa_widgets", {
      params: { sysparm_query: `indicator=${indicatorSysId}`, sysparm_fields: "sys_id", sysparm_limit: 200 },
    })
    widgetCount = (widgets.data.result || []).length
  } catch {
    // pa_widgets may carry the indicator on a different column on older instances
  }

  return createSuccessResult({
    action: "get",
    sys_id: indicatorSysId,
    name: indicator.name,
    indicator,
    related: {
      breakdown_count: breakdownCount,
      widget_count: widgetCount,
    },
    url: `${context.instanceUrl}/nav_to.do?uri=pa_indicators.do?sys_id=${indicatorSysId}`,
  })
}

// ==================== CREATE ====================

async function executeCreate(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const name = args.name as string | undefined
  const facts_table = args.facts_table as string | undefined
  const aggregate = args.aggregate as string | undefined
  const field = args.field as string | undefined

  if (!name) return createErrorResult("name is required for create action")
  if (!facts_table) return createErrorResult("facts_table is required for create action")
  if (!aggregate) return createErrorResult("aggregate is required for create action")
  if (aggregate !== "COUNT" && !field) {
    return createErrorResult("field is required when aggregate is not COUNT")
  }

  const client = await getAuthenticatedClient(context)

  // Reject duplicates by name
  const existing = await client.get("/api/now/table/pa_indicators", {
    params: { sysparm_query: `name=${name}`, sysparm_limit: 1, sysparm_fields: "sys_id" },
  })
  if ((existing.data.result || []).length > 0) {
    return createErrorResult(`Indicator '${name}' already exists. Use action='update' to modify it.`)
  }

  const payload: Record<string, unknown> = {
    name,
    label: (args.label as string) || name,
    description: (args.description as string) || "",
    facts_table,
    aggregate: aggregate.toUpperCase(),
    active: args.active === undefined ? true : args.active,
  }
  if (field) payload.field = field
  if (args.conditions) payload.conditions = args.conditions
  if (args.unit) payload.unit = args.unit
  if (args.frequency) payload.frequency = args.frequency
  if (args.direction) payload.direction = args.direction
  if (args.precision !== undefined) payload.precision = args.precision

  const response = await client.post("/api/now/table/pa_indicators", payload)
  const created = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "create",
    created: true,
    sys_id: created.sys_id,
    name: created.name,
    indicator: created,
    url: `${context.instanceUrl}/nav_to.do?uri=pa_indicators.do?sys_id=${created.sys_id}`,
  })
}

// ==================== UPDATE ====================

async function executeUpdate(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const name = args.name as string | undefined

  if (!sys_id && !name) {
    return createErrorResult("sys_id or name is required for update action")
  }

  const client = await getAuthenticatedClient(context)
  const indicator = await findIndicator(client, sys_id, name)
  if (!indicator) {
    return createErrorResult(`Indicator not found: ${sys_id || name}`)
  }

  const updatableFields = [
    "label",
    "description",
    "facts_table",
    "aggregate",
    "field",
    "conditions",
    "unit",
    "frequency",
    "direction",
    "precision",
    "active",
  ]
  const patch: Record<string, unknown> = {}
  for (const key of updatableFields) {
    if (args[key] !== undefined) {
      patch[key] = key === "aggregate" ? (args[key] as string).toUpperCase() : args[key]
    }
  }

  if (Object.keys(patch).length === 0) {
    return createErrorResult("No update fields provided")
  }

  const targetSysId = indicator.sys_id as string
  const response = await client.patch(`/api/now/table/pa_indicators/${targetSysId}`, patch)
  const updated = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "update",
    updated: true,
    sys_id: targetSysId,
    name: updated.name,
    updated_fields: Object.keys(patch),
    indicator: updated,
    url: `${context.instanceUrl}/nav_to.do?uri=pa_indicators.do?sys_id=${targetSysId}`,
  })
}

// ==================== DELETE ====================

async function executeDelete(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const name = args.name as string | undefined
  const cascade = args.cascade === true

  if (!sys_id && !name) {
    return createErrorResult("sys_id or name is required for delete action")
  }

  const client = await getAuthenticatedClient(context)
  const indicator = await findIndicator(client, sys_id, name)
  if (!indicator) {
    return createErrorResult(`Indicator not found: ${sys_id || name}`)
  }

  const targetSysId = indicator.sys_id as string
  const removedBreakdowns: string[] = []

  if (cascade) {
    // TODO: verify pa_breakdowns_indicator join table name on a live instance
    const breakdownLinks = await client.get("/api/now/table/pa_breakdowns_indicator", {
      params: { sysparm_query: `indicator=${targetSysId}`, sysparm_fields: "sys_id", sysparm_limit: 500 },
    })
    for (const row of (breakdownLinks.data.result || []) as Array<Record<string, unknown>>) {
      await client.delete(`/api/now/table/pa_breakdowns_indicator/${row.sys_id}`)
      removedBreakdowns.push(row.sys_id as string)
    }
  }

  await client.delete(`/api/now/table/pa_indicators/${targetSysId}`)

  return createSuccessResult({
    action: "delete",
    deleted: true,
    sys_id: targetSysId,
    name: indicator.name,
    cascaded_breakdown_links: removedBreakdowns,
  })
}

// ==================== ADD_BREAKDOWN ====================

async function executeAddBreakdown(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const indicatorName = args.name as string | undefined
  const breakdown_name = args.breakdown_name as string | undefined
  const breakdown_table = args.breakdown_table as string | undefined
  const breakdown_field = args.breakdown_field as string | undefined
  const related_field = args.related_field as string | undefined
  const matrix_source = args.matrix_source === true

  if (!sys_id && !indicatorName) {
    return createErrorResult("sys_id or name is required to identify the indicator")
  }
  if (!breakdown_name) return createErrorResult("breakdown_name is required")
  if (!breakdown_table) return createErrorResult("breakdown_table is required")
  if (!breakdown_field) return createErrorResult("breakdown_field is required")

  const client = await getAuthenticatedClient(context)
  const indicator = await findIndicator(client, sys_id, indicatorName)
  if (!indicator) {
    return createErrorResult(`Indicator not found: ${sys_id || indicatorName}`)
  }

  // Create the breakdown definition
  const breakdownPayload: Record<string, unknown> = {
    name: breakdown_name,
    table: breakdown_table,
    field: breakdown_field,
    matrix_source,
  }
  if (related_field) breakdownPayload.related_field = related_field

  const breakdownResponse = await client.post("/api/now/table/pa_breakdowns", breakdownPayload)
  const breakdown = breakdownResponse.data.result as Record<string, unknown>

  // Attach the breakdown to the indicator via the join table.
  // TODO: verify pa_breakdowns_indicator is the correct join table on a live instance.
  let linkSysId: string | null = null
  try {
    const linkResponse = await client.post("/api/now/table/pa_breakdowns_indicator", {
      indicator: indicator.sys_id,
      breakdown: breakdown.sys_id,
    })
    linkSysId = linkResponse.data.result.sys_id
  } catch (linkError: unknown) {
    const e = linkError as Error
    // Surface the failure so the caller knows the breakdown exists but isn't linked
    return createSuccessResult({
      action: "add_breakdown",
      breakdown_created: true,
      indicator_linked: false,
      sys_id: breakdown.sys_id,
      breakdown,
      warning: `Breakdown created but could not be linked to indicator: ${e.message}`,
    })
  }

  return createSuccessResult({
    action: "add_breakdown",
    breakdown_created: true,
    indicator_linked: linkSysId !== null,
    sys_id: breakdown.sys_id,
    breakdown,
    link_sys_id: linkSysId,
    indicator: { sys_id: indicator.sys_id, name: indicator.name },
  })
}

// ==================== LIST_BREAKDOWNS ====================

async function executeListBreakdowns(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const indicatorName = args.name as string | undefined
  const limit = (args.limit as number) || 50
  const fields = args.fields as string | undefined

  const client = await getAuthenticatedClient(context)

  // If an indicator is specified, return breakdowns linked to it through the join table.
  // Otherwise return all breakdowns globally.
  if (sys_id || indicatorName) {
    const indicator = await findIndicator(client, sys_id, indicatorName)
    if (!indicator) {
      return createErrorResult(`Indicator not found: ${sys_id || indicatorName}`)
    }

    // TODO: verify pa_breakdowns_indicator join table name on a live instance
    const linkResponse = await client.get("/api/now/table/pa_breakdowns_indicator", {
      params: {
        sysparm_query: `indicator=${indicator.sys_id}`,
        sysparm_limit: limit,
        sysparm_fields: "sys_id,breakdown",
      },
    })

    const breakdownIds = ((linkResponse.data.result || []) as Array<Record<string, unknown>>)
      .map((r) => {
        const ref = r.breakdown
        if (typeof ref === "string") return ref
        if (ref && typeof ref === "object" && "value" in ref) return (ref as { value: string }).value
        return null
      })
      .filter((v): v is string => typeof v === "string" && v.length > 0)

    if (breakdownIds.length === 0) {
      return createSuccessResult({
        action: "list_breakdowns",
        indicator: { sys_id: indicator.sys_id, name: indicator.name },
        count: 0,
        breakdowns: [],
      })
    }

    const breakdownsResponse = await client.get("/api/now/table/pa_breakdowns", {
      params: {
        sysparm_query: `sys_idIN${breakdownIds.join(",")}`,
        sysparm_limit: limit,
        ...(fields ? { sysparm_fields: fields } : {}),
      },
    })

    const results = (breakdownsResponse.data.result || []) as Array<Record<string, unknown>>
    return createSuccessResult({
      action: "list_breakdowns",
      indicator: { sys_id: indicator.sys_id, name: indicator.name },
      count: results.length,
      breakdowns: results,
    })
  }

  // Global listing
  const response = await client.get("/api/now/table/pa_breakdowns", {
    params: {
      sysparm_limit: limit,
      sysparm_orderby: "name",
      ...(fields ? { sysparm_fields: fields } : {}),
    },
  })

  const results = (response.data.result || []) as Array<Record<string, unknown>>
  return createSuccessResult({
    action: "list_breakdowns",
    count: results.length,
    breakdowns: results,
  })
}

export const version = "1.0.0"
export const author = "groeimetai"
