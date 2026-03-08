/**
 * Blast Radius - Metadata Table Constants
 *
 * Maps artifact types to their ServiceNow metadata tables,
 * script fields, and table reference fields.
 */

/**
 * Artifact type to ServiceNow table mapping
 */
export interface ArtifactTableMapping {
  table: string
  scriptFields: string[]
  tableField: string | null
  displayFields: string
}

export const ARTIFACT_TABLE_MAP: Record<string, ArtifactTableMapping> = {
  business_rule: {
    table: "sys_script",
    scriptFields: ["script"],
    tableField: "collection",
    displayFields: "sys_id,name,when,order,active,collection,sys_scope,action_insert,action_update,action_delete,action_query",
  },
  client_script: {
    table: "sys_script_client",
    scriptFields: ["script"],
    tableField: "table",
    displayFields: "sys_id,name,type,field,active,table,sys_scope,ui_type",
  },
  ui_action: {
    table: "sys_ui_action",
    scriptFields: ["script"],
    tableField: "table",
    displayFields: "sys_id,name,active,table,sys_scope,order,condition",
  },
  ui_policy: {
    table: "sys_ui_policy",
    scriptFields: ["script_true", "script_false"],
    tableField: "table",
    displayFields: "sys_id,short_description,active,table,sys_scope,order",
  },
  script_include: {
    table: "sys_script_include",
    scriptFields: ["script"],
    tableField: null,
    displayFields: "sys_id,name,api_name,active,sys_scope,client_callable,access",
  },
  acl: {
    table: "sys_security_acl",
    scriptFields: ["script"],
    tableField: "name",
    displayFields: "sys_id,name,operation,active,sys_scope,type",
  },
  flow: {
    table: "sys_hub_flow",
    scriptFields: [],
    tableField: null,
    displayFields: "sys_id,name,active,sys_scope,trigger_type",
  },
  widget: {
    table: "sp_widget",
    scriptFields: ["script", "client_script"],
    tableField: null,
    displayFields: "sys_id,name,id,active,sys_scope",
  },
}

/**
 * Configuration types queried per table in table_configs tool
 */
export const TABLE_CONFIG_TYPES = [
  "business_rules",
  "client_scripts",
  "ui_actions",
  "ui_policies",
  "acls",
  "script_includes",
  "data_policies",
] as const

export type ConfigType = (typeof TABLE_CONFIG_TYPES)[number]

/**
 * Maps config type names (plural) to their query details
 */
export const CONFIG_TYPE_QUERIES: Record<
  ConfigType,
  { table: string; tableFilter: string; fields: string }
> = {
  business_rules: {
    table: "sys_script",
    tableFilter: "collection",
    fields: "sys_id,name,when,order,active,action_insert,action_update,action_delete,action_query,sys_scope",
  },
  client_scripts: {
    table: "sys_script_client",
    tableFilter: "table",
    fields: "sys_id,name,type,field,active,sys_scope,ui_type",
  },
  ui_actions: {
    table: "sys_ui_action",
    tableFilter: "table",
    fields: "sys_id,name,active,order,condition,sys_scope",
  },
  ui_policies: {
    table: "sys_ui_policy",
    tableFilter: "table",
    fields: "sys_id,short_description,active,order,sys_scope",
  },
  acls: {
    table: "sys_security_acl",
    tableFilter: "name",
    fields: "sys_id,name,operation,active,type,sys_scope",
  },
  script_includes: {
    table: "sys_script_include",
    tableFilter: "script",
    fields: "sys_id,name,api_name,active,sys_scope,client_callable",
  },
  data_policies: {
    table: "sys_data_policy2",
    tableFilter: "model_table",
    fields: "sys_id,short_description,active,sys_scope",
  },
}

/**
 * Metadata tables used for aggregate config counting per scope
 */
export const SCOPE_COUNT_TABLES = [
  { key: "business_rules", table: "sys_script" },
  { key: "client_scripts", table: "sys_script_client" },
  { key: "ui_actions", table: "sys_ui_action" },
  { key: "ui_policies", table: "sys_ui_policy" },
  { key: "script_includes", table: "sys_script_include" },
  { key: "acls", table: "sys_security_acl" },
] as const

/**
 * GlideRecord built-in methods to exclude from field detection
 */
export const GLIDE_RECORD_BUILTINS = new Set([
  "initialize",
  "query",
  "next",
  "get",
  "insert",
  "update",
  "deleteRecord",
  "hasNext",
  "getRowCount",
  "getTableName",
  "addEncodedQuery",
  "setLimit",
  "setWorkflow",
  "autoSysFields",
  "isValid",
  "isValidRecord",
  "canRead",
  "canWrite",
  "canCreate",
  "canDelete",
  "operation",
  "isNewRecord",
  "isActionAborted",
  "setAbortAction",
  "addActiveQuery",
  "orderBy",
  "orderByDesc",
  "setCategory",
  "chooseWindow",
  "getEncodedQuery",
  "getUniqueValue",
  "getClassDisplayValue",
  "getDisplayValue",
  "getElement",
  "getElements",
  "getLabel",
  "getLink",
  "getRecordClassName",
  "getAttribute",
  "setNewGuidValue",
])
