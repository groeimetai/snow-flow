/**
 * snow_blast_radius_dependents - Find every artifact that uses a given one
 *
 * The go-to "what will break if I touch this?" tool. Uses a 3-phase deep
 * search so it never silently misses a caller:
 *   1. Curated catalog (25+ artifact types from ARTIFACT_SPECS)
 *   2. sys_dictionary discovery (every table with script-type fields)
 *   3. Long-tail batch search (concurrency-limited)
 *
 * Looks in business rules, client scripts, UI actions + policies, script
 * includes, workflows, flow actions, email notifications, inbound email
 * actions, catalog client scripts / UI policies, scheduled jobs, fix
 * scripts, transform scripts, processors, ACLs, metric definitions, ATF
 * steps, and any custom script-bearing table the customer has added
 * (discovered dynamically via sys_dictionary).
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { ARTIFACT_TABLE_MAP } from "./shared/metadata-tables.js"
import { searchDependents, type SearchPattern } from "./shared/deep-search.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_blast_radius_dependents",
  description: `Find every artifact on the instance that USES / CALLS / DEPENDS ON a given artifact. Answers: "what breaks if I change or delete this?"

🛑 CALL THIS BEFORE:
- Deleting a script include, business rule, client script, UI action, UI policy, or widget
- Refactoring the name / api_name / signature of any script include
- Removing a table
- Promoting a breaking change to another instance
- Telling the user "it's safe to remove X"

The output is the impact list — every caller, every referrer, in every
scope. Do not rely on reading 5 tables by hand; this tool scans 100+
tables including workflows, notifications, email actions, catalog
scripts, scheduled jobs, and custom scripted tables.

🔍 TRIGGER PHRASES (agent should invoke this):
- "what uses X" / "what calls X" / "what references X"
- "wat gebruikt X" / "wat roept X aan" / "wat heeft X nodig"
- "can I delete X" / "is it safe to remove X" / "kan ik X verwijderen"
- "impact analysis" / "blast radius" / "dependency audit"
- User asks to refactor, rename, or remove a named artifact

🔍 EXAMPLES:
- "What calls the IncidentUtils script include?"
- "Is it safe to delete this business rule?"
- "Show me everything referencing the incident table"

📊 RETURNS:
- dependents[]: each with type, name, scope, source_table, source_field,
  cross_scope flag. source_table/source_field let you distinguish a
  workflow-condition hit from a business-rule hit — critical for triage.
- summary: by_type + by_table counts + cross_scope count + truncation flag.
- search_stats: per-phase timing + tables scanned + cache hit, so you
  know the scan was thorough (expect 100+ tables on a typical instance).

🔎 HOW IT SEARCHES (why you can trust the "none found"):
- Phase 1: 25+ curated artifact types (human-attributed labels)
- Phase 2: sys_dictionary discovery — every table with script-type fields
- Phase 3: concurrency-limited batch query over the long tail
Deep-only by design. Takes 2-10s depending on instance size.`,
  category: "blast-radius",
  subcategory: "dependency-analysis",
  use_cases: [
    "impact-analysis",
    "dependency-audit",
    "refactoring",
    "safe-delete-check",
    "find-callers",
    "find-references",
    "breaking-change-review",
    "blast-radius",
  ],
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
        description: "Maximum number of dependents to return (default: 100)",
        default: 100,
      },
      phase3_concurrency: {
        type: "number",
        description:
          "Parallel REST requests during Phase-3 long-tail search. Default 10. Raise on beefy instances.",
        default: 10,
      },
    },
    required: ["artifact_type", "artifact_identifier"],
  },
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    artifact_type,
    artifact_identifier,
    search_scope = "all",
    limit = 100,
    phase3_concurrency = 10,
  } = args

  if (!artifact_type || !artifact_identifier) {
    return createErrorResult("artifact_type and artifact_identifier are required")
  }

  try {
    const client = await getAuthenticatedClient(context)

    // Step 1: Resolve the artifact to get canonical name + scope + patterns.
    let artifactName: string = artifact_identifier
    let artifactScope: string | null = null
    let artifactSysId: string | undefined
    let patterns: SearchPattern[] = []

    if (artifact_type === "table") {
      patterns = [
        { like: `GlideRecord('${artifact_identifier}')` },
        { like: `GlideRecord("${artifact_identifier}")` },
        { like: `GlideAggregate('${artifact_identifier}')` },
        { like: `GlideAggregate("${artifact_identifier}")` },
      ]
      artifactName = artifact_identifier
    } else if (artifact_type === "script_include") {
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
          artifactScope = si.sys_scope?.value || si.sys_scope || null
          artifactSysId = si.sys_id
          patterns.push({ like: `new ${si.name}(` })
          // Bare name match needs a word-boundary confirm to avoid hits
          // inside unrelated identifiers ("ScooterUtilities" containing "Util").
          patterns.push({
            like: si.name,
            confirm: new RegExp(`\\b${escapeRegex(si.name)}\\b`),
          })
          if (si.api_name && si.api_name !== si.name) {
            patterns.push({
              like: si.api_name,
              confirm: new RegExp(`\\b${escapeRegex(si.api_name)}\\b`),
            })
          }
        } else {
          patterns.push({ like: `new ${artifact_identifier}(` })
          patterns.push({
            like: artifact_identifier,
            confirm: new RegExp(`\\b${escapeRegex(artifact_identifier)}\\b`),
          })
        }
      } catch {
        patterns.push({ like: `new ${artifact_identifier}(` })
        patterns.push({ like: artifact_identifier })
      }
    } else {
      // business_rule | client_script | ui_action | widget — resolve by sys_id
      const mapping = ARTIFACT_TABLE_MAP[artifact_type]
      if (mapping) {
        try {
          const artResponse = await client.get(`/api/now/table/${mapping.table}/${artifact_identifier}`)
          const art = artResponse.data.result
          if (art) {
            artifactName = art.name || art.short_description || artifact_identifier
            artifactScope = art.sys_scope?.value || art.sys_scope || null
            artifactSysId = art.sys_id
            patterns.push({
              like: artifactName,
              confirm: new RegExp(`\\b${escapeRegex(artifactName)}\\b`),
            })
          }
        } catch {
          patterns.push({ like: artifact_identifier })
        }
      } else {
        patterns.push({ like: artifact_identifier })
      }
    }

    if (patterns.length === 0) {
      return createErrorResult("Could not determine search patterns for the artifact")
    }

    // Step 2: Deep search via 3-phase engine.
    const cacheKey = context.sessionId || context.instanceUrl || "default"
    const { dependents, stats } = await searchDependents(client, cacheKey, {
      patterns,
      limit,
      scopeFilterSysId: search_scope === "same_app" && artifactScope ? artifactScope : undefined,
      selfSysId: artifactSysId,
      phase3Concurrency: Math.max(1, Math.min(phase3_concurrency, 25)),
    })

    // Step 3: Aggregate summary.
    const byType: Record<string, number> = {}
    const byTable: Record<string, number> = {}
    let crossScopeCount = 0
    for (const dep of dependents) {
      byType[dep.type] = (byType[dep.type] || 0) + 1
      byTable[dep.source_table] = (byTable[dep.source_table] || 0) + 1
      if (dep.cross_scope) crossScopeCount += 1
    }

    const impactWarning =
      dependents.length > 20
        ? `This artifact has ${dependents.length}${stats.truncated ? "+" : ""} dependents. Modifying it requires careful testing${crossScopeCount > 0 ? ` across ${crossScopeCount} cross-scope references and ` : ", "}all dependent artifacts.`
        : crossScopeCount > 0
          ? `This artifact has ${crossScopeCount} cross-scope dependent${crossScopeCount === 1 ? "" : "s"}. Changes may affect other application scopes.`
          : null

    const totalTablesScanned =
      stats.phase_1.tables + stats.phase_3.tables

    const resultData = {
      artifact: {
        name: artifactName,
        type: artifact_type,
        identifier: artifact_identifier,
        scope: artifactScope,
      },
      dependents,
      summary: {
        total_dependents: dependents.length,
        by_type: byType,
        by_table: byTable,
        cross_scope_count: crossScopeCount,
        tables_scanned: totalTablesScanned,
        truncated: stats.truncated,
      },
      search_stats: stats,
      impact_warning: impactWarning,
    }

    const humanSummary = [
      `"${artifactName}" (${artifact_type}) has ${dependents.length}${stats.truncated ? "+" : ""} dependent${dependents.length === 1 ? "" : "s"}`,
      crossScopeCount > 0 ? ` (${crossScopeCount} cross-scope)` : "",
      `. Searched ${totalTablesScanned} table${totalTablesScanned === 1 ? "" : "s"} in ${(stats.total_duration_ms / 1000).toFixed(1)}s`,
      impactWarning ? ". ⚠️" : "",
    ].join("")

    return createSuccessResult(
      resultData,
      {
        apiCalls:
          stats.phase_1.tables + stats.phase_3.tables + (stats.phase_2.cached ? 0 : 1) + 1,
        durationMs: stats.total_duration_ms,
      },
      humanSummary,
    )
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export const version = "2.0.0"
export const author = "Snow-Flow Blast Radius"
