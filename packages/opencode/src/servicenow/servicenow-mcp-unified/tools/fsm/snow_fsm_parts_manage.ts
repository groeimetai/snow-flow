/**
 * snow_fsm_parts_manage - Unified Field Service Management parts
 * management tool.
 *
 * Wraps the pc_part (Parts Catalog), wm_part_requirement (parts
 * required for a work order), pc_part_request (parts ordering) and
 * pc_stock_level tables. Used to look up parts, attach required parts
 * to a work order, request parts from a stockroom, and check stock
 * level availability.
 *
 * Greenfield: this is the first FSM coverage in the repo. Column
 * names are best-effort against the documented FSM data model — they
 * should be verified against a live instance with the Field Service
 * Management plugin (com.snc.work_management) activated before this
 * tool is trusted for write operations.
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"

const PART_TABLE = "pc_part"
const PART_REQUIREMENT_TABLE = "wm_part_requirement"
const PART_REQUEST_TABLE = "pc_part_request"
const STOCK_LEVEL_TABLE = "pc_stock_level"
const WORK_ORDER_TABLE = "wm_order"
const FSM_PLUGIN = "com.snc.work_management"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_fsm_parts_manage",
  description: `Unified tool for ServiceNow Field Service Management parts operations. Wraps the pc_part (Parts Catalog), wm_part_requirement (parts required for a work order), pc_part_request (parts ordering) and pc_stock_level tables.

Actions:
- list_parts — list pc_part rows from the catalog, optionally filtered by model, category or name
- request_part — create a wm_part_requirement row that attaches a required part to a work order
- list_requirements — list wm_part_requirement rows for a work order
- fulfill_request — create a pc_part_request (purchase / transfer request) to source the part for a wm_part_requirement
- check_stock — list pc_stock_level rows for a part, optionally filtered by stockroom, to see what is available

Use when: the agent needs to plan parts for a work order, attach required parts, raise a purchase / stock-transfer request, or look up what stockroom has a part in stock. Requires the Field Service Management plugin (com.snc.work_management) — every action surfaces a clear PLUGIN_MISSING error if the primary tables are absent.

Returns: catalog rows with sys_id, name, model, manufacturer. Requirements include sys_id, work_order, part, quantity, state. Requests include sys_id, part, quantity, stockroom, state. Stock levels include sys_id, part, stockroom, quantity.`,
  category: "itsm",
  subcategory: "field-service",
  use_cases: ["field-service", "parts", "inventory", "stockroom", "fsm"],
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
        enum: ["list_parts", "request_part", "list_requirements", "fulfill_request", "check_stock"],
      },
      // LIST_PARTS filters
      name: {
        type: "string",
        description: "[list_parts] Filter parts by name (LIKE match)",
      },
      model: {
        type: "string",
        description: "[list_parts] Filter parts by model (cmdb_model sys_id or name)",
      },
      manufacturer: {
        type: "string",
        description: "[list_parts] Filter parts by manufacturer (core_company sys_id or name)",
      },
      category: {
        type: "string",
        description: "[list_parts] Filter parts by category",
      },
      // Common references
      part: {
        type: "string",
        description: "[request_part/fulfill_request/check_stock] pc_part sys_id of the part",
      },
      work_order_sys_id: {
        type: "string",
        description: "[request_part/list_requirements] sys_id of the wm_order this requirement is attached to",
      },
      work_order_number: {
        type: "string",
        description: "[request_part/list_requirements] number of the wm_order (used when work_order_sys_id is absent)",
      },
      requirement_sys_id: {
        type: "string",
        description: "[fulfill_request] sys_id of the wm_part_requirement to fulfill",
      },
      quantity: {
        type: "number",
        description: "[request_part/fulfill_request] Quantity of the part required / requested",
      },
      stockroom: {
        type: "string",
        description: "[fulfill_request/check_stock] sys_id or name of the source stockroom (alm_stockroom)",
      },
      requested_for: {
        type: "string",
        description: "[fulfill_request] sys_user sys_id of the requester (defaults to the assigned technician)",
      },
      // LIST limits / fields
      active_only: {
        type: "boolean",
        description: "[list_parts/list_requirements/check_stock] Only return active rows",
        default: true,
      },
      limit: {
        type: "number",
        description: "[list_parts/list_requirements/check_stock] Maximum records to return",
        default: 50,
      },
      fields: {
        type: "string",
        description: "[list_parts/list_requirements/check_stock] Comma-separated list of fields to return",
      },
    },
    required: ["action"],
  },
}

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const action = args.action as string

  try {
    switch (action) {
      case "list_parts":
        return await executeListParts(args, context)
      case "request_part":
        return await executeRequestPart(args, context)
      case "list_requirements":
        return await executeListRequirements(args, context)
      case "fulfill_request":
        return await executeFulfillRequest(args, context)
      case "check_stock":
        return await executeCheckStock(args, context)
      default:
        return createErrorResult(
          `Unknown action: ${action}. Valid actions: list_parts, request_part, list_requirements, fulfill_request, check_stock`,
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
      `Field Service Management parts tables are not available on this instance. Activate the Field Service Management plugin (${FSM_PLUGIN}) and retry.`,
      { details: { plugin: FSM_PLUGIN, originalMessage: msg } },
    )
  }
  if (err instanceof SnowFlowError) return err
  return new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, `FSM parts ${action} failed: ${msg}`, {
    originalError: err,
  })
}

async function resolveWorkOrderSysId(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  sysId: string | undefined,
  number: string | undefined,
): Promise<string | null> {
  if (sysId) return sysId
  if (!number) return null
  const response = await client.get(`/api/now/table/${WORK_ORDER_TABLE}`, {
    params: { sysparm_query: `number=${number}`, sysparm_fields: "sys_id", sysparm_limit: 1 },
  })
  const rows = (response.data.result || []) as Array<Record<string, unknown>>
  if (rows.length === 0) return null
  return (rows[0].sys_id as string) || null
}

// ==================== LIST_PARTS ====================

async function executeListParts(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const name = args.name as string | undefined
  const model = args.model as string | undefined
  const manufacturer = args.manufacturer as string | undefined
  const category = args.category as string | undefined
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50
  // TODO: verify pc_part column names — common variants include
  // `name`, `model`, `manufacturer`, `category`, `unit_cost`, `active`.
  const fields = (args.fields as string) || "sys_id,name,model,manufacturer,category,unit_cost,active,sys_updated_on"

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (active_only) queryParts.push("active=true")
  if (name) queryParts.push(`nameLIKE${name}`)
  if (model) queryParts.push(`model=${model}`)
  if (manufacturer) queryParts.push(`manufacturer=${manufacturer}`)
  if (category) queryParts.push(`category=${category}`)

  const response = await client.get(`/api/now/table/${PART_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "name",
      sysparm_fields: fields,
    },
  })

  const parts = (response.data.result || []) as Array<Record<string, unknown>>

  return createSuccessResult({
    action: "list_parts",
    count: parts.length,
    parts: parts.map((p) => ({
      sys_id: p.sys_id,
      name: p.name,
      model: p.model,
      manufacturer: p.manufacturer,
      category: p.category,
      unit_cost: p.unit_cost,
      active: p.active,
      updated_at: p.sys_updated_on,
      url: `${context.instanceUrl}/nav_to.do?uri=${PART_TABLE}.do?sys_id=${p.sys_id}`,
    })),
  })
}

// ==================== REQUEST_PART ====================

async function executeRequestPart(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const part = args.part as string | undefined
  const quantity = args.quantity as number | undefined
  const work_order_sys_id = args.work_order_sys_id as string | undefined
  const work_order_number = args.work_order_number as string | undefined

  if (!part) return createErrorResult("part is required for request_part action")
  if (quantity === undefined || quantity === null) {
    return createErrorResult("quantity is required for request_part action")
  }
  if (!work_order_sys_id && !work_order_number) {
    return createErrorResult("work_order_sys_id or work_order_number is required for request_part action")
  }

  const client = await getAuthenticatedClient(context)
  const workOrderSysId = await resolveWorkOrderSysId(client, work_order_sys_id, work_order_number)
  if (!workOrderSysId) {
    return createErrorResult(`Work order not found: ${work_order_sys_id || work_order_number}`)
  }

  // TODO: verify wm_part_requirement column names on a live instance.
  // The most common shape is { work_order, part, quantity, state }.
  const payload: Record<string, unknown> = {
    work_order: workOrderSysId,
    part,
    quantity,
  }

  const response = await client.post(`/api/now/table/${PART_REQUIREMENT_TABLE}`, payload)
  const created = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "request_part",
    created: true,
    sys_id: created.sys_id,
    requirement: created,
    url: `${context.instanceUrl}/nav_to.do?uri=${PART_REQUIREMENT_TABLE}.do?sys_id=${created.sys_id}`,
  })
}

// ==================== LIST_REQUIREMENTS ====================

async function executeListRequirements(
  args: Record<string, unknown>,
  context: ServiceNowContext,
): Promise<ToolResult> {
  const work_order_sys_id = args.work_order_sys_id as string | undefined
  const work_order_number = args.work_order_number as string | undefined
  const limit = (args.limit as number) || 50
  const fields =
    (args.fields as string) || "sys_id,work_order,part,quantity,state,sys_updated_on"

  if (!work_order_sys_id && !work_order_number) {
    return createErrorResult("work_order_sys_id or work_order_number is required for list_requirements action")
  }

  const client = await getAuthenticatedClient(context)
  const workOrderSysId = await resolveWorkOrderSysId(client, work_order_sys_id, work_order_number)
  if (!workOrderSysId) {
    return createErrorResult(`Work order not found: ${work_order_sys_id || work_order_number}`)
  }

  const response = await client.get(`/api/now/table/${PART_REQUIREMENT_TABLE}`, {
    params: {
      sysparm_query: `work_order=${workOrderSysId}`,
      sysparm_limit: limit,
      sysparm_orderby: "sys_created_on",
      sysparm_fields: fields,
    },
  })

  const requirements = (response.data.result || []) as Array<Record<string, unknown>>

  return createSuccessResult({
    action: "list_requirements",
    work_order_sys_id: workOrderSysId,
    count: requirements.length,
    requirements: requirements.map((r) => ({
      sys_id: r.sys_id,
      work_order: r.work_order,
      part: r.part,
      quantity: r.quantity,
      state: r.state,
      updated_at: r.sys_updated_on,
      url: `${context.instanceUrl}/nav_to.do?uri=${PART_REQUIREMENT_TABLE}.do?sys_id=${r.sys_id}`,
    })),
  })
}

// ==================== FULFILL_REQUEST ====================

async function executeFulfillRequest(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const requirement_sys_id = args.requirement_sys_id as string | undefined
  let part = args.part as string | undefined
  let quantity = args.quantity as number | undefined
  const stockroom = args.stockroom as string | undefined
  const requested_for = args.requested_for as string | undefined

  if (!requirement_sys_id && (!part || quantity === undefined || quantity === null)) {
    return createErrorResult(
      "Provide either requirement_sys_id (to source from an existing wm_part_requirement) or both part and quantity for fulfill_request action",
    )
  }

  const client = await getAuthenticatedClient(context)

  // If a requirement is supplied, hydrate the part and quantity from it
  // so the caller doesn't have to re-supply them.
  let sourceRequirement: Record<string, unknown> | null = null
  if (requirement_sys_id) {
    const response = await client.get(`/api/now/table/${PART_REQUIREMENT_TABLE}/${requirement_sys_id}`)
    sourceRequirement = (response.data.result as Record<string, unknown>) || null
    if (!sourceRequirement) {
      return createErrorResult(`Part requirement not found: ${requirement_sys_id}`)
    }
    if (!part) {
      const ref = sourceRequirement.part
      if (typeof ref === "string") part = ref
      else if (ref && typeof ref === "object" && "value" in ref) part = (ref as { value: string }).value
    }
    if (quantity === undefined || quantity === null) {
      const q = sourceRequirement.quantity
      quantity = typeof q === "number" ? q : Number(q)
    }
  }

  // TODO: verify pc_part_request column names — common shape is
  // { part, quantity, stockroom, requested_for, requirement, state }.
  const payload: Record<string, unknown> = {
    part,
    quantity,
  }
  if (stockroom) payload.stockroom = stockroom
  if (requested_for) payload.requested_for = requested_for
  if (requirement_sys_id) payload.requirement = requirement_sys_id

  const response = await client.post(`/api/now/table/${PART_REQUEST_TABLE}`, payload)
  const created = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "fulfill_request",
    created: true,
    sys_id: created.sys_id,
    request: created,
    source_requirement: sourceRequirement ? { sys_id: sourceRequirement.sys_id } : null,
    url: `${context.instanceUrl}/nav_to.do?uri=${PART_REQUEST_TABLE}.do?sys_id=${created.sys_id}`,
  })
}

// ==================== CHECK_STOCK ====================

async function executeCheckStock(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const part = args.part as string | undefined
  const stockroom = args.stockroom as string | undefined
  const limit = (args.limit as number) || 50
  // TODO: verify pc_stock_level column names — common shape is
  // { part, stockroom, quantity, available_quantity, sys_updated_on }.
  const fields =
    (args.fields as string) || "sys_id,part,stockroom,quantity,available_quantity,sys_updated_on"

  if (!part && !stockroom) {
    return createErrorResult("At least one of part or stockroom is required for check_stock action")
  }

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (part) queryParts.push(`part=${part}`)
  if (stockroom) queryParts.push(`stockroom=${stockroom}`)

  const response = await client.get(`/api/now/table/${STOCK_LEVEL_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "stockroom",
      sysparm_fields: fields,
    },
  })

  const levels = (response.data.result || []) as Array<Record<string, unknown>>

  return createSuccessResult({
    action: "check_stock",
    count: levels.length,
    stock_levels: levels.map((l) => ({
      sys_id: l.sys_id,
      part: l.part,
      stockroom: l.stockroom,
      quantity: l.quantity,
      available_quantity: l.available_quantity,
      updated_at: l.sys_updated_on,
      url: `${context.instanceUrl}/nav_to.do?uri=${STOCK_LEVEL_TABLE}.do?sys_id=${l.sys_id}`,
    })),
  })
}

export const version = "1.0.0"
export const author = "groeimetai"
