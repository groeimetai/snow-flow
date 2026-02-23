/**
 * snow_plugin_manage - Unified Plugin Management
 *
 * Single tool for all ServiceNow plugin operations:
 * list, check, activate, deactivate.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_plugin_manage",
  description: `Manage ServiceNow plugins: list, check status, activate, or deactivate.

Actions:
• list — Search and list plugins. Filter by name/ID, show only active.
• check — Get detailed info on a specific plugin (status, version, dependencies).
• activate — Activate a plugin (admin only). Uses CICD API with table fallback.
• deactivate — Deactivate a plugin (admin only). Uses CICD API with table fallback.

Examples:
• { action: "list", search: "incident" }
• { action: "check", plugin_id: "com.snc.incident" }
• { action: "activate", plugin_id: "com.snc.incident" }`,
  category: "advanced",
  subcategory: "administration",
  use_cases: ["plugin-discovery", "plugin-management", "plugin-status", "activation", "deactivation"],
  complexity: "intermediate",
  frequency: "low",
  permission: "write",
  allowedRoles: ["developer", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        description: "Operation to perform",
        enum: ["list", "check", "activate", "deactivate"],
      },
      plugin_id: {
        type: "string",
        description: '[check/activate/deactivate] Plugin identifier (e.g. "com.snc.incident") or sys_id',
      },
      search: {
        type: "string",
        description: '[list] Filter by plugin name or ID (e.g. "incident", "com.snc")',
      },
      active_only: {
        type: "boolean",
        description: "[list] Only show active plugins",
        default: false,
      },
      limit: {
        type: "number",
        description: "[list] Max results to return (default 50)",
        default: 50,
      },
    },
    required: ["action"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { action } = args
  try {
    switch (action) {
      case "list":
        return await executeList(args, context)
      case "check":
        return await executeCheck(args, context)
      case "activate":
        return await executeActivate(args, context)
      case "deactivate":
        return await executeDeactivate(args, context)
      default:
        return createErrorResult("Unknown action: " + action + ". Valid actions: list, check, activate, deactivate")
    }
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

// ==================== LIST ====================
async function executeList(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { search, active_only = false, limit = 50 } = args
  const client = await getAuthenticatedClient(context)

  const queryParts: string[] = []
  if (search) {
    queryParts.push("nameLIKE" + search + "^ORidLIKE" + search)
  }
  if (active_only) {
    queryParts.push("active=true")
  }

  const response = await client.get("/api/now/table/v_plugin", {
    params: {
      sysparm_query: queryParts.join("^"),
      sysparm_fields: "sys_id,id,name,active,version,description",
      sysparm_limit: limit,
      sysparm_display_value: "true",
    },
  })

  const plugins = response.data.result || []
  const activeCount = plugins.filter((p: any) => p.active === "true" || p.active === true).length
  const inactiveCount = plugins.length - activeCount

  const summary =
    "Found " +
    plugins.length +
    " plugin(s)" +
    (search ? ' matching "' + search + '"' : "") +
    ". Active: " +
    activeCount +
    ", Inactive: " +
    inactiveCount +
    "."

  return createSuccessResult(
    { action: "list", plugins, count: plugins.length },
    { active_count: activeCount, inactive_count: inactiveCount },
    summary,
  )
}

// ==================== CHECK ====================
async function executeCheck(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { plugin_id } = args
  if (!plugin_id) return createErrorResult("plugin_id is required for check action")

  const client = await getAuthenticatedClient(context)

  const response = await client.get("/api/now/table/v_plugin", {
    params: {
      sysparm_query: "id=" + plugin_id + "^ORsys_id=" + plugin_id,
      sysparm_fields: "sys_id,id,name,active,version,description,parent,optional,licensable",
      sysparm_limit: 1,
      sysparm_display_value: "true",
    },
  })

  const results = response.data.result || []
  if (results.length === 0) {
    return createErrorResult("Plugin not found: " + plugin_id)
  }

  const plugin = results[0]
  const active = plugin.active === "true" || plugin.active === true
  const summary =
    'Plugin "' +
    plugin.name +
    '" (' +
    plugin.id +
    ") is " +
    (active ? "ACTIVE" : "INACTIVE") +
    ". Version: " +
    (plugin.version || "unknown") +
    "."

  return createSuccessResult({ action: "check", plugin }, { status: active ? "active" : "inactive" }, summary)
}

// ==================== ACTIVATE ====================
async function executeActivate(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { plugin_id } = args
  if (!plugin_id) return createErrorResult("plugin_id is required for activate action")

  const client = await getAuthenticatedClient(context)
  const plugin = await lookupPlugin(client, plugin_id)
  if (!plugin) return createErrorResult("Plugin not found: " + plugin_id)

  if (plugin.active === "true" || plugin.active === true) {
    return createSuccessResult(
      { action: "activate", plugin, activated: false, already_active: true },
      {},
      'Plugin "' + plugin.name + '" (' + plugin.id + ") is already active.",
    )
  }

  const { success, method, error } = await togglePlugin(client, plugin, "activate")
  if (!success) return createErrorResult(error!)

  const verified = await verifyPluginState(client, plugin.sys_id, true)
  const summary = verified
    ? 'Plugin "' + plugin.name + '" (' + plugin.id + ") activated successfully via " + method + "."
    : 'Activation request sent for "' + plugin.name + '" via ' + method + ". May take a moment to fully activate."

  return createSuccessResult({ action: "activate", plugin, activated: true, verified, method }, {}, summary)
}

// ==================== DEACTIVATE ====================
async function executeDeactivate(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { plugin_id } = args
  if (!plugin_id) return createErrorResult("plugin_id is required for deactivate action")

  const client = await getAuthenticatedClient(context)
  const plugin = await lookupPlugin(client, plugin_id)
  if (!plugin) return createErrorResult("Plugin not found: " + plugin_id)

  if (plugin.active !== "true" && plugin.active !== true) {
    return createSuccessResult(
      { action: "deactivate", plugin, deactivated: false, already_inactive: true },
      {},
      'Plugin "' + plugin.name + '" (' + plugin.id + ") is already inactive.",
    )
  }

  const { success, method, error } = await togglePlugin(client, plugin, "deactivate")
  if (!success) return createErrorResult(error!)

  const verified = await verifyPluginState(client, plugin.sys_id, false)
  const summary = verified
    ? 'Plugin "' + plugin.name + '" (' + plugin.id + ") deactivated successfully via " + method + "."
    : 'Deactivation request sent for "' + plugin.name + '" via ' + method + ". May take a moment to fully deactivate."

  return createSuccessResult({ action: "deactivate", plugin, deactivated: true, verified, method }, {}, summary)
}

// ==================== HELPERS ====================

async function lookupPlugin(client: any, pluginId: string): Promise<any | null> {
  const response = await client.get("/api/now/table/v_plugin", {
    params: {
      sysparm_query: "id=" + pluginId + "^ORsys_id=" + pluginId,
      sysparm_fields: "sys_id,id,name,active",
      sysparm_limit: 1,
    },
  })
  const results = response.data.result || []
  return results.length > 0 ? results[0] : null
}

async function togglePlugin(
  client: any,
  plugin: any,
  operation: "activate" | "deactivate",
): Promise<{ success: boolean; method: string; error?: string }> {
  // Try CICD Plugin API first
  try {
    await client.post("/api/sn_cicd/plugin/" + encodeURIComponent(plugin.id) + "/" + operation)
    return { success: true, method: "cicd_api" }
  } catch (cicdError: any) {
    const status = cicdError.response ? cicdError.response.status : 0
    if (status === 404 || status === 400) {
      // Fallback to sys_plugins PATCH
      try {
        const activeValue = operation === "activate" ? "true" : "false"
        await client.patch("/api/now/table/sys_plugins/" + plugin.sys_id, { active: activeValue })
        return { success: true, method: "table_api" }
      } catch (patchError: any) {
        return {
          success: false,
          method: "",
          error:
            "Failed to " +
            operation +
            " plugin via both CICD API and Table API. CICD: " +
            (cicdError.message || "unknown") +
            ". Table API: " +
            (patchError.message || "unknown"),
        }
      }
    }
    return { success: false, method: "", error: "CICD Plugin API error: " + (cicdError.message || "unknown") }
  }
}

async function verifyPluginState(client: any, sysId: string, expectActive: boolean): Promise<boolean> {
  try {
    const response = await client.get("/api/now/table/v_plugin", {
      params: {
        sysparm_query: "sys_id=" + sysId,
        sysparm_fields: "active",
        sysparm_limit: 1,
      },
    })
    const results = response.data.result || []
    if (results.length === 0) return false
    const isActive = results[0].active === "true" || results[0].active === true
    return expectActive ? isActive : !isActive
  } catch {
    return false
  }
}

export const version = "1.0.0"
export const author = "Snow-Flow"
