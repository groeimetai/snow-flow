# Platform Development

Script includes, client scripts, and UI development

**Total Tools:** 78 | **Read:** 25 | **Write:** 53

---

## snow_add_form_field

Add field to form section

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_add_form_field
const result = await snow_add_form_field({
});
```

---

## snow_add_list_column

Add column to list view

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_add_list_column
const result = await snow_add_list_column({
});
```

---

## snow_analyze_artifact

Performs comprehensive analysis of artifacts including dependencies, usage patterns, and optimization opportunities. Caches results for improved performance.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_analyze_artifact
const result = await snow_analyze_artifact({
});
```

---

## snow_analyze_requirements

Analyzes development requirements to identify dependencies, suggest reusable components, and create implementation roadmaps.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_analyze_requirements
const result = await snow_analyze_requirements({
});
```

---

## snow_auth_diagnostics

Performs comprehensive authentication and permission diagnostics. Tests OAuth tokens, API access, table permissions, and provides specific remediation steps.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_auth_diagnostics
const result = await snow_auth_diagnostics({
});
```

---

## snow_cicd_deploy

Trigger CI/CD deployment pipeline

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_cicd_deploy
const result = await snow_cicd_deploy({
});
```

---

## snow_cleanup_test_artifacts

Safely cleanup test artifacts from ServiceNow (dry-run enabled by default for safety)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_cleanup_test_artifacts
const result = await snow_cleanup_test_artifacts({
});
```

---

## snow_clone_instance_artifact

Clones artifacts directly between ServiceNow instances (dev→test→prod). Handles authentication, dependency resolution, and data migration.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_clone_instance_artifact
const result = await snow_clone_instance_artifact({
});
```

---

## snow_convert_to_es5

Convert modern JavaScript (ES6+) to ES5 for ServiceNow Rhino engine

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_convert_to_es5
const result = await snow_convert_to_es5({
});
```

---

## snow_create_acl

Create Access Control List rule

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_acl
const result = await snow_create_acl({
});
```

---

## snow_create_acl_role

Create ACL role association

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_acl_role
const result = await snow_create_acl_role({
});
```

---

## snow_create_application

Application name (e.g., 

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_application
const result = await snow_create_application({
});
```

---

## snow_create_artifact

Artifact type to create

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_artifact
const result = await snow_create_artifact({
});
```

---

## snow_create_atf_test

Create Automated Test Framework (ATF) test for automated testing

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_atf_test
const result = await snow_create_atf_test({
});
```

---

## snow_create_atf_test_step

Adds a test step to an existing ATF test. Steps define the actions and assertions for testing using the sys_atf_step table.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_atf_test_step
const result = await snow_create_atf_test_step({
});
```

---

## snow_create_atf_test_suite

Creates an ATF test suite to group and run multiple tests together using sys_atf_test_suite table.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_atf_test_suite
const result = await snow_create_atf_test_suite({
});
```

---

## snow_create_business_rule

Create server-side business rule with full configuration options (ES5 only for scripts!)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_business_rule
const result = await snow_create_business_rule({
});
```

---

## snow_create_choice

Create choice list value for field

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_choice
const result = await snow_create_choice({
});
```

---

## snow_create_client_script

Create client-side script for form with type and field targeting

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_client_script
const result = await snow_create_client_script({
});
```

---

## snow_create_data_policy

Create data policy

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_data_policy
const result = await snow_create_data_policy({
});
```

---

## snow_create_data_policy_rule

Create data policy rule

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_data_policy_rule
const result = await snow_create_data_policy_rule({
});
```

---

## snow_create_field

Create table field/column

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_field
const result = await snow_create_field({
});
```

---

## snow_create_form_layout

Create custom form layout

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_form_layout
const result = await snow_create_form_layout({
});
```

---

## snow_create_form_section

Create form section

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_form_section
const result = await snow_create_form_section({
});
```

---

## snow_create_list_layout

Create a complete list layout with multiple columns for any ServiceNow table

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_list_layout
const result = await snow_create_list_layout({
});
```

---

## snow_create_list_view

Create custom list view

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_list_view
const result = await snow_create_list_view({
});
```

---

## snow_create_menu

Create application menu

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_menu
const result = await snow_create_menu({
});
```

---

## snow_create_menu_item

Create menu item

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_menu_item
const result = await snow_create_menu_item({
});
```

---

## snow_create_processor

Create script processor (ES5 only!)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_processor
const result = await snow_create_processor({
});
```

---

## snow_create_related_list

Create related list on form

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_related_list
const result = await snow_create_related_list({
});
```

---

## snow_create_saved_filter

Create a saved filter for any ServiceNow table that appears in the filter dropdown

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_saved_filter
const result = await snow_create_saved_filter({
});
```

---

## snow_create_script_include

Create reusable Script Include with client-callable support

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_script_include
const result = await snow_create_script_include({
});
```

---

## snow_create_solution_package

Creates comprehensive solution packages containing multiple related artifacts (widgets, scripts, rules). Manages dependencies and generates deployment documentation.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_solution_package
const result = await snow_create_solution_package({
});
```

---

## snow_create_table

Create new database table

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_table
const result = await snow_create_table({
});
```

---

## snow_create_template

Create record template

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_template
const result = await snow_create_template({
});
```

---

## snow_create_ui_action

Create UI Action (button, context menu, form link) with client/server scripts

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ui_action
const result = await snow_create_ui_action({
});
```

---

## snow_create_ui_page

Create custom UI Page with Jelly/HTML template and processing script

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ui_page
const result = await snow_create_ui_page({
});
```

---

## snow_create_ui_policy

Create UI Policy for form field control (visibility, mandatory, readonly)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ui_policy
const result = await snow_create_ui_policy({
});
```

---

## snow_create_ui_policy_action

Create UI policy action

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_create_ui_policy_action
const result = await snow_create_ui_policy_action({
});
```

---

## snow_deployment_debug

Provides detailed debugging information including authentication status, permissions, active sessions, and recent deployment logs for troubleshooting.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_deployment_debug
const result = await snow_deployment_debug({
});
```

---

## snow_deployment_status

Retrieves comprehensive deployment status including active deployments, recent history, success rates, and performance metrics.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_deployment_status
const result = await snow_deployment_status({
});
```

---

## snow_disable_business_rule

Disable business rule

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_disable_business_rule
const result = await snow_disable_business_rule({
});
```

---

## snow_discover_atf_tests

Discovers ATF tests in the instance with filtering and search capabilities.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_atf_tests
const result = await snow_discover_atf_tests({
});
```

---

## snow_discover_table_fields

Discover table schema with fields, types, relationships, and metadata

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_discover_table_fields
const result = await snow_discover_table_fields({
});
```

---

## snow_edit_artifact

Modifies ServiceNow artifacts using natural language instructions. Includes automatic error handling, retry logic, and validation of changes.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_edit_artifact
const result = await snow_edit_artifact({
});
```

---

## snow_edit_by_sysid

Updates specific fields of an artifact using sys_id. Provides direct field-level modifications with validation.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_edit_by_sysid
const result = await snow_edit_by_sysid({
});
```

---

## snow_ensure_active_update_set

Ensure Update Set is active and optionally set as current for user

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_ensure_active_update_set
const result = await snow_ensure_active_update_set({
});
```

---

## snow_error_handler

Create error handler

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_error_handler
const result = await snow_error_handler({
});
```

---

## snow_exception_handler

Handle exceptions with logging

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_exception_handler
const result = await snow_exception_handler({
});
```

---

## snow_execute_atf_test

Executes an ATF test or test suite and returns the results. Tests run asynchronously in ServiceNow using sys_atf_test_result table.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_execute_atf_test
const result = await snow_execute_atf_test({
});
```

---

## snow_export_artifact

Exports ServiceNow artifacts (widgets, applications) to JSON/XML format for backup, version control, or migration purposes.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_export_artifact
const result = await snow_export_artifact({
});
```

---

## snow_find_artifact

Finds ServiceNow artifacts using natural language queries. Searches cached memory first for performance, then queries ServiceNow directly if needed.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_find_artifact
const result = await snow_find_artifact({
});
```

---

## snow_get_atf_results

Retrieves ATF test execution results including pass/fail status, error details, and execution time from sys_atf_test_result table.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_get_atf_results
const result = await snow_get_atf_results({
});
```

---

## snow_get_current_scope

Include information about the current Update Set (default: true)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin, stakeholder |

### Example

```javascript
// Using snow_get_current_scope
const result = await snow_get_current_scope({
});
```

---

## snow_import_artifact

Imports previously exported artifacts from JSON/XML files into ServiceNow. Validates compatibility and handles dependencies automatically.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_import_artifact
const result = await snow_import_artifact({
});
```

---

## snow_install_application

Install application from store

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_install_application
const result = await snow_install_application({
});
```

---

## snow_list_applications

Search term to filter applications by name or scope (partial match)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin, stakeholder |

### Example

```javascript
// Using snow_list_applications
const result = await snow_list_applications({
});
```

---

## snow_list_supported_artifacts

List all ServiceNow artifact types supported by local sync

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_list_supported_artifacts
const result = await snow_list_supported_artifacts({
});
```

---

## snow_memory_search

Searches cached ServiceNow artifacts in local memory for instant results without API calls.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_memory_search
const result = await snow_memory_search({
});
```

---

## snow_orchestrate_development

Orchestrates complex development workflows with intelligent agent coordination, shared memory, and real-time progress tracking.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_orchestrate_development
const result = await snow_orchestrate_development({
});
```

---

## snow_preview_widget

Renders widget preview with test data for validation before deployment. Simulates Service Portal environment, checks dependencies, and validates data binding.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_preview_widget
const result = await snow_preview_widget({
});
```

---

## snow_pull_artifact

Pull ServiceNow artifact to local files for editing with native tools

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_pull_artifact
const result = await snow_pull_artifact({
});
```

---

## snow_push_artifact

Push locally edited artifact files back to ServiceNow with validation

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_push_artifact
const result = await snow_push_artifact({
});
```

---

## snow_rollback_deployment

Rollback failed deployment by reverting to previous version or deleting artifact

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | advanced |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_rollback_deployment
const result = await snow_rollback_deployment({
});
```

---

## snow_switch_application_scope

Target scope to switch to. Can be 

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_switch_application_scope
const result = await snow_switch_application_scope({
});
```

---

## snow_sync_cleanup

Clean up local artifact files after sync with retention policies

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | low |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_sync_cleanup
const result = await snow_sync_cleanup({
});
```

---

## snow_sync_data_consistency

Synchronizes cached data with ServiceNow, validates sys_id mappings, and repairs consistency issues. Includes automatic cache refresh and reindexing.

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_sync_data_consistency
const result = await snow_sync_data_consistency({
});
```

---

## snow_sync_status

Get status of locally synced artifacts including changes and validation

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_sync_status
const result = await snow_sync_status({
});
```

---

## snow_test_acl

Test ACL access for user

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_test_acl
const result = await snow_test_acl({
});
```

---

## snow_update

Update existing ServiceNow artifacts (widgets, pages, scripts, flows, etc.)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_update
const result = await snow_update({
});
```

---

## snow_update_set_manage

Management action to perform

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | intermediate |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_update_set_manage
const result = await snow_update_set_manage({
});
```

---

## snow_update_set_query

Query Update Sets (get current or list multiple)

| Property | Value |
|----------|-------|
| Permission | `write` |
| Complexity | beginner |
| Frequency | high |
| Allowed Roles | developer, admin |

### Example

```javascript
// Using snow_update_set_query
const result = await snow_update_set_query({
});
```

---

## snow_validate_deployment

Validate artifact before deployment (ES5, coherence, dependencies, security)

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | advanced |
| Frequency | high |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_validate_deployment
const result = await snow_validate_deployment({
});
```

---

## snow_validate_field

Validate field value

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_validate_field
const result = await snow_validate_field({
});
```

---

## snow_validate_live_connection

Validates ServiceNow connection status, authentication tokens, and user permissions. Returns detailed diagnostics with response times.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_validate_live_connection
const result = await snow_validate_live_connection({
});
```

---

## snow_validate_record

Validate record against business rules

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_validate_record
const result = await snow_validate_record({
});
```

---

## snow_validate_sysid

Validates sys_id existence and consistency across tables. Maintains artifact tracking for deployment integrity and rollback capabilities.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | beginner |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_validate_sysid
const result = await snow_validate_sysid({
});
```

---

## snow_widget_test

Executes comprehensive widget testing with multiple data scenarios. Validates client/server scripts, API calls, dependencies, and generates coverage reports.

| Property | Value |
|----------|-------|
| Permission | `read` |
| Complexity | intermediate |
| Frequency | medium |
| Allowed Roles | developer, stakeholder, admin |

### Example

```javascript
// Using snow_widget_test
const result = await snow_widget_test({
});
```

---

