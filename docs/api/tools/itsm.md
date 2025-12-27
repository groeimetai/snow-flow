# Itsm

Tools for itsm

**Total Tools:** 45 | **Read:** 17 | **Write:** 28

---

## snow_analyze_incident

Analyzes specific incidents with pattern recognition, similar incident matching, and automated resolution suggestions

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_analyze_incident
const result = await snow_analyze_incident({
});
```

---

## snow_approve_procurement

Approve procurement request

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_approve_procurement
const result = await snow_approve_procurement({
});
```

---

## snow_approve_reject

Approve or reject approval request

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_approve_reject
const result = await snow_approve_reject({
});
```

---

## snow_auto_resolve_incident

Attempts automated resolution of technical incidents based on known patterns and previous solutions. Includes dry-run mode for safety.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_auto_resolve_incident
const result = await snow_auto_resolve_incident({
});
```

---

## snow_calculate_sla_duration

Calculate SLA duration with schedule

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_calculate_sla_duration
const result = await snow_calculate_sla_duration({
});
```

---

## snow_catalog_item_manager

Create, update, or manage service catalog items

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_catalog_item_manager
const result = await snow_catalog_item_manager({
});
```

---

## snow_catalog_item_search

Search service catalog items with filtering options

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_catalog_item_search
const result = await snow_catalog_item_search({
});
```

---

## snow_change_manage

Unified change management (create, update_state, approve, create_task, schedule_cab)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_change_manage
const result = await snow_change_manage({
});
```

---

## snow_change_query

Unified change query (get, search, assess_risk)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_change_query
const result = await snow_change_query({
});
```

---

## snow_create_catalog_client_script

Creates client scripts for catalog items to add custom JavaScript behavior to forms.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_catalog_client_script
const result = await snow_create_catalog_client_script({
});
```

---

## snow_create_catalog_item

Create service catalog item

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_catalog_item
const result = await snow_create_catalog_item({
});
```

---

## snow_create_catalog_ui_policy

Creates comprehensive UI policies for catalog items with conditions and actions to control form behavior dynamically.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_catalog_ui_policy
const result = await snow_create_catalog_ui_policy({
});
```

---

## snow_create_catalog_variable

Create catalog item variable

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_catalog_variable
const result = await snow_create_catalog_variable({
});
```

---

## snow_create_customer_account

Create customer account for tracking relationships and entitlements

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_customer_account
const result = await snow_create_customer_account({
});
```

---

## snow_create_customer_case

Create CSM customer case

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_customer_case
const result = await snow_create_customer_case({
});
```

---

## snow_create_entitlement

Create service entitlement for customer

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_entitlement
const result = await snow_create_entitlement({
});
```

---

## snow_create_hr_case

Create HR service case

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_hr_case
const result = await snow_create_hr_case({
});
```

---

## snow_create_hr_task

Create HR task for case fulfillment

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_hr_task
const result = await snow_create_hr_task({
});
```

---

## snow_create_incident

Create ServiceNow incident with smart defaults and assignment

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_incident
const result = await snow_create_incident({
});
```

---

## snow_create_knowledge_base

Creates a new knowledge base for organizing articles by topic, department, or audience.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_knowledge_base
const result = await snow_create_knowledge_base({
});
```

---

## snow_create_project

Create project

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_project
const result = await snow_create_project({
});
```

---

## snow_create_project_task

Create project task

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_project_task
const result = await snow_create_project_task({
});
```

---

## snow_create_purchase_order

Create purchase order

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_purchase_order
const result = await snow_create_purchase_order({
});
```

---

## snow_create_queue

Create assignment queue

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_queue
const result = await snow_create_queue({
});
```

---

## snow_create_sla

Create Service Level Agreement

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_sla
const result = await snow_create_sla({
});
```

---

## snow_create_variable

Create catalog variable

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_variable
const result = await snow_create_variable({
});
```

---

## snow_create_variable_set

Create reusable variable set

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_variable_set
const result = await snow_create_variable_set({
});
```

---

## snow_discover_catalogs

Discovers available service catalogs and their categories in the ServiceNow instance.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_catalogs
const result = await snow_discover_catalogs({
});
```

---

## snow_discover_knowledge_bases

Discovers available knowledge bases and their categories in the ServiceNow instance.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_knowledge_bases
const result = await snow_discover_knowledge_bases({
});
```

---

## snow_employee_offboarding

Initiate employee offboarding workflow

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_employee_offboarding
const result = await snow_employee_offboarding({
});
```

---

## snow_employee_onboarding

Trigger employee onboarding workflow

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_employee_onboarding
const result = await snow_employee_onboarding({
});
```

---

## snow_get_catalog_item_details

Gets detailed information about a catalog item including variables, pricing, and availability.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_catalog_item_details
const result = await snow_get_catalog_item_details({
});
```

---

## snow_get_customer_history

Retrieve complete customer interaction history

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_customer_history
const result = await snow_get_customer_history({
});
```

---

## snow_get_pending_approvals

Get pending approvals for user

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_pending_approvals
const result = await snow_get_pending_approvals({
});
```

---

## snow_get_queue_items

Get items in queue

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_queue_items
const result = await snow_get_queue_items({
});
```

---

## snow_get_sla_status

Get SLA status for record

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_sla_status
const result = await snow_get_sla_status({
});
```

---

## snow_knowledge_article_manage

Unified knowledge article management (create, update, get, publish, retire, search)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_knowledge_article_manage
const result = await snow_knowledge_article_manage({
});
```

---

## snow_order_catalog_item

Orders a catalog item programmatically, creating a request (RITM) with specified variable values.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_order_catalog_item
const result = await snow_order_catalog_item({
});
```

---

## snow_order_catalog_item

Order service catalog item

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_order_catalog_item
const result = await snow_order_catalog_item({
});
```

---

## snow_query_incidents

Query incidents with advanced filtering and analysis capabilities. Optimized for performance with optional content inclusion.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_query_incidents
const result = await snow_query_incidents({
});
```

---

## snow_query_problems

Queries problem records with root cause analysis and optional inclusion of related incidents

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_query_problems
const result = await snow_query_problems({
});
```

---

## snow_query_requests

Queries service requests with optional inclusion of request items and fulfillment details

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_query_requests
const result = await snow_query_requests({
});
```

---

## snow_request_approval

Request approval for record

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_request_approval
const result = await snow_request_approval({
});
```

---

## snow_search_catalog

Searches service catalog for items, categories, or catalogs. Returns available items for ordering.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_search_catalog
const result = await snow_search_catalog({
});
```

---

## snow_update_incident

Update incident with state validation and automatic work notes

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_update_incident
const result = await snow_update_incident({
});
```

---

