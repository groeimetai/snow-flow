---
name: dependency-map
description: This skill should be used when the user asks about "impact analysis", "configuration dependencies", "what touches this field", "field references", "which business rules affect", "what calls this script include", "reverse dependencies", "table configurations", "change impact", or any ServiceNow configuration dependency analysis.
license: Apache-2.0
compatibility: Designed for Snow-Code and ServiceNow development
metadata:
  author: groeimetai
  version: "1.0.0"
  category: servicenow
tools:
  - snow_dependency_map_apps
  - snow_dependency_map_table_configs
  - snow_dependency_map_artifact_dependencies
  - snow_dependency_map_field_references
  - snow_dependency_map_reverse_dependencies
---

# Dependency Map for ServiceNow

Dependency Map provides configuration dependency analysis across a ServiceNow instance. Before making changes to fields, tables, or artifacts, use these tools to understand the full blast radius.

## Tool Overview

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `snow_dependency_map_apps` | List apps with config counts | Starting point — understand the instance landscape |
| `snow_dependency_map_table_configs` | All configs on a table | "What runs on the incident table?" |
| `snow_dependency_map_field_references` | Reverse field lookup | "What touches incident.assignment_group?" |
| `snow_dependency_map_artifact_dependencies` | Forward dependency analysis | "What does this business rule read/write?" |
| `snow_dependency_map_reverse_dependencies` | Reverse artifact lookup | "What calls the IncidentUtils script include?" |

## Recommended Workflow

### 1. Instance Overview
Start with `snow_dependency_map_apps` to see which applications have the most configurations:

```
→ snow_dependency_map_apps(include_config_counts: true)
```

### 2. Table Deep-Dive
Pick a table and see everything running on it:

```
→ snow_dependency_map_table_configs(table_name: "incident")
```

This returns all business rules, client scripts, UI actions, UI policies, ACLs, script includes, and data policies on that table.

### 3. Field Impact Check
Before changing a field, find every artifact that touches it:

```
→ snow_dependency_map_field_references(table_name: "incident", field_name: "assignment_group")
```

This is the most powerful tool — it searches across all artifact types and classifies each reference as read, write, or condition.

### 4. Artifact Analysis
Analyze what a specific artifact depends on:

```
→ snow_dependency_map_artifact_dependencies(artifact_type: "business_rule", artifact_sys_id: "abc123")
```

Returns fields read/written, tables queried, script includes called, and a complexity rating.

### 5. Reverse Dependencies
Find what depends on a specific artifact (e.g., a script include):

```
→ snow_dependency_map_reverse_dependencies(artifact_type: "script_include", artifact_identifier: "IncidentUtils")
```

## Common Questions and Which Tool to Use

| Question | Tool |
|----------|------|
| "What apps are in this instance?" | `snow_dependency_map_apps` |
| "What business rules run on incident?" | `snow_dependency_map_table_configs` |
| "What touches the state field on change_request?" | `snow_dependency_map_field_references` |
| "What does this business rule do?" | `snow_dependency_map_artifact_dependencies` |
| "What uses the TaskUtils script include?" | `snow_dependency_map_reverse_dependencies` |
| "Is it safe to remove this field?" | `snow_dependency_map_field_references` |
| "How complex is this business rule?" | `snow_dependency_map_artifact_dependencies` |
| "What's the blast radius of changing this script include?" | `snow_dependency_map_reverse_dependencies` |

## Configuration Types Tracked

- **Business Rules** (`sys_script`) — server-side scripts triggered on table operations
- **Client Scripts** (`sys_script_client`) — browser-side scripts for form interactions
- **UI Actions** (`sys_ui_action`) — buttons, links, and context menu items
- **UI Policies** (`sys_ui_policy`) — field visibility, mandatory, and read-only rules
- **ACLs** (`sys_security_acl`) — access control rules per table/field/operation
- **Script Includes** (`sys_script_include`) — reusable server-side libraries
- **Data Policies** (`sys_data_policy2`) — data validation rules

## Script Analysis Patterns

The script analyzer detects these patterns in ServiceNow scripts:

**Field reads**: `current.field`, `gr.getValue('field')`, `g_form.getValue('field')`, `.addQuery('field')`, `.orderBy('field')`

**Field writes**: `current.field = value`, `gr.setValue('field', value)`, `g_form.setValue('field', value)`

**Table queries**: `new GlideRecord('table')`, `new GlideAggregate('table')`

**Script include calls**: `new ClassName()` (excludes Glide built-in classes)
