/**
 * snow_dependency_map_field_references - Reverse field reference lookup
 *
 * The most powerful Dependency Map tool: for a given table.field,
 * find EVERY artifact that touches it across the entire instance.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { analyzeScript, scriptReferencesField } from "./shared/script-analyzer.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_dependency_map_field_references",
  description: `Find every artifact that references a specific table field.

📋 USE THIS TO:
- Before changing a field, see what business rules, client scripts, etc. touch it
- Audit all references to a field across the instance
- Understand the full impact of renaming or removing a field
- Find which artifacts read vs write a field

🔍 EXAMPLE: "What touches incident.assignment_group?"

📊 RETURNS:
- All business rules, client scripts, UI actions, UI policies, ACLs that reference the field
- Classification as read, write, or condition reference
- Impact warning for heavily-referenced fields`,
  category: "dependency-map",
  subcategory: "field-analysis",
  use_cases: ["impact-analysis", "field-audit", "change-risk"],
  complexity: "advanced",
  frequency: "high",
  permission: "read",
  allowedRoles: ["developer", "stakeholder", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      table_name: {
        type: "string",
        description: "Table name (e.g., 'incident')",
      },
      field_name: {
        type: "string",
        description: "Field name (e.g., 'assignment_group')",
      },
      artifact_types: {
        type: "array",
        items: {
          type: "string",
          enum: ["business_rules", "client_scripts", "ui_actions", "ui_policies", "acls", "script_includes"],
        },
        description: "Limit search to specific artifact types. Default: all.",
      },
      include_inactive: {
        type: "boolean",
        description: "Include inactive artifacts (default: false)",
        default: false,
      },
      limit_per_type: {
        type: "number",
        description: "Maximum results per artifact type (default: 25)",
        default: 25,
      },
    },
    required: ["table_name", "field_name"],
  },
}

interface ArtifactSearch {
  type: string
  table: string
  query: string
  fields: string
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    table_name,
    field_name,
    artifact_types,
    include_inactive = false,
    limit_per_type = 25,
  } = args

  if (!table_name || !field_name) {
    return createErrorResult("table_name and field_name are required")
  }

  try {
    const client = await getAuthenticatedClient(context)

    const activeFilter = include_inactive ? "" : "^active=true"

    // Define all search queries
    const allSearches: ArtifactSearch[] = [
      {
        type: "business_rules",
        table: "sys_script",
        query: `collection=${table_name}^scriptLIKE${field_name}${activeFilter}`,
        fields: "sys_id,name,when,order,active,script,action_insert,action_update,action_delete,action_query,sys_scope",
      },
      {
        type: "client_scripts",
        table: "sys_script_client",
        query: `table=${table_name}^scriptLIKE${field_name}${activeFilter}`,
        fields: "sys_id,name,type,field,active,script,sys_scope",
      },
      {
        type: "ui_actions",
        table: "sys_ui_action",
        query: `table=${table_name}^scriptLIKE${field_name}${activeFilter}`,
        fields: "sys_id,name,active,script,condition,sys_scope",
      },
      {
        type: "ui_policies",
        table: "sys_ui_policy_action",
        query: `field=${field_name}^ui_policy.table=${table_name}${include_inactive ? "" : "^ui_policy.active=true"}`,
        fields: "sys_id,field,value,visible,mandatory,disabled,ui_policy",
      },
      {
        type: "acls",
        table: "sys_security_acl",
        query: `nameLIKE${table_name}.${field_name}^ORscriptLIKE${field_name}${activeFilter}`,
        fields: "sys_id,name,operation,active,script,sys_scope",
      },
      {
        type: "script_includes",
        table: "sys_script_include",
        query: `scriptLIKE${field_name}^scriptLIKE${table_name}${activeFilter}`,
        fields: "sys_id,name,api_name,active,script,sys_scope",
      },
    ]

    // Filter to requested types
    const searches = artifact_types && artifact_types.length > 0
      ? allSearches.filter((s) => artifact_types.includes(s.type))
      : allSearches

    // Execute all searches in parallel
    const searchPromises = searches.map(async (search) => {
      try {
        const response = await client.get(`/api/now/table/${search.table}`, {
          params: {
            sysparm_query: search.query,
            sysparm_fields: search.fields,
            sysparm_limit: limit_per_type,
            sysparm_count: "true",
          },
        })

        const records = response.data.result || []
        const totalCount = parseInt(response.headers["x-total-count"] || String(records.length), 10)

        // Post-filter: verify actual field references using regex
        const verified = records.filter((record: any) => {
          // UI policy actions don't need script verification
          if (search.type === "ui_policies") return true
          // ACL name-based matches don't need script verification
          if (search.type === "acls" && record.name?.includes(`${table_name}.${field_name}`)) return true
          // Verify script-based matches
          return scriptReferencesField(record.script, field_name)
        })

        // Classify references as read/write/condition
        const classified = verified.map((record: any) => {
          const entry: any = {
            sys_id: record.sys_id,
            name: record.name || record.ui_policy?.display_value || "Unknown",
            scope: record.sys_scope?.value || record.sys_scope,
          }

          if (search.type === "business_rules") {
            entry.when = record.when
            entry.operations = {
              insert: record.action_insert === "true",
              update: record.action_update === "true",
              delete: record.action_delete === "true",
              query: record.action_query === "true",
            }
          }

          if (search.type === "client_scripts") {
            entry.type = record.type
          }

          if (search.type === "ui_policies") {
            entry.action_type = record.visible !== undefined ? "visibility" :
              record.mandatory !== undefined ? "mandatory" : "set_value"
            entry.value = record.value
          }

          if (search.type === "acls") {
            entry.operation = record.operation
          }

          if (search.type === "script_includes") {
            entry.api_name = record.api_name
          }

          // Determine reference type from script analysis
          if (record.script) {
            const analysis = analyzeScript(record.script)
            const isRead = analysis.fields_read.some((f) => f.field === field_name)
            const isWrite = analysis.fields_written.some((f) => f.field === field_name)
            entry.reference_type = isWrite ? "write" : isRead ? "read" : "condition"
          }

          // Remove script from output
          delete entry.script

          return entry
        })

        return {
          type: search.type,
          records: classified,
          total_count: totalCount,
          verified_count: classified.length,
        }
      } catch (error: any) {
        return {
          type: search.type,
          records: [],
          total_count: 0,
          verified_count: 0,
          error: error.message,
        }
      }
    })

    const results = await Promise.allSettled(searchPromises)

    // Build output
    const references: Record<string, any[]> = {}
    const byType: Record<string, number> = {}
    let totalRefs = 0
    let reads = 0
    let writes = 0
    let conditions = 0

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { type, records, verified_count } = result.value
        references[type] = records
        byType[type] = verified_count
        totalRefs += verified_count

        for (const record of records) {
          if (record.reference_type === "read") reads++
          else if (record.reference_type === "write") writes++
          else conditions++
        }
      }
    }

    // Get field metadata
    let fieldMeta: any = { table: table_name, name: field_name }
    try {
      const dictResponse = await client.get("/api/now/table/sys_dictionary", {
        params: {
          sysparm_query: `name=${table_name}^element=${field_name}`,
          sysparm_fields: "element,column_label,internal_type",
          sysparm_limit: 1,
        },
      })
      const dictRecord = dictResponse.data.result?.[0]
      if (dictRecord) {
        fieldMeta.label = dictRecord.column_label
        fieldMeta.type = dictRecord.internal_type?.value || dictRecord.internal_type
      }
    } catch {
      // Non-critical
    }

    const impactWarning = totalRefs > 30
      ? `This field is referenced by ${totalRefs} artifacts. Changes require careful testing and a maintenance window.`
      : totalRefs > 15
        ? `This field is referenced by ${totalRefs} artifacts. Changes should be thoroughly tested.`
        : null

    const resultData = {
      field: fieldMeta,
      references,
      summary: {
        total_references: totalRefs,
        by_type: byType,
        reads,
        writes,
        conditions,
      },
      impact_warning: impactWarning,
    }

    const summary = `Field "${table_name}.${field_name}" is referenced by ${totalRefs} artifacts (${reads} reads, ${writes} writes, ${conditions} conditions).${impactWarning ? " ⚠️ " + impactWarning : ""}`

    return createSuccessResult(resultData, { apiCalls: searches.length + 1 }, summary)
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.0.0"
export const author = "Snow-Flow Dependency Map"
