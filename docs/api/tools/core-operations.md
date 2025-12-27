# Core Operations

Tools for core-operations

**Total Tools:** 30 | **Read:** 14 | **Write:** 16

---

## snow_add_comment

Add comment/work note to record

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_add_comment
const result = await snow_add_comment({
});
```

---

## snow_apply_template

Apply template to create record

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_apply_template
const result = await snow_apply_template({
});
```

---

## snow_assign_task

Assign task to user or group with workload balancing and skill matching

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_assign_task
const result = await snow_assign_task({
});
```

---

## snow_attach_file

Attach files to ServiceNow records with validation and content type detection

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_attach_file
const result = await snow_attach_file({
});
```

---

## snow_bulk_update

Bulk update multiple records

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_bulk_update
const result = await snow_bulk_update({
});
```

---

## snow_create_user_group

Creates a new user group in ServiceNow with specified properties

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_user_group
const result = await snow_create_user_group({
});
```

---

## snow_delete_attachment

Delete attachment

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_delete_attachment
const result = await snow_delete_attachment({
});
```

---

## snow_discover_mobile_configs

Discovers mobile application configurations including layouts, actions, and offline sync settings.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_mobile_configs
const result = await snow_discover_mobile_configs({
});
```

---

## snow_discover_platform_tables

Discover platform development tables by category (ui, script, policy, action, security, system). Optimized for fast parallel queries with timeout handling.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_platform_tables
const result = await snow_discover_platform_tables({
});
```

---

## snow_file_download

Download file from ServiceNow

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_file_download
const result = await snow_file_download({
});
```

---

## snow_file_upload

Upload file to ServiceNow

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_file_upload
const result = await snow_file_upload({
});
```

---

## snow_get_attachments

Get attachments for record

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_attachments
const result = await snow_get_attachments({
});
```

---

## snow_get_by_sysid

Retrieves artifacts by sys_id for precise, fast lookups. Auto-detects large responses and suggests efficient field-specific queries using snow_query_table when needed. More reliable than text-based searches when sys_id is known.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_by_sysid
const result = await snow_get_by_sysid({
});
```

---

## snow_get_by_sysid

Get any ServiceNow record by sys_id with optional field selection

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_by_sysid
const result = await snow_get_by_sysid({
});
```

---

## snow_get_instance_info

Get ServiceNow instance information

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_instance_info
const result = await snow_get_instance_info({
});
```

---

## snow_get_journal_entries

Get journal entries for record

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_journal_entries
const result = await snow_get_journal_entries({
});
```

---

## snow_get_user_roles

Get all roles assigned to user

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_user_roles
const result = await snow_get_user_roles({
});
```

---

## snow_manage_group_membership

Manage group memberships: add/remove users, list members

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_manage_group_membership
const result = await snow_manage_group_membership({
});
```

---

## snow_property_bulk

Bulk system property operations (get/set multiple)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_property_bulk
const result = await snow_property_bulk({
});
```

---

## snow_property_io

System property I/O operations (import, export, history)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_property_io
const result = await snow_property_io({
});
```

---

## snow_property_manage

Unified tool for system property management (get, set, delete, validate)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_property_manage
const result = await snow_property_manage({
});
```

---

## snow_property_query

Query system properties (list, search, categories)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_property_query
const result = await snow_property_query({
});
```

---

## snow_query_table

Query any ServiceNow table with filtering, pagination, and field selection. Always returns sys_id for each record.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_query_table
const result = await snow_query_table({
});
```

---

## snow_record_manage

Unified record management (create, update, delete) with validation

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_record_manage
const result = await snow_record_manage({
});
```

---

## snow_role_group_manage

Unified role and group management (create_role, assign_role, create_group)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_role_group_manage
const result = await snow_role_group_manage({
});
```

---

## snow_search_artifacts

Search ServiceNow development artifacts (widgets, pages, scripts, flows, UI actions, client scripts). For data/table searches, use snow_query_table or snow_fuzzy_search instead.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_search_artifacts
const result = await snow_search_artifacts({
});
```

---

## snow_table_schema_discovery

Discover comprehensive table schema including fields, relationships, ACLs, and business rules

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_table_schema_discovery
const result = await snow_table_schema_discovery({
});
```

---

## snow_upload_attachment

Upload attachment to record

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_upload_attachment
const result = await snow_upload_attachment({
});
```

---

## snow_user_lookup

Retrieves user information including roles, groups, and permissions. Supports lookup by ID, email, or name.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_user_lookup
const result = await snow_user_lookup({
});
```

---

## snow_user_manage

Unified user management (create, deactivate)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_user_manage
const result = await snow_user_manage({
});
```

---

