/**
 * snow_dependency_map_table_configs - Find all configurations on a table
 *
 * For a given table, finds ALL configurations running on it:
 * business rules, client scripts, UI actions, UI policies, ACLs,
 * script includes, and data policies.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { CONFIG_TYPE_QUERIES, TABLE_CONFIG_TYPES, ConfigType } from "./shared/metadata-tables.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_dependency_map_table_configs",
  description: `Find ALL configurations running on a specific table.

📋 USE THIS TO:
- See every business rule, client script, UI action, ACL etc. on a table
- Understand the full configuration landscape before making changes
- Filter by config type, scope, or active status
- Get a summary of how many configs exist per type

🔍 EXAMPLE: "What configs run on the incident table?"

📊 RETURNS:
- Grouped list of configurations by type
- Summary with total counts per type
- Active vs inactive breakdown`,
  category: "dependency-map",
  subcategory: "table-analysis",
  use_cases: ["impact-analysis", "table-audit", "governance"],
  complexity: "intermediate",
  frequency: "high",
  permission: "read",
  allowedRoles: ["developer", "stakeholder", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      table_name: {
        type: "string",
        description: "Table name (e.g., 'incident', 'change_request')",
      },
      config_types: {
        type: "array",
        items: {
          type: "string",
          enum: [...TABLE_CONFIG_TYPES],
        },
        description: "Filter to specific config types. Default: all types.",
      },
      active_only: {
        type: "boolean",
        description: "Only include active configurations (default: true)",
        default: true,
      },
      include_scripts: {
        type: "boolean",
        description: "Include script bodies in results (larger payload, default: false)",
        default: false,
      },
      scope: {
        type: "string",
        description: "Filter by application scope sys_id",
      },
      limit_per_type: {
        type: "number",
        description: "Maximum configs per type (default: 50)",
        default: 50,
      },
    },
    required: ["table_name"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    table_name,
    config_types,
    active_only = true,
    include_scripts = false,
    scope,
    limit_per_type = 50,
  } = args

  if (!table_name) {
    return createErrorResult("table_name is required")
  }

  try {
    const client = await getAuthenticatedClient(context)

    // Determine which config types to query
    const typesToQuery: ConfigType[] = config_types && config_types.length > 0
      ? config_types.filter((t: string) => TABLE_CONFIG_TYPES.includes(t as ConfigType)) as ConfigType[]
      : [...TABLE_CONFIG_TYPES]

    // Build and execute queries in parallel
    const queryPromises = typesToQuery.map(async (configType) => {
      const config = CONFIG_TYPE_QUERIES[configType]
      const queryParts: string[] = []

      // Table filter - special handling per type
      if (configType === "acls") {
        // ACLs use name field which is "table.field" or "table.*"
        queryParts.push(`nameLIKE${table_name}`)
      } else if (configType === "script_includes") {
        // Script includes don't have a table field - search script body
        queryParts.push(`scriptLIKEGlideRecord('${table_name}')^ORscriptLIKEGlideRecord("${table_name}")`)
      } else {
        queryParts.push(`${config.tableFilter}=${table_name}`)
      }

      if (active_only) queryParts.push("active=true")
      if (scope) queryParts.push(`sys_scope=${scope}`)

      const fields = include_scripts
        ? config.fields + ",script"
        : config.fields

      try {
        const response = await client.get(`/api/now/table/${config.table}`, {
          params: {
            sysparm_query: queryParts.join("^") + "^ORDERBYname",
            sysparm_fields: fields,
            sysparm_limit: limit_per_type,
            sysparm_count: "true",
          },
        })

        const records = response.data.result || []
        const totalCount = parseInt(response.headers["x-total-count"] || String(records.length), 10)

        return {
          type: configType,
          records,
          total_count: totalCount,
          truncated: totalCount > limit_per_type,
        }
      } catch (error: any) {
        return {
          type: configType,
          records: [],
          total_count: 0,
          error: error.message,
        }
      }
    })

    const results = await Promise.allSettled(queryPromises)

    // Build configurations object
    const configurations: Record<string, any[]> = {}
    const byType: Record<string, number> = {}
    let totalConfigs = 0
    let activeCount = 0
    let inactiveCount = 0

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { type, records, total_count } = result.value
        configurations[type] = records
        byType[type] = total_count
        totalConfigs += total_count

        for (const record of records) {
          if (record.active === "true" || record.active === true) {
            activeCount++
          } else {
            inactiveCount++
          }
        }
      }
    }

    // Get table field definitions for context
    let fields: any[] = []
    try {
      const dictResponse = await client.get("/api/now/table/sys_dictionary", {
        params: {
          sysparm_query: `name=${table_name}^element!=NULL^elementISNOTEMPTY^ORDERBYelement`,
          sysparm_fields: "element,column_label,internal_type",
          sysparm_limit: 200,
        },
      })
      fields = (dictResponse.data.result || []).map((f: any) => ({
        name: f.element,
        label: f.column_label,
        type: f.internal_type?.value || f.internal_type,
      }))
    } catch {
      // Non-critical, skip
    }

    const resultData = {
      table: { name: table_name },
      configurations,
      summary: {
        total_configurations: totalConfigs,
        by_type: byType,
        active_count: activeCount,
        inactive_count: inactiveCount,
      },
      fields,
    }

    const summaryParts = Object.entries(byType)
      .filter(([, count]) => count > 0)
      .map(([type, count]) => `${type}: ${count}`)

    const summary = `Table "${table_name}" has ${totalConfigs} configurations. ${summaryParts.join(", ")}`

    return createSuccessResult(resultData, { apiCalls: typesToQuery.length + 1 }, summary)
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.0.0"
export const author = "Snow-Flow Dependency Map"
