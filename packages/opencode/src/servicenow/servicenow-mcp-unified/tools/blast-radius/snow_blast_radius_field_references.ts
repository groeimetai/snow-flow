/**
 * snow_blast_radius_field_references - Reverse field reference lookup
 *
 * For a given table.field, find every artifact that touches it across the
 * instance. Walks a comprehensive spec of artifact tables (see
 * `shared/metadata-tables.ts` — ARTIFACT_SPECS) rather than the hardcoded
 * six that earlier versions searched.
 *
 * Query strategy per spec:
 *   - Build a scope clause (table-field match, ACL name pattern, dotwalk, or
 *     global) so we only get records related to the target table
 *   - Build a content clause (scriptLIKE / conditionLIKE / structured `=`)
 *     so we only get records that mention the target field
 *   - Post-filter script matches via regex so "scriptLIKEstate" doesn't
 *     flag every record that happens to contain the substring "state"
 *   - Optionally walk the parent table chain via sys_db_object.super_class
 *     (include_parent_tables, default true)
 *
 * Per-type Promise.allSettled isolates plugin-specific failures (e.g.
 * Service Portal, Service Catalog, ATF not installed) — one artifact type
 * erroring never kills the overall scan.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from "../../shared/types.js"
import { getAuthenticatedClient } from "../../shared/auth.js"
import { createSuccessResult, createErrorResult } from "../../shared/error-handler.js"
import { analyzeScript, scriptReferencesField } from "./shared/script-analyzer.js"
import { ARTIFACT_SPECS, ArtifactSearchSpec, ARTIFACT_TYPE_NAMES } from "./shared/metadata-tables.js"

export const toolDefinition: MCPToolDefinition = {
  name: "snow_blast_radius_field_references",
  description: `Find every artifact that references a specific table field across the instance.

📋 USE THIS TO:
- Audit all references to a field before changing or removing it
- Understand the full blast radius of a field rename or refactor
- Find reads vs writes vs condition uses

🔍 EXAMPLE: "What touches incident.assignment_group?"

📊 COVERAGE (v2):
- Business rules, client scripts, UI actions, UI policies (+ actions), ACLs
- Data policies (+ rules), email notifications, metric definitions
- Script includes, scheduled jobs, fix scripts, script actions, UI scripts
- Scripted REST resources, processors, email scripts, inbound email actions
- Service Portal widgets, catalog client scripts, catalog UI policies
- Transform entries/scripts, ATF step inputs, dictionary dependent fields
- Condition/filter columns (not just scripts) are searched where relevant
- Parent tables are walked via sys_db_object.super_class (opt-out)

⚠️ LIMITATIONS:
- Reference dotwalks (current.assignment_group.manager) are not resolved
- Dynamic field access (gr.setValue(someVar, value)) cannot be detected
- Availability of scoped artifact tables depends on installed plugins`,
  category: "blast-radius",
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
          enum: ARTIFACT_TYPE_NAMES,
        },
        description: "Limit search to specific artifact types. Default: all.",
      },
      include_inactive: {
        type: "boolean",
        description: "Include inactive artifacts (default: false)",
        default: false,
      },
      include_parent_tables: {
        type: "boolean",
        description:
          "Also search artifacts scoped to parent tables in the class hierarchy (e.g. 'task' when querying 'incident'). Default: true.",
        default: true,
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

interface SearchResult {
  type: string
  records: ProcessedRecord[]
  total_count: number
  verified_count: number
  truncated: boolean
  error?: string
}

interface ProcessedRecord {
  sys_id: string
  name: string
  scope?: string
  reference_type?: "read" | "write" | "condition" | "structured"
  [key: string]: any
}

/**
 * Resolve the parent-table chain via sys_db_object.super_class.
 * Returns [tableName, ...parents] up to `maxDepth` (inclusive).
 */
async function resolveTableChain(client: any, table: string, maxDepth = 3): Promise<string[]> {
  const chain: string[] = [table]
  let current = table
  for (let i = 0; i < maxDepth; i++) {
    try {
      const res = await client.get("/api/now/table/sys_db_object", {
        params: {
          sysparm_query: `name=${current}`,
          sysparm_fields: "super_class.name",
          sysparm_limit: 1,
        },
      })
      const row = res.data.result?.[0]
      const parent = row?.["super_class.name"] || row?.super_class?.name
      if (!parent || parent === "" || chain.includes(parent)) break
      chain.push(parent)
      current = parent
    } catch {
      break
    }
  }
  return chain
}

/**
 * Build the table-scope clause for a given spec + table name.
 * Returns the sysparm_query fragment (empty string for global).
 */
function buildScopeClause(spec: ArtifactSearchSpec, tables: string[], fieldName: string): string {
  const s = spec.scope
  if (s.kind === "global") return ""
  if (s.kind === "tableField") {
    const parts = tables.map((t) => `${s.field}=${t}`)
    return parts.length === 1 ? parts[0] : `${parts.join("^OR")}`
  }
  if (s.kind === "dotwalk") {
    const parts = tables.map((t) => s.query(t))
    return parts.join("^OR")
  }
  if (s.kind === "aclName") {
    // name="<table>.<field>" OR name="<table>.*" — both apply
    const parts: string[] = []
    for (const t of tables) {
      parts.push(`name=${t}.${fieldName}`)
      parts.push(`name=${t}.*`)
    }
    return parts.join("^OR")
  }
  return ""
}

/**
 * Build the content-match clause: script LIKE field OR condition LIKE field OR structured = field.
 *
 * For global-scope artifacts (no table filter to narrow on — script_includes,
 * scheduled_jobs, widgets, fix_scripts, ...) we use tighter patterns that
 * match *real* field references (.field / 'field' / "field") instead of any
 * substring containing the field name. Without this, a common field like
 * "priority" on a common table like "incident" returns hundreds of candidates
 * in the global pool, blows past `limit_per_type`, and hides real matches
 * behind truncation.
 */
function buildContentClause(spec: ArtifactSearchSpec, fieldName: string): string {
  const parts: string[] = []
  const scriptPatterns =
    spec.scope.kind === "global"
      ? [`.${fieldName}`, `'${fieldName}'`, `"${fieldName}"`]
      : [fieldName]

  for (const col of spec.scriptFields) {
    for (const pattern of scriptPatterns) parts.push(`${col}LIKE${pattern}`)
  }
  for (const col of spec.conditionFields || []) parts.push(`${col}LIKE${fieldName}`)
  for (const sf of spec.structuredFields || []) parts.push(`${sf.column}=${fieldName}`)
  if (parts.length === 0) return ""
  return parts.length === 1 ? parts[0] : parts.join("^OR")
}

/**
 * For global (no-scope) artifacts we add a secondary requirement that the
 * table name appears somewhere in the script. Reduces false positives
 * (e.g. stops a scheduled job that mentions "state" but never touches our
 * target table from being flagged). Heuristic — won't catch dynamic
 * `new GlideRecord(varName)` patterns.
 */
function buildGlobalTableHint(spec: ArtifactSearchSpec, tables: string[]): string {
  if (spec.scope.kind !== "global") return ""
  const cols = spec.scriptFields
  if (cols.length === 0) return ""
  const parts: string[] = []
  for (const col of cols) {
    for (const t of tables) {
      parts.push(`${col}LIKE${t}`)
    }
  }
  return parts.length === 1 ? parts[0] : parts.join("^OR")
}

/**
 * Post-filter: does this record actually reference the target field (vs
 * just containing it as a substring)? Structured matches are trusted.
 */
function recordReferencesField(
  record: Record<string, unknown>,
  spec: ArtifactSearchSpec,
  fieldName: string,
): boolean {
  // Field-level ACL whose name is "<table>.<field>" is a structural reference
  // — always relevant regardless of script contents.
  if (spec.type === "acls") {
    const name = record.name
    const resolved = typeof name === "object" && name !== null ? (name as any).value : name
    if (typeof resolved === "string" && resolved.endsWith("." + fieldName)) return true
  }

  // Structured field match is authoritative
  for (const sf of spec.structuredFields || []) {
    const val = record[sf.column]
    const resolved = typeof val === "object" && val !== null ? (val as any).value : val
    if (resolved === fieldName) return true
  }

  // Script columns — use regex to distinguish real refs from substrings
  for (const col of spec.scriptFields) {
    const script = record[col]
    if (typeof script === "string" && scriptReferencesField(script, fieldName)) return true
  }

  // Condition columns — encoded queries use `field=`, `field!=`, `field>=` etc
  for (const col of spec.conditionFields || []) {
    const cond = record[col]
    if (typeof cond === "string" && conditionReferencesField(cond, fieldName)) return true
  }

  return false
}

/**
 * Check if a condition/encoded-query column actually references the field.
 */
function conditionReferencesField(value: string, fieldName: string): boolean {
  if (!value) return false
  // Encoded query tokens: fieldName=, fieldName!=, fieldName>=, fieldName>, fieldNameLIKE, fieldNameISNOTEMPTY, fieldNameISEMPTY
  const pattern = new RegExp(
    `(^|\\^)${fieldName}(=|!=|>=|<=|>|<|LIKE|STARTSWITH|ENDSWITH|IN|NOTIN|ISEMPTY|ISNOTEMPTY|CHANGES|ANYTHING|ON|BETWEEN)`,
  )
  return pattern.test(value)
}

/**
 * Classify a hit as read / write / condition / structured using the
 * script-analyzer for script-bearing artifacts.
 */
function classifyRecord(
  record: Record<string, unknown>,
  spec: ArtifactSearchSpec,
  fieldName: string,
): "read" | "write" | "condition" | "structured" {
  // Field-level ACL name match is a structural reference
  if (spec.type === "acls") {
    const name = record.name
    const resolved = typeof name === "object" && name !== null ? (name as any).value : name
    if (typeof resolved === "string" && resolved.endsWith("." + fieldName)) return "structured"
  }

  // Structured field match (ui_policy_action.field, data_policy_rule.table_field, metric_definition.field, ...)
  for (const sf of spec.structuredFields || []) {
    const val = record[sf.column]
    const resolved = typeof val === "object" && val !== null ? (val as any).value : val
    if (resolved === fieldName) return "structured"
  }

  // Check scripts for read/write classification
  for (const col of spec.scriptFields) {
    const script = record[col]
    if (typeof script !== "string") continue
    const analysis = analyzeScript(script)
    const isWrite = analysis.fields_written.some((f) => f.field === fieldName)
    if (isWrite) return "write"
    const isRead = analysis.fields_read.some((f) => f.field === fieldName)
    if (isRead) return "read"
  }

  // Condition-field-only hit
  for (const col of spec.conditionFields || []) {
    const cond = record[col]
    if (typeof cond === "string" && conditionReferencesField(cond, fieldName)) return "condition"
  }

  return "condition"
}

function extractName(record: Record<string, any>, spec: ArtifactSearchSpec): string {
  if (spec.nameField) {
    const v = record[spec.nameField]
    if (typeof v === "string" && v) return v
  }
  return (
    record.name ||
    record.short_description ||
    record.id ||
    record.step_config?.display_value ||
    record.sys_id ||
    "Unknown"
  )
}

function extractScope(record: Record<string, any>): string | undefined {
  const s = record.sys_scope
  if (!s) return undefined
  return typeof s === "object" ? s.value || s.display_value : s
}

async function searchAclsSpecial(
  client: any,
  spec: ArtifactSearchSpec,
  tables: string[],
  fieldName: string,
  activeFilter: string,
  limitPerType: number,
): Promise<SearchResult> {
  try {
    const fieldNames = tables.map((t) => `name=${t}.${fieldName}`).join("^OR")
    const wildcardNames = tables.map((t) => `name=${t}.*`).join("^OR")
    const contentClause = buildContentClause(spec, fieldName)
    const activeClause = activeFilter ? activeFilter.replace(/^\^/, "") : ""

    const fields = `${spec.selectFields},script,condition`

    // Query 1: field-level ACLs (always relevant)
    const q1Parts = [fieldNames]
    if (activeClause) q1Parts.push(activeClause)

    // Query 2: wildcard ACLs AND-gated by content match
    const q2Parts = [wildcardNames]
    if (contentClause) q2Parts.push(contentClause)
    if (activeClause) q2Parts.push(activeClause)

    const [r1, r2] = await Promise.all([
      client.get(`/api/now/table/${spec.table}`, {
        params: {
          sysparm_query: q1Parts.join("^"),
          sysparm_fields: fields,
          sysparm_limit: limitPerType,
          sysparm_count: "true",
          sysparm_display_value: "all",
        },
      }),
      contentClause
        ? client.get(`/api/now/table/${spec.table}`, {
            params: {
              sysparm_query: q2Parts.join("^"),
              sysparm_fields: fields,
              sysparm_limit: limitPerType,
              sysparm_count: "true",
              sysparm_display_value: "all",
            },
          })
        : Promise.resolve({ data: { result: [] }, headers: {} }),
    ])

    const raw: Record<string, any>[] = [...(r1.data.result || []), ...(r2.data.result || [])]
    const seen = new Set<string>()
    const records: Record<string, any>[] = []
    for (const r of raw) {
      const sid = typeof r.sys_id === "object" ? r.sys_id?.value : r.sys_id
      if (!sid || seen.has(sid)) continue
      seen.add(sid)
      records.push(r)
    }

    const totalCount =
      parseInt(r1.headers["x-total-count"] || r1.headers["X-Total-Count"] || "0", 10) +
      parseInt(r2.headers?.["x-total-count"] || r2.headers?.["X-Total-Count"] || "0", 10)

    const verified = records
      .filter((r) => recordReferencesField(r, spec, fieldName))
      .map((r): ProcessedRecord => {
        const nameRaw = typeof r.name === "object" ? r.name.value : r.name
        return {
          sys_id: typeof r.sys_id === "object" ? r.sys_id.value : r.sys_id,
          name: nameRaw || "Unknown",
          scope: extractScope(r),
          reference_type: classifyRecord(r, spec, fieldName),
          operation: typeof r.operation === "object" ? r.operation.value : r.operation,
          acl_type: typeof r.type === "object" ? r.type.value : r.type,
        }
      })

    return {
      type: spec.type,
      records: verified,
      total_count: totalCount,
      verified_count: verified.length,
      truncated: totalCount > records.length,
    }
  } catch (error: any) {
    return {
      type: spec.type,
      records: [],
      total_count: 0,
      verified_count: 0,
      truncated: false,
      error: error.message || String(error),
    }
  }
}

async function searchArtifactType(
  client: any,
  spec: ArtifactSearchSpec,
  tables: string[],
  fieldName: string,
  activeFilter: string,
  limitPerType: number,
): Promise<SearchResult> {
  // ACLs need two queries: structural name=<table>.<field> matches must be
  // returned unconditionally, while name=<table>.* matches only count if
  // script/condition actually mentions the field. ServiceNow's left-to-right
  // ^/^OR precedence can't express this in a single query.
  if (spec.type === "acls") {
    return searchAclsSpecial(client, spec, tables, fieldName, activeFilter, limitPerType)
  }

  try {
    const scopeClause = buildScopeClause(spec, tables, fieldName)
    const contentClause = buildContentClause(spec, fieldName)
    const globalHint = buildGlobalTableHint(spec, tables)

    const clauses: string[] = []
    if (scopeClause) clauses.push(scopeClause)
    if (contentClause) clauses.push(contentClause)
    if (globalHint) clauses.push(globalHint)
    if (activeFilter) clauses.push(activeFilter.replace(/^\^/, ""))

    if (clauses.length === 0) {
      return { type: spec.type, records: [], total_count: 0, verified_count: 0, truncated: false }
    }

    const query = clauses.join("^")

    // Include script/condition columns in the select so we can post-filter and classify
    const extraCols = [...spec.scriptFields, ...(spec.conditionFields || [])].filter(
      (c) => !spec.selectFields.includes(c),
    )
    const fields = extraCols.length > 0 ? `${spec.selectFields},${extraCols.join(",")}` : spec.selectFields

    const response = await client.get(`/api/now/table/${spec.table}`, {
      params: {
        sysparm_query: query,
        sysparm_fields: fields,
        sysparm_limit: limitPerType,
        sysparm_count: "true",
        sysparm_display_value: "all",
      },
    })

    const records: Record<string, any>[] = response.data.result || []
    const totalCount = parseInt(
      response.headers["x-total-count"] || response.headers["X-Total-Count"] || String(records.length),
      10,
    )

    const verified = records
      .filter((r) => recordReferencesField(r, spec, fieldName))
      .map((r) => {
        const entry: ProcessedRecord = {
          sys_id: typeof r.sys_id === "object" ? r.sys_id.value : r.sys_id,
          name: extractName(r, spec),
          scope: extractScope(r),
          reference_type: classifyRecord(r, spec, fieldName),
        }

        // Type-specific enrichments
        if (spec.type === "business_rules") {
          entry.when = typeof r.when === "object" ? r.when.value : r.when
          entry.operations = {
            insert: (r.action_insert?.value || r.action_insert) === "true",
            update: (r.action_update?.value || r.action_update) === "true",
            delete: (r.action_delete?.value || r.action_delete) === "true",
            query: (r.action_query?.value || r.action_query) === "true",
          }
        }
        if (spec.type === "client_scripts" || spec.type === "catalog_client_scripts") {
          entry.script_type = typeof r.type === "object" ? r.type.value : r.type
        }
        if (spec.type === "acls") {
          entry.operation = typeof r.operation === "object" ? r.operation.value : r.operation
          entry.acl_type = typeof r.type === "object" ? r.type.value : r.type
        }
        if (spec.type === "script_includes") {
          entry.api_name = typeof r.api_name === "object" ? r.api_name.value : r.api_name
        }
        if (spec.type === "ui_policy_actions") {
          entry.field = typeof r.field === "object" ? r.field.value : r.field
          entry.visible = typeof r.visible === "object" ? r.visible.value : r.visible
          entry.mandatory = typeof r.mandatory === "object" ? r.mandatory.value : r.mandatory
          entry.disabled = typeof r.disabled === "object" ? r.disabled.value : r.disabled
          entry.ui_policy = r["ui_policy.short_description"] || r.ui_policy?.display_value
        }
        if (spec.type === "data_policy_rules") {
          entry.field = typeof r.table_field === "object" ? r.table_field.value : r.table_field
          entry.policy = r["sys_data_policy.short_description"] || r.sys_data_policy?.display_value
        }
        if (spec.type === "transform_entries") {
          entry.target_field = typeof r.target_field === "object" ? r.target_field.value : r.target_field
          entry.source_field = typeof r.source_field === "object" ? r.source_field.value : r.source_field
          entry.map = r["map.name"] || r.map?.display_value
        }

        return entry
      })

    return {
      type: spec.type,
      records: verified,
      total_count: totalCount,
      verified_count: verified.length,
      truncated: totalCount > records.length,
    }
  } catch (error: any) {
    return {
      type: spec.type,
      records: [],
      total_count: 0,
      verified_count: 0,
      truncated: false,
      error: error.message || String(error),
    }
  }
}

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    table_name,
    field_name,
    artifact_types,
    include_inactive = false,
    include_parent_tables = true,
    limit_per_type = 25,
  } = args

  if (!table_name || !field_name) {
    return createErrorResult("table_name and field_name are required")
  }

  try {
    const client = await getAuthenticatedClient(context)

    // Resolve parent table chain (best-effort; non-critical)
    const tables = include_parent_tables ? await resolveTableChain(client, table_name) : [table_name]

    const activeFilter = include_inactive ? "" : "^active=true"

    // Filter specs to requested types
    const specs =
      artifact_types && artifact_types.length > 0
        ? ARTIFACT_SPECS.filter((s) => artifact_types.includes(s.type))
        : ARTIFACT_SPECS

    // Run all searches in parallel
    const results = await Promise.allSettled(
      specs.map((spec) => searchArtifactType(client, spec, tables, field_name, activeFilter, limit_per_type)),
    )

    // Aggregate
    const references: Record<string, ProcessedRecord[]> = {}
    const byType: Record<string, number> = {}
    const truncatedTypes: string[] = []
    const erroredTypes: Record<string, string> = {}
    let totalRefs = 0
    let reads = 0
    let writes = 0
    let conditions = 0
    let structured = 0

    for (const result of results) {
      if (result.status === "fulfilled") {
        const r = result.value
        references[r.type] = r.records
        byType[r.type] = r.verified_count
        totalRefs += r.verified_count
        if (r.truncated) truncatedTypes.push(r.type)
        if (r.error) erroredTypes[r.type] = r.error

        for (const record of r.records) {
          if (record.reference_type === "read") reads++
          else if (record.reference_type === "write") writes++
          else if (record.reference_type === "structured") structured++
          else conditions++
        }
      }
    }

    // Field metadata
    const fieldMeta: Record<string, any> = { table: table_name, name: field_name }
    if (tables.length > 1) fieldMeta.parent_tables = tables.slice(1)
    try {
      const dictResponse = await client.get("/api/now/table/sys_dictionary", {
        params: {
          sysparm_query: `name=${table_name}^element=${field_name}`,
          sysparm_fields: "element,column_label,internal_type,reference,max_length,mandatory",
          sysparm_limit: 1,
        },
      })
      const d = dictResponse.data.result?.[0]
      if (d) {
        fieldMeta.label = d.column_label
        fieldMeta.type = typeof d.internal_type === "object" ? d.internal_type.value : d.internal_type
        if (d.reference) fieldMeta.reference_table = typeof d.reference === "object" ? d.reference.value : d.reference
        fieldMeta.mandatory = d.mandatory === "true" || d.mandatory === true
      }
    } catch {
      // non-critical
    }

    const impactWarning =
      totalRefs > 50
        ? `This field is referenced by ${totalRefs} artifacts. Changes require careful testing and a maintenance window.`
        : totalRefs > 20
          ? `This field is referenced by ${totalRefs} artifacts. Changes should be thoroughly tested.`
          : null

    const resultData: Record<string, any> = {
      field: fieldMeta,
      references,
      summary: {
        total_references: totalRefs,
        by_type: byType,
        reads,
        writes,
        conditions,
        structured,
      },
      searched_tables: tables,
      searched_artifact_types: specs.map((s) => s.type),
      truncated_types: truncatedTypes,
      impact_warning: impactWarning,
    }

    if (Object.keys(erroredTypes).length > 0) {
      resultData.errors_by_type = erroredTypes
      resultData.note =
        "Some artifact types returned errors — typically because the relevant ServiceNow plugin is not activated on this instance. Remaining types were searched successfully."
    }

    const summary = `Field "${table_name}.${field_name}" is referenced by ${totalRefs} artifacts (${reads} reads, ${writes} writes, ${conditions} conditions, ${structured} structured). Searched ${specs.length} artifact types across ${tables.length} table(s).${impactWarning ? " ⚠️ " + impactWarning : ""}`

    return createSuccessResult(resultData, { apiCalls: specs.length + 2 }, summary)
  } catch (error: any) {
    return createErrorResult(error.message)
  }
}

export const version = "2.0.0"
export const author = "Snow-Flow Blast Radius"
