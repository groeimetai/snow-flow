/**
 * snow_blast_radius_reverse_dependencies - Find what depends on an artifact
 *
 * Reverse dependency analysis: for a given artifact (e.g., a script include),
 * find all other artifacts that call or reference it.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { ARTIFACT_TABLE_MAP } from "./shared/metadata-tables.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_blast_radius_reverse_dependencies",
  description: `Find what depends on a given artifact (reverse dependency analysis).

📋 USE THIS TO:
- Find all artifacts that call a script include
- See what references a specific business rule or UI action
- Assess the blast radius of changing or removing an artifact
- Identify cross-scope dependencies

🔍 EXAMPLE: "What calls the IncidentUtils script include?"

📊 RETURNS:
- List of dependent artifacts with type, table, and scope
- Cross-scope dependency detection
- Impact warning for widely-used artifacts`,
  category: "blast-radius",
  subcategory: "dependency-analysis",
  use_cases: ["impact-analysis", "dependency-audit", "refactoring"],
  complexity: "advanced",
  frequency: "medium",
  permission: "read",
  allowedRoles: ["developer", "stakeholder", "admin"],
  inputSchema: {
    type: "object",
    properties: {
      artifact_type: {
        type: "string",
        enum: ["script_include", "business_rule", "client_script", "ui_action", "widget", "table"],
        description: "Type of artifact to find dependents of",
      },
      artifact_identifier: {
        type: "string",
        description: "sys_id, api_name (for script includes), or table name",
      },
      search_scope: {
        type: "string",
        enum: ["same_app", "all"],
        description: "Search within same app scope or across all scopes (default: all)",
        default: "all",
      },
      limit: {
        type: "number",
        description: "Maximum number of dependents to return (default: 50)",
        default: 50,
      },
    },
    required: ["artifact_type", "artifact_identifier"],
  },
}

interface SearchTarget {
  type: string
  table: string
  scriptField: string
  fields: string
}

const SEARCH_TARGETS: SearchTarget[] = [
  {
    type: "business_rule",
    table: "sys_script",
    scriptField: "script",
    fields: "sys_id,name,collection,active,sys_scope",
  },
  {
    type: "client_script",
    table: "sys_script_client",
    scriptField: "script",
    fields: "sys_id,name,table,active,sys_scope",
  },
  {
    type: "ui_action",
    table: "sys_ui_action",
    scriptField: "script",
    fields: "sys_id,name,table,active,sys_scope",
  },
  {
    type: "script_include",
    table: "sys_script_include",
    scriptField: "script",
    fields: "sys_id,name,api_name,active,sys_scope",
  },
  {
    type: "ui_policy",
    table: "sys_ui_policy",
    scriptField: "script_true",
    fields: "sys_id,short_description,table,active,sys_scope",
  },
]

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    artifact_type,
    artifact_identifier,
    search_scope = "all",
    limit = 50,
  } = args

  if (!artifact_type || !artifact_identifier) {
    return createErrorResult("artifact_type and artifact_identifier are required")
  }

  try {
    const client = await getAuthenticatedClient(context)

    // Step 1: Resolve the artifact to get its identifiers
    let artifactName: string = artifact_identifier
    let artifactScope: string | null = null
    let searchPatterns: string[] = []

    if (artifact_type === "table") {
      // For tables, search for GlideRecord references
      searchPatterns = [
        `GlideRecord('${artifact_identifier}')`,
        `GlideRecord("${artifact_identifier}")`,
        `GlideAggregate('${artifact_identifier}')`,
        `GlideAggregate("${artifact_identifier}")`,
      ]
      artifactName = artifact_identifier
    } else if (artifact_type === "script_include") {
      // Try to resolve script include by name or sys_id
      try {
        const isGuid = /^[a-f0-9]{32}$/.test(artifact_identifier)
        const siQuery = isGuid
          ? `sys_id=${artifact_identifier}`
          : `name=${artifact_identifier}^ORapi_name=${artifact_identifier}`

        const siResponse = await client.get("/api/now/table/sys_script_include", {
          params: {
            sysparm_query: siQuery,
            sysparm_fields: "sys_id,name,api_name,sys_scope",
            sysparm_limit: 1,
          },
        })

        const si = siResponse.data.result?.[0]
        if (si) {
          artifactName = si.name
          artifactScope = si.sys_scope?.value || si.sys_scope
          searchPatterns = [
            `new ${si.name}(`,
            si.name,
          ]
          if (si.api_name && si.api_name !== si.name) {
            searchPatterns.push(si.api_name)
          }
        } else {
          searchPatterns = [`new ${artifact_identifier}(`, artifact_identifier]
        }
      } catch {
        searchPatterns = [`new ${artifact_identifier}(`, artifact_identifier]
      }
    } else {
      // For other artifact types, resolve by sys_id
      const mapping = ARTIFACT_TABLE_MAP[artifact_type]
      if (mapping) {
        try {
          const artResponse = await client.get(`/api/now/table/${mapping.table}/${artifact_identifier}`)
          const art = artResponse.data.result
          if (art) {
            artifactName = art.name || art.short_description || artifact_identifier
            artifactScope = art.sys_scope?.value || art.sys_scope
            searchPatterns = [artifactName]
          }
        } catch {
          searchPatterns = [artifact_identifier]
        }
      } else {
        searchPatterns = [artifact_identifier]
      }
    }

    if (searchPatterns.length === 0) {
      return createErrorResult("Could not determine search patterns for the artifact")
    }

    // Step 2: Search across all metadata tables for references
    const perTypeLimit = Math.ceil(limit / SEARCH_TARGETS.length)

    const searchPromises = SEARCH_TARGETS.map(async (target) => {
      // Build LIKE query for all patterns
      const likeConditions = searchPatterns
        .map((p) => `${target.scriptField}LIKE${p}`)
        .join("^OR")

      const queryParts = [likeConditions]

      // Scope filter
      if (search_scope === "same_app" && artifactScope) {
        queryParts.push(`sys_scope=${artifactScope}`)
      }

      try {
        const response = await client.get(`/api/now/table/${target.table}`, {
          params: {
            sysparm_query: queryParts.join("^"),
            sysparm_fields: target.fields,
            sysparm_limit: perTypeLimit,
            sysparm_count: "true",
          },
        })

        const records = response.data.result || []
        const totalCount = parseInt(response.headers["x-total-count"] || String(records.length), 10)

        // Map to dependent format
        const dependents = records.map((record: any) => {
          const recordScope = record.sys_scope?.value || record.sys_scope
          return {
            sys_id: record.sys_id,
            name: record.name || record.short_description || "Unknown",
            type: target.type,
            table: record.collection || record.table || null,
            scope: recordScope,
            cross_scope: artifactScope ? recordScope !== artifactScope : false,
          }
        })

        // Filter out self-references
        return {
          type: target.type,
          dependents: dependents.filter((d: any) => d.sys_id !== artifact_identifier),
          total_count: totalCount,
        }
      } catch (error: any) {
        return {
          type: target.type,
          dependents: [],
          total_count: 0,
          error: error.message,
        }
      }
    })

    const results = await Promise.allSettled(searchPromises)

    // Step 3: Aggregate results
    const allDependents: any[] = []
    const byType: Record<string, number> = {}
    let crossScopeCount = 0

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { type, dependents } = result.value
        allDependents.push(...dependents)
        byType[type] = dependents.length

        for (const dep of dependents) {
          if (dep.cross_scope) crossScopeCount++
        }
      }
    }

    const impactWarning = allDependents.length > 20
      ? `This artifact has ${allDependents.length} dependents. Modifying it requires careful testing across ${crossScopeCount > 0 ? `${crossScopeCount} cross-scope references and ` : ""}all dependent artifacts.`
      : crossScopeCount > 0
        ? `This artifact has ${crossScopeCount} cross-scope dependent${crossScopeCount === 1 ? "" : "s"}. Changes may affect other application scopes.`
        : null

    const resultData = {
      artifact: {
        name: artifactName,
        type: artifact_type,
        identifier: artifact_identifier,
        scope: artifactScope,
      },
      dependents: allDependents,
      summary: {
        total_dependents: allDependents.length,
        by_type: byType,
        cross_scope_count: crossScopeCount,
      },
      impact_warning: impactWarning,
    }

    const summary = `"${artifactName}" (${artifact_type}) has ${allDependents.length} dependent${allDependents.length === 1 ? "" : "s"}${crossScopeCount > 0 ? ` (${crossScopeCount} cross-scope)` : ""}.${impactWarning ? " ⚠️" : ""}`

    return createSuccessResult(resultData, { apiCalls: SEARCH_TARGETS.length + 1 }, summary)
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "1.0.0"
export const author = "Snow-Flow Blast Radius"
