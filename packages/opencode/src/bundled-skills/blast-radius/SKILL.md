---
name: blast-radius
description: This skill should be used when the user asks about "impact analysis", "blast radius", "configuration dependencies", "what touches this field", "field references", "which business rules affect", "what calls this script include", "reverse dependencies", "table configurations", "change impact", or any ServiceNow configuration dependency analysis.
license: Apache-2.0
compatibility: Designed for Snow-Code and ServiceNow development
metadata:
  author: groeimetai
  version: "2.0.0"
  category: servicenow
tools:
  - snow_blast_radius_apps
  - snow_blast_radius_table_configs
  - snow_blast_radius_artifact_dependencies
  - snow_blast_radius_field_references
  - snow_blast_radius_reverse_dependencies
---

# Blast Radius for ServiceNow

Blast Radius provides configuration dependency analysis across a ServiceNow instance. Before making changes to fields, tables, or artifacts, use these tools to understand the full blast radius.

## Tool Overview

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `snow_blast_radius_apps` | List apps with config counts | Starting point — understand the instance landscape |
| `snow_blast_radius_table_configs` | All configs on a table | "What runs on the incident table?" |
| `snow_blast_radius_field_references` | Reverse field lookup | "What touches incident.assignment_group?" |
| `snow_blast_radius_artifact_dependencies` | Forward dependency analysis | "What does this business rule read/write?" |
| `snow_blast_radius_reverse_dependencies` | Reverse artifact lookup | "What calls the IncidentUtils script include?" |

## Coverage

`snow_blast_radius_field_references` and `snow_blast_radius_table_configs` scan the following artifact types in parallel. Types backed by plugins that are not activated on the instance fail silently — the tool reports them under `errors_by_type` and continues.

**Table-scoped (queried with the table name as filter):**
- Business rules (`sys_script`) — script + condition + filter_condition + role_conditions
- Client scripts (`sys_script_client`)
- UI actions (`sys_ui_action`) — script + condition
- UI policies (`sys_ui_policy`) — script_true + script_false + conditions
- UI policy actions (`sys_ui_policy_action`) — exact field match
- Data policies (`sys_data_policy2`)
- Data policy rules (`sys_data_policy_rule`) — exact table_field match
- ACLs (`sys_security_acl`) — field-level name match always included, table-level only when script/condition references the field
- Email notifications (`sysevent_email_action`) — subject + message_html + message_text + condition + advanced_condition
- Metric definitions (`metric_definition`) — script + exact field match
- Inbound email actions (`sysevent_in_email_action`) — script + condition
- Transform entries (`sys_transform_entry`) — target_field / source_field
- Dictionary `dependent` / `dependent_on_field` — UI-level field dependencies

**Global (no table column — grep all records, filter client-side by script content mentioning the table name):**
- Script includes (`sys_script_include`)
- Scheduled jobs (`sysauto_script`)
- Fix scripts (`sys_script_fix`)
- Script actions (`sysevent_script_action`)
- Transform scripts (`sys_transform_script`)
- Processors (`sys_processor`)
- UI scripts (`sys_ui_script`)
- Scripted REST resources (`sys_ws_operation`) — operation_script
- Email scripts (`sys_script_email`)
- Service Portal widgets (`sp_widget`) — server script + client script + link
- Catalog client scripts (`catalog_script_client`)
- Catalog UI policies (`catalog_ui_policy`)
- ATF step inputs (`sys_atf_step`)

**Table hierarchy:** By default the tools walk `sys_db_object.super_class` up to three levels, so a query on `incident` also returns artifacts scoped to `task`. Disable via `include_parent_tables: false`.

## Known Limitations

These gaps are inherent to static regex-based analysis over the REST Table API:

- **Reference dotwalks**: `current.assignment_group.manager` is parsed as a reference to `assignment_group`, not to `sys_user_group.manager`. Dotwalked field changes are not flagged transitively.
- **Dynamic field access**: `gr.setValue(someVar, value)` cannot be resolved because `someVar` is computed at runtime.
- **Dynamic table access**: `new GlideRecord(tableVar)` — global artifacts won't be matched unless the table name appears literally in the script.
- **Legacy workflows** (`wf_workflow`, `wf_activity`) are not scanned — migrating to Flow Designer is recommended anyway.
- **Reports/dashboards** filter conditions are not scanned.
- **Service Portal option schemas / angular providers** beyond `sp_widget` are not scanned.
- **Field-level ACLs without scripts** that also don't match the `name=<table>.<field>` exact pattern (e.g., using a regex-like ACL naming) may be missed.
- **`include_parent_tables`** adds at most three `sys_db_object` lookups; deeper hierarchies (incident_task → task → incident) are capped at depth 3.

If the tool reports "0 references", treat it as "no *static* references found in the artifact types we scan" — not as a proof of safety. For high-risk changes (renaming a widely-used field), combine with grep of the export XML, and consider running a sandboxed test after the change.

## Recommended Workflow

### 1. Instance Overview
Start with `snow_blast_radius_apps` to see which applications have the most configurations:

```
→ snow_blast_radius_apps(include_config_counts: true)
```

### 2. Table Deep-Dive
Pick a table and see everything running on it:

```
→ snow_blast_radius_table_configs(table_name: "incident")
```

### 3. Field Impact Check
Before changing a field, find every artifact that touches it:

```
→ snow_blast_radius_field_references(table_name: "incident", field_name: "assignment_group")
```

### 4. Artifact Analysis
Analyze what a specific artifact depends on:

```
→ snow_blast_radius_artifact_dependencies(artifact_type: "business_rule", artifact_sys_id: "abc123")
```

Returns fields read/written, tables queried, script includes called, and a complexity rating.

### 5. Reverse Dependencies
Find what depends on a specific artifact (e.g., a script include):

```
→ snow_blast_radius_reverse_dependencies(artifact_type: "script_include", artifact_identifier: "IncidentUtils")
```

## Common Questions and Which Tool to Use

| Question | Tool |
|----------|------|
| "What apps are in this instance?" | `snow_blast_radius_apps` |
| "What business rules run on incident?" | `snow_blast_radius_table_configs` |
| "What touches the state field on change_request?" | `snow_blast_radius_field_references` |
| "What does this business rule do?" | `snow_blast_radius_artifact_dependencies` |
| "What uses the TaskUtils script include?" | `snow_blast_radius_reverse_dependencies` |
| "Is it safe to remove this field?" | `snow_blast_radius_field_references` |
| "How complex is this business rule?" | `snow_blast_radius_artifact_dependencies` |
| "What's the blast radius of changing this script include?" | `snow_blast_radius_reverse_dependencies` |

## Script Analysis Patterns

The script analyzer detects these patterns in ServiceNow scripts:

**Field reads**: `current.field`, `gr.getValue('field')`, `g_form.getValue('field')`, `.addQuery('field')`, `.orderBy('field')`

**Field writes**: `current.field = value`, `gr.setValue('field', value)`, `g_form.setValue('field', value)`

**Table queries**: `new GlideRecord('table')`, `new GlideAggregate('table')`

**Script include calls**: `new ClassName()` (excludes Glide built-in classes)
