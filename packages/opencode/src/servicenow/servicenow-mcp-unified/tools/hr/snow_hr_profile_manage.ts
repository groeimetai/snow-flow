/**
 * snow_hr_profile_manage - Unified HR profile and relation management
 *
 * Wraps the HRSD employee profile surface: sn_hr_core_profile (canonical
 * employee record consumed by every HR case) and sn_hr_core_user_relation
 * (manager/report and other relationships).
 *
 * Companion to snow_create_hr_case and snow_create_hr_task — those tools
 * open work against an employee, and this tool maintains the underlying
 * employee record they reference.
 *
 * Requires the HR Core plugin (com.sn_hr_core).
 */

import type { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult, SnowFlowError, ErrorType } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_hr_profile_manage",
  description: `Unified tool for ServiceNow HR employee profiles (sn_hr_core_profile) and the user relations that connect them (sn_hr_core_user_relation).

Actions:
- get_profile — fetch a profile by sys_id, user sys_id, or employee_number
- update_profile — patch profile fields (department, location, manager, employee_number, job_title)
- list_relations — list relationships for a profile (manager, direct reports, dotted-line, etc.)
- add_relation — create a relationship between two profiles (e.g. manager -> report)
- search_employees — search profiles by name, email, department, or employee_number

Use when: the agent needs to read or maintain the canonical employee record used across all HR cases. Companion tools: snow_create_hr_case (opens HR tickets against a profile), snow_create_hr_task (creates task work on a case), snow_hr_lifecycle_event (drives onboarding/offboarding flows).

Requires the HR Core plugin (com.sn_hr_core). When the plugin is missing the underlying tables don't exist and the tool returns a clear plugin-missing error.`,
  category: "itsm",
  subcategory: "hr",
  use_cases: ["hr-service-delivery", "employee-profile", "hr-relations", "hr-core"],
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
        enum: ["get_profile", "update_profile", "list_relations", "add_relation", "search_employees"],
      },
      // Identification
      sys_id: {
        type: "string",
        description: "[get_profile/update_profile/list_relations/add_relation] Profile sys_id",
      },
      user: {
        type: "string",
        description: "[get_profile] sys_user sys_id (alternative to sys_id)",
      },
      employee_number: {
        type: "string",
        description: "[get_profile/search_employees/update_profile] Employee number (alternative to sys_id)",
      },
      // UPDATE fields (canonical platform fields only)
      department: {
        type: "string",
        description: "[update_profile] cmn_department sys_id",
      },
      location: {
        type: "string",
        description: "[update_profile] cmn_location sys_id",
      },
      manager: {
        type: "string",
        description: "[update_profile] Manager profile sys_id",
      },
      job_title: {
        type: "string",
        description: "[update_profile] Job title (free-text)",
      },
      employment_status: {
        type: "string",
        description: "[update_profile] Employment status (e.g. active, leave_of_absence, terminated)",
      },
      // RELATION fields
      related_profile: {
        type: "string",
        description: "[add_relation] sys_id of the related sn_hr_core_profile",
      },
      relation_type: {
        type: "string",
        description: "[add_relation/list_relations] Relation type label (manager, direct_report, dotted_line, etc.)",
      },
      // SEARCH fields
      name: {
        type: "string",
        description: "[search_employees] Substring match against the profile's name/full_name",
      },
      email: {
        type: "string",
        description: "[search_employees] Email substring match (joins through sys_user)",
      },
      // Listing
      active_only: {
        type: "boolean",
        description: "[search_employees/list_relations] Only return active records",
        default: true,
      },
      limit: {
        type: "number",
        description: "[search_employees/list_relations] Maximum records to return",
        default: 50,
      },
      fields: {
        type: "string",
        description: "[get_profile/search_employees/list_relations] Comma-separated list of fields to return",
      },
    },
    required: ["action"],
  },
}

const PROFILE_TABLE = "sn_hr_core_profile"
const RELATION_TABLE = "sn_hr_core_user_relation"

export async function execute(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const action = args.action as string

  try {
    switch (action) {
      case "get_profile":
        return await executeGetProfile(args, context)
      case "update_profile":
        return await executeUpdateProfile(args, context)
      case "list_relations":
        return await executeListRelations(args, context)
      case "add_relation":
        return await executeAddRelation(args, context)
      case "search_employees":
        return await executeSearchEmployees(args, context)
      default:
        return createErrorResult(
          `Unknown action: ${action}. Valid actions: get_profile, update_profile, list_relations, add_relation, search_employees`,
        )
    }
  } catch (error: unknown) {
    const err = error as Error & { response?: { status?: number } }
    if (err.response?.status === 404 || /Invalid table/i.test(err.message || "")) {
      return createErrorResult(
        new SnowFlowError(
          ErrorType.PLUGIN_MISSING,
          `HR Core profile tables not found. Install the com.sn_hr_core plugin and verify ${PROFILE_TABLE} exists.`,
          { originalError: err },
        ),
      )
    }
    return createErrorResult(
      err instanceof SnowFlowError
        ? err
        : new SnowFlowError(ErrorType.SERVICENOW_API_ERROR, `HR profile ${action} failed: ${err.message}`, {
            originalError: err,
          }),
    )
  }
}

// ==================== HELPERS ====================

async function findProfile(
  client: Awaited<ReturnType<typeof getAuthenticatedClient>>,
  args: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const sys_id = args.sys_id as string | undefined
  const user = args.user as string | undefined
  const employee_number = args.employee_number as string | undefined

  if (sys_id) {
    const direct = await client.get(`/api/now/table/${PROFILE_TABLE}/${sys_id}`)
    if (direct.data.result && direct.data.result.sys_id) return direct.data.result
  }

  const orParts: string[] = []
  if (user) orParts.push(`user=${user}`)
  if (employee_number) orParts.push(`employee_number=${employee_number}`)
  if (orParts.length === 0) return null

  const search = await client.get(`/api/now/table/${PROFILE_TABLE}`, {
    params: {
      sysparm_query: orParts.join("^OR"),
      sysparm_limit: 1,
    },
  })
  const results = (search.data.result || []) as Array<Record<string, unknown>>
  return results.length > 0 ? results[0] : null
}

// ==================== GET_PROFILE ====================

async function executeGetProfile(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  if (!args.sys_id && !args.user && !args.employee_number) {
    return createErrorResult("sys_id, user, or employee_number is required for get_profile")
  }

  const client = await getAuthenticatedClient(context)
  const profile = await findProfile(client, args)
  if (!profile) {
    return createErrorResult(`Profile not found: ${args.sys_id || args.user || args.employee_number}`)
  }

  return createSuccessResult({
    action: "get_profile",
    sys_id: profile.sys_id,
    profile,
    url: `${context.instanceUrl}/nav_to.do?uri=${PROFILE_TABLE}.do?sys_id=${profile.sys_id}`,
  })
}

// ==================== UPDATE_PROFILE ====================

async function executeUpdateProfile(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  if (!args.sys_id && !args.user && !args.employee_number) {
    return createErrorResult("sys_id, user, or employee_number is required for update_profile")
  }

  const client = await getAuthenticatedClient(context)
  const profile = await findProfile(client, args)
  if (!profile) {
    return createErrorResult(`Profile not found: ${args.sys_id || args.user || args.employee_number}`)
  }

  // Canonical platform fields only. Customer-specific custom fields are intentionally
  // not exposed — agents should add them through a follow-up table-update call.
  // TODO: verify if customer has custom field overrides for sn_hr_core_profile.
  const updatable = ["department", "location", "manager", "job_title", "employment_status"]
  const patch: Record<string, unknown> = {}
  for (const key of updatable) {
    if (args[key] !== undefined) patch[key] = args[key]
  }

  if (Object.keys(patch).length === 0) {
    return createErrorResult("No update fields provided. Valid: department, location, manager, job_title, employment_status")
  }

  const targetSysId = profile.sys_id as string
  const response = await client.patch(`/api/now/table/${PROFILE_TABLE}/${targetSysId}`, patch)
  const updated = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "update_profile",
    updated: true,
    sys_id: targetSysId,
    updated_fields: Object.keys(patch),
    profile: updated,
    url: `${context.instanceUrl}/nav_to.do?uri=${PROFILE_TABLE}.do?sys_id=${targetSysId}`,
  })
}

// ==================== LIST_RELATIONS ====================

async function executeListRelations(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const relation_type = args.relation_type as string | undefined
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50
  const fields = args.fields as string | undefined

  if (!sys_id) return createErrorResult("sys_id (profile) is required for list_relations")

  const client = await getAuthenticatedClient(context)

  // Relations are stored bidirectionally — match either side of the relation.
  // TODO: verify column names on sn_hr_core_user_relation (commonly `user` and `related_user`,
  // or `profile` and `related_profile` depending on the HRSD release).
  const queryParts = [`userPROFILE${sys_id}^ORrelated_userPROFILE${sys_id}`.replace(/PROFILE/g, "=")]
  if (relation_type) queryParts.push(`type=${relation_type}`)
  if (active_only) queryParts.push("active=true")

  const response = await client.get(`/api/now/table/${RELATION_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      ...(fields ? { sysparm_fields: fields } : { sysparm_fields: "sys_id,user,related_user,type,active" }),
    },
  })

  const results = (response.data.result || []) as Array<Record<string, unknown>>
  return createSuccessResult({
    action: "list_relations",
    profile_sys_id: sys_id,
    count: results.length,
    relations: results,
  })
}

// ==================== ADD_RELATION ====================

async function executeAddRelation(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const sys_id = args.sys_id as string | undefined
  const related_profile = args.related_profile as string | undefined
  const relation_type = args.relation_type as string | undefined

  if (!sys_id) return createErrorResult("sys_id is required for add_relation")
  if (!related_profile) return createErrorResult("related_profile is required for add_relation")
  if (!relation_type) return createErrorResult("relation_type is required for add_relation")

  const client = await getAuthenticatedClient(context)

  // TODO: verify exact column names — older HRSD releases use `user` and `related_user`,
  // newer releases sometimes use `profile`/`related_profile`. Try the canonical pair first.
  const payload: Record<string, unknown> = {
    user: sys_id,
    related_user: related_profile,
    type: relation_type,
    active: true,
  }

  const response = await client.post(`/api/now/table/${RELATION_TABLE}`, payload)
  const created = response.data.result as Record<string, unknown>

  return createSuccessResult({
    action: "add_relation",
    created: true,
    sys_id: created.sys_id,
    relation: created,
    url: `${context.instanceUrl}/nav_to.do?uri=${RELATION_TABLE}.do?sys_id=${created.sys_id}`,
  })
}

// ==================== SEARCH_EMPLOYEES ====================

async function executeSearchEmployees(args: Record<string, unknown>, context: ServiceNowContext): Promise<ToolResult> {
  const name = args.name as string | undefined
  const email = args.email as string | undefined
  const employee_number = args.employee_number as string | undefined
  const department = args.department as string | undefined
  const active_only = args.active_only !== false
  const limit = (args.limit as number) || 50
  const fields = args.fields as string | undefined

  if (!name && !email && !employee_number && !department) {
    return createErrorResult("At least one of name, email, employee_number, or department is required for search_employees")
  }

  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (name) queryParts.push(`nameLIKE${name}`)
  if (email) queryParts.push(`user.emailLIKE${email}`)
  if (employee_number) queryParts.push(`employee_number=${employee_number}`)
  if (department) queryParts.push(`department=${department}`)
  if (active_only) queryParts.push("active=true")

  const response = await client.get(`/api/now/table/${PROFILE_TABLE}`, {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_limit: limit,
      ...(fields
        ? { sysparm_fields: fields }
        : { sysparm_fields: "sys_id,user,employee_number,name,department,location,job_title,active" }),
    },
  })

  const results = (response.data.result || []) as Array<Record<string, unknown>>
  return createSuccessResult({
    action: "search_employees",
    count: results.length,
    employees: results.map((r) => ({
      sys_id: r.sys_id,
      user: r.user,
      employee_number: r.employee_number,
      name: r.name,
      department: r.department,
      location: r.location,
      job_title: r.job_title,
      active: r.active,
      url: `${context.instanceUrl}/nav_to.do?uri=${PROFILE_TABLE}.do?sys_id=${r.sys_id}`,
    })),
  })
}

export const version = "1.0.0"
export const author = "groeimetai"
