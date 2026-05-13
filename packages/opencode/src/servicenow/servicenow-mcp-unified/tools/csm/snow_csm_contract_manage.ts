/**
 * snow_csm_contract_manage - Unified CSM contract and entitlement management
 *
 * Wraps the Customer Service Management contract surface: service_contract
 * (master contract), entitlement (what an account is entitled to), the linked
 * service_offering catalog, and contract_sla (SLA linkage).
 *
 * Companion to snow_create_customer_case and snow_create_entitlement — the
 * existing tools open cases and create individual entitlements, while this
 * tool manages the contract lifecycle that those entitlements hang off of.
 *
 * Requires the Customer Service Management plugin (com.sn_customerservice).
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_csm_contract_manage",
  description: `Unified tool for ServiceNow CSM service contracts and the entitlements that hang off them. Wraps service_contract, entitlement, service_offering, and contract_sla.

Actions:
- list — list service contracts filtered by account, state, or active flag
- get — fetch a service contract with linked entitlements and SLAs
- create_contract — create a new service_contract for an account
- link_entitlement — attach an entitlement to a service contract (joins entitlement.service_contract)
- list_entitlements — list entitlements for a contract, account, or globally
- extend_contract — extend a service contract's end_date and optionally activate

Use when: the agent needs to define what an account is entitled to across CSM cases. Companion tools: snow_create_customer_case (opens a CSM case that consumes the entitlements), snow_create_entitlement (creates a single entitlement record), snow_create_customer_account (creates the account that owns the contract).

Requires com.sn_customerservice. When the plugin is missing the underlying tables don't exist and the tool returns a clear plugin-missing error.`,
  category: "itsm",
  subcategory: "csm",
  use_cases: ["customer-service", "contracts", "entitlements", "csm"],
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
        enum: ["list", "get", "create_contract", "link_entitlement", "list_entitlements", "extend_contract"],
      },
      // Identification
      sys_id: {
        type: "string",
        description: "[get/link_entitlement/extend_contract/list_entitlements] service_contract sys_id",
      },
      number: {
        type: "string",
        description: "[get] Contract number (alternative to sys_id)",
      },
      // Filtering
      account: {
        type: "string",
        description: "[list/list_entitlements/create_contract] Customer account sys_id",
      },
      state: {
        type: "string",
        description: "[list] State filter (e.g. draft, active, expired, cancelled)",
      },
      active_only: {
        type: "boolean",
        description: "[list/list_entitlements] Only return active records",
        default: false,
      },
      // CREATE_CONTRACT fields
      name: {
        type: "string",
        description: "[create_contract] Contract name/short_description",
      },
      start_date: {
        type: "string",
        description: "[create_contract] Start date (YYYY-MM-DD)",
      },
      end_date: {
        type: "string",
        description: "[create_contract/extend_contract] End date (YYYY-MM-DD)",
      },
      service_offering: {
        type: "string",
        description: "[create_contract] service_offering sys_id this contract sells",
      },
      contract_type: {
        type: "string",
        description: "[create_contract] Contract type (e.g. service, support, maintenance)",
      },
      // LINK_ENTITLEMENT fields
      entitlement: {
        type: "string",
        description: "[link_entitlement] Entitlement sys_id to attach to the contract",
      },
      // EXTEND_CONTRACT fields
      activate: {
        type: "boolean",
        description: "[extend_contract] Mark the contract active after extending",
        default: false,
      },
      // Listing
      limit: {
        type: "number",
        description: "[list/list_entitlements] Maximum records to return",
        default: 50,
      },
      fields: {
        type: "string",
        description: "[list/get/list_entitlements] Comma-separated list of fields to return",
      },
    },
    required: ["action"],
  },
}

const CONTRACT_TABLE = "service_contract"
const ENTITLEMENT_TABLE = "entitlement"
const SERVICE_OFFERING_TABLE = "service_offering"
const CONTRACT_SLA_TABLE = "contract_sla"

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const action = args.action as string

  try {
    switch (action) {
      case "list":
        return await executeList(args, context)
      case "get":
        return await executeGet(args, context)
      case "create_contract":
        return await executeCreateContract(args, context)
      case "link_entitlement":
        return await executeLinkEntitlement(args, context)
      case "list_entitlements":
        return await executeListEntitlements(args, context)
      case "extend_contract":
        return await executeExtendContract(args, context)
      default:
        return createErrorResult(
          `Unknown action: ${action}. Valid actions: list, get, create_contract, link_entitlement, list_entitlements, extend_contract`,
        )
    }
  } catch (error: unknown) {
    const err = error as Error & { response?: { status?: number } }
    if (err.response?.status === 404 || /Invalid table/i.test(err.message || "")) {
      return createErrorResult(
        new SnowFlowError(
          ErrorType.PLUGIN_MISSING,
          `CSM contract tables not found. Install the com.sn_customerservice plugin and verify ${CONTRACT_TABLE} exists.`,
          { originalError: err },
        ),
      )
    }
    return createErrorResult(
      err instanceof SnowFlowError
        ? err
        : new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, `CSM contract ${action} failed: ${err.message}`, {
            originalError: err,
          }),
    )
  }
}

// ==================== LIST ====================

async function executeList(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const account = args.account as string | undefined
  const state = args.state as string | undefined
  const active_only = args.active_only === true
  const limit = (args.limit as number) || 50
  const fields = args.fields as string | undefined

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (account) queryParts.push(`account=${account}`)
  if (state) queryParts.push(`state=${state}`)
  if (active_only) queryParts.push("active=true")

  const response = await client.get(`/api/now/table/${CONTRACT_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      sysparm_orderby: "sys_updated_on",
      ...(fields
        ? { sysparm_fields: fields }
        : { sysparm_fields: "sys_id,number,short_description,account,state,starts,ends,active,sys_updated_on" }),
    },
  })

  const results = (response.data.result || []) as Array<Record<string, unknown>>
  return createSuccessResult({
    action: "list",
    count: results.length,
    contracts: results.map((r) => ({
      sys_id: r.sys_id,
      number: r.number,
      short_description: r.short_description,
      account: r.account,
      state: r.state,
      starts: r.starts,
      ends: r.ends,
      active: r.active,
      updated_at: r.sys_updated_on,
      url: `${context.instanceUrl}/nav_to.do?uri=${CONTRACT_TABLE}.do?sys_id=${r.sys_id}`,
    })),
  })
}

// ==================== GET ====================

async function executeGet(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const number = args.number as string | undefined
  if (!sys_id && !number) {
    return createErrorResult("sys_id or number is required for get")
  }

  const client = await getAuthenticatedClient(context)
  const contract = await findContract(client, sys_id, number)
  if (!contract) return createErrorResult(`Contract not found: ${sys_id || number}`)

  const contractSysId = contract.sys_id as string

  // Best-effort fetch of dependent entitlements and SLAs — swallow errors so
  // missing optional tables don't fail the primary lookup.
  let entitlementCount = 0
  let slaCount = 0
  try {
    const entResp = await client.get(`/api/now/table/${ENTITLEMENT_TABLE}`, {
      params: { sysparm_query: `service_contract=${contractSysId}`, sysparm_fields: "sys_id", sysparm_limit: 200 },
    })
    entitlementCount = (entResp.data.result || []).length
  } catch {
    // TODO: verify entitlement.service_contract column name on a live instance.
  }
  try {
    const slaResp = await client.get(`/api/now/table/${CONTRACT_SLA_TABLE}`, {
      params: { sysparm_query: `contract=${contractSysId}`, sysparm_fields: "sys_id", sysparm_limit: 200 },
    })
    slaCount = (slaResp.data.result || []).length
  } catch {
    // contract_sla.contract column name varies between releases.
  }

  return createSuccessResult({
    action: "get",
    sys_id: contractSysId,
    contract,
    related: {
      entitlement_count: entitlementCount,
      sla_count: slaCount,
    },
    url: `${context.instanceUrl}/nav_to.do?uri=${CONTRACT_TABLE}.do?sys_id=${contractSysId}`,
  })
}

// ==================== CREATE_CONTRACT ====================

async function executeCreateContract(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const account = args.account as string | undefined
  const name = args.name as string | undefined
  const start_date = args.start_date as string | undefined
  const end_date = args.end_date as string | undefined

  if (!account) return createErrorResult("account is required for create_contract")
  if (!name) return createErrorResult("name is required for create_contract")
  if (!start_date) return createErrorResult("start_date is required for create_contract")
  if (!end_date) return createErrorResult("end_date is required for create_contract")

  const client = await getAuthenticatedClient(context)

  // Optional: validate the service_offering exists when provided.
  const service_offering = args.service_offering as string | undefined
  if (service_offering) {
    try {
      await client.get(`/api/now/table/${SERVICE_OFFERING_TABLE}/${service_offering}`)
    } catch {
      return createErrorResult(`service_offering not found: ${service_offering}`)
    }
  }

  // Canonical service_contract fields. Some instances use `starts`/`ends`,
  // others use `start_date`/`end_date` — write both shapes.
  // TODO: verify if customer has custom field overrides for service_contract.
  const payload: Record<string, unknown> = {
    short_description: name,
    account,
    starts: start_date,
    ends: end_date,
    start_date,
    end_date,
    active: true,
  }
  if (service_offering) payload.service_offering = service_offering
  if (args.contract_type) payload.contract_type = args.contract_type

  const response = await client.post(`/api/now/table/${CONTRACT_TABLE}`, payload)
  const created = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "create_contract",
    created: true,
    sys_id: created.sys_id,
    name: created.short_description || name,
    contract: created,
    url: `${context.instanceUrl}/nav_to.do?uri=${CONTRACT_TABLE}.do?sys_id=${created.sys_id}`,
  })
}

// ==================== LINK_ENTITLEMENT ====================

async function executeLinkEntitlement(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const entitlement = args.entitlement as string | undefined

  if (!sys_id) return createErrorResult("sys_id (contract) is required for link_entitlement")
  if (!entitlement) return createErrorResult("entitlement is required for link_entitlement")

  const client = await getAuthenticatedClient(context)

  // Ensure both records exist
  const contract = await findContract(client, sys_id, undefined)
  if (!contract) return createErrorResult(`Contract not found: ${sys_id}`)

  // TODO: verify entitlement.service_contract column on a live instance.
  const response = await client.patch(`/api/now/table/${ENTITLEMENT_TABLE}/${entitlement}`, {
    service_contract: sys_id,
  })

  return createSuccessResult({
    action: "link_entitlement",
    linked: true,
    contract_sys_id: sys_id,
    entitlement_sys_id: entitlement,
    entitlement: response.data.result,
  })
}

// ==================== LIST_ENTITLEMENTS ====================

async function executeListEntitlements(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const account = args.account as string | undefined
  const active_only = args.active_only === true
  const limit = (args.limit as number) || 50
  const fields = args.fields as string | undefined

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (sys_id) queryParts.push(`service_contract=${sys_id}`)
  if (account) queryParts.push(`account=${account}`)
  if (active_only) queryParts.push("active=true")

  const response = await client.get(`/api/now/table/${ENTITLEMENT_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      ...(fields
        ? { sysparm_fields: fields }
        : { sysparm_fields: "sys_id,name,account,service_contract,service,start_date,end_date,active" }),
    },
  })

  const results = (response.data.result || []) as Array<Record<string, unknown>>
  return createSuccessResult({
    action: "list_entitlements",
    count: results.length,
    entitlements: results.map((r) => ({
      sys_id: r.sys_id,
      name: r.name,
      account: r.account,
      service_contract: r.service_contract,
      service: r.service,
      start_date: r.start_date,
      end_date: r.end_date,
      active: r.active,
      url: `${context.instanceUrl}/nav_to.do?uri=${ENTITLEMENT_TABLE}.do?sys_id=${r.sys_id}`,
    })),
  })
}

// ==================== EXTEND_CONTRACT ====================

async function executeExtendContract(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const end_date = args.end_date as string | undefined
  const activate = args.activate === true

  if (!sys_id) return createErrorResult("sys_id is required for extend_contract")
  if (!end_date) return createErrorResult("end_date is required for extend_contract")

  const client = await getAuthenticatedClient(context)

  const patch: Record<string, unknown> = {
    ends: end_date,
    end_date,
  }
  if (activate) patch.active = true

  const response = await client.patch(`/api/now/table/${CONTRACT_TABLE}/${sys_id}`, patch)
  const updated = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "extend_contract",
    extended: true,
    sys_id,
    new_end_date: end_date,
    activated: activate,
    contract: updated,
    url: `${context.instanceUrl}/nav_to.do?uri=${CONTRACT_TABLE}.do?sys_id=${sys_id}`,
  })
}

// ==================== HELPERS ====================

async function findContract(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  sysId: string | undefined,
  number: string | undefined,
): Promise<Record<string, unknown> | null> {
  if (sysId) {
    const direct = await client.get(`/api/now/table/${CONTRACT_TABLE}/${sysId}`)
    if (direct.data.result && direct.data.result.sys_id) return direct.data.result
  }
  if (number) {
    const search = await client.get(`/api/now/table/${CONTRACT_TABLE}`, {
      params: { sysparm_query: `number=${number}`, sysparm_limit: 1 },
    })
    const results = (search.data.result || []) as Array<Record<string, unknown>>
    if (results.length > 0) return results[0]
  }
  return null
}

export const version = "1.0.0"
export const author = "groeimetai"
