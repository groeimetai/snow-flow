# Snow-Flow Configuration & Best Practices

## 🚨 CRITICAL: PREVENT INFINITE TASK LOOPS

**NEVER spawn multiple agents for the same task type!**

**❌ INFINITE LOOP (PROHIBITED):**
```
Task("UI Builder Tools Tester", "Test UI Builder tools");
Task("UI Builder Tools Tester", "Test UI Builder tools");  // ← DUPLICATE AGENT TYPE!
Task("Workspace Tools Tester", "Test workspace tools");
Task("Workspace Tools Tester", "Test workspace tools");  // ← CAUSES INFINITE LOOP!

// This pattern causes MCP server spam:
// • Task(UI Builder Tools Tester) → snow_validate_uib_page_structure (repeated 100x)
// • Task(Workspace Tools Tester) → snow_execute_script_with_output (repeated 100x)
```

**✅ CORRECT (Single Agent):**
```
// UNIQUE agent names prevent loops:
Task("workspace-architect", "Create ONE UX workspace for IT support using snow_create_complete_workspace. Store all sys_ids in Memory.");
Task("ui-specialist", "Design UI components AFTER workspace-architect completes. Use Memory to get workspace sys_ids.");
Task("testing-validator", "Test workspace functionality AFTER ui-specialist completes. No duplicate testing!");

// NEVER use generic names like:
// Task("Tester", ...) - TOO GENERIC, CAUSES LOOPS!
// Task("UI Builder Tools Tester", ...) - EXACTLY what caused the infinite loop!
```

**🎯 Anti-Loop Rules:**
1. **ONE agent per task type maximum**
2. **Specific agent instructions** (not generic descriptions)
3. **Wait for completion** before spawning additional agents  
4. **Check Memory for existing work** before spawning
5. **NO duplicate Task() calls** with same objective

---

This document provides comprehensive instructions for Snow-Flow, an advanced ServiceNow development and orchestration framework powered by Claude AI.

## Table of Contents
1. [Core Philosophy](#core-philosophy)
2. [Fundamental Rules](#fundamental-rules)
3. [ServiceNow Development Standards](#servicenow-development-standards)
4. [MCP Server Capabilities](#mcp-server-capabilities)
5. [Debugging Best Practices](#debugging-best-practices)
6. [Command Reference](#command-reference)
7. [Workflow Guidelines](#workflow-guidelines)

## CRITICAL: Widget Debugging Must Use Local Sync

### \ud83d\udd34 When User Reports Widget Issues, ALWAYS Use `snow_pull_artifact` FIRST!

**Common scenarios that REQUIRE Local Sync:**
- "Widget skips questions" \u2192 `snow_pull_artifact`
- "Form doesn't submit properly" \u2192 `snow_pull_artifact`
- "Data not displaying" \u2192 `snow_pull_artifact`
- "Button doesn't work" \u2192 `snow_pull_artifact`
- "Debug this widget" \u2192 `snow_pull_artifact`
- "Fix widget issue" \u2192 `snow_pull_artifact`

**DO NOT use `snow_query_table` for widget debugging!** It will hit token limits and you can't use native search/edit tools.

## Core Philosophy

### The Prime Directive: Use Dedicated Tools First, Then Verify

Snow-Flow operates on "**Tools-First, Evidence-Based**" development. Always use the highest-level, most specific tool available before falling back to generic approaches.

**Cardinal Rules:**
1. **🔍 Tool Discovery First** - Always search for dedicated MCP tools before using scripts
2. **🎯 Use Highest-Level Tool** - Prefer domain-specific tools over generic database operations  
3. **📊 Problem Categorization** - High-level business operations → dedicated tools, low-level data → scripts
4. **✅ Verify, Don't Assume** - Test before declaring something broken
5. **🔧 Fix Only Confirmed Issues** - Respect existing configurations

### The Tools-First Approach

**✅ CORRECT Decision Process:**
```javascript
// Step 1: User Request Analysis
User: "Create agent workspace for IT support"

// Step 2: Tool Discovery FIRST  
Search Snow-Flow MCP tools for:
- "create_workspace" → FOUND: snow_create_workspace
- "workspace_create" → FOUND: snow_create_workspace  
- "agent_workspace" → FOUND: snow_create_workspace

// Step 3: Use Dedicated Tool
const result = await snow_create_workspace({
  name: "IT Support Workspace",
  tables: ["incident", "task", "sys_user"],
  description: "Agent workspace for IT support team"
});

// Step 4: Only if dedicated tool fails → verify with scripts
if (!result.success && result.plugin_required) {
  // Now use verification script to check plugin availability
}
```

**❌ WRONG Approach (Anti-Pattern):**
```javascript
// DON'T DO THIS: Jumping straight to scripts for business operations
User: "Create agent workspace"
→ snow_execute_script_with_output({ script: "var gr = new GlideRecord('sys_aw_master_config')..." })

// This bypasses all our error handling, plugin detection, and business logic!
```

### Problem Categorization Guide

**🎯 High-Level Business Operations → Dedicated Tools:**
- "Create workspace" → `snow_create_workspace`
- "Create UI Builder page" → `snow_create_uib_page`  
- "Deploy widget" → `snow_deploy`
- "Create flow" → Flow Designer tools
- "Add component to page" → `snow_add_uib_page_element`

**🔧 Low-Level Data Operations → Scripts OK:**
- "Check if field exists in table"
- "Verify property value"  
- "Test custom query"
- "Debug specific record"

**🚨 Decision Tree:**
1. **User says "Create X"** → Search for `snow_create_X` or `snow_X_create` tools FIRST
2. **User says "Configure Y"** → Search for `snow_configure_Y` tools FIRST  
3. **User says "Custom script for Z"** → Scripts are appropriate
4. **User says "Check/verify/test"** → Scripts for verification are good

**🎯 Workspace Feature Development:**
- **"Create workspace list"** → Use `snow_create_uib_component` (list component) + `snow_create_uib_data_broker`
- **"Add workspace tab"** → Use `snow_create_uib_page` + `snow_add_uib_page_element`
- **"Configure workspace panel"** → Use `snow_create_uib_component` + `snow_add_uib_page_element`

### The Verification-First Approach

```javascript
// Before claiming anything doesn't work or exist:
// Step 1: Test the actual implementation
const verify = await snow_execute_script_with_output({
  script: `/* Test the exact code or resource */`
});

// Step 2: Check if resources exist
const tableCheck = await snow_discover_table_fields({
  table_name: 'potentially_custom_table'
});

// Step 3: Validate configurations
const propertyCheck = await snow_property_manager({
  action: 'get',
  name: 'system.property'
});

// Step 4: Only then make informed decisions
```

### 🔄 CRITICAL: Sync User Modifications Before Working

**When a user mentions they've modified an artifact directly in ServiceNow, ALWAYS fetch the latest version first!**

If a user says any of these:
- "I've updated the widget in ServiceNow"
- "I made some changes to the flow"
- "I modified the script"
- "I adjusted the configuration"
- "Ik heb het zelf aangepast" (Dutch: I adjusted it myself)

**YOU MUST:**

1. **Immediately fetch the current version from ServiceNow:**
```javascript
// For any artifact the user has modified
const currentVersion = await snow_query_table({
  table: 'artifact_table_name',
  query: `sys_id=${artifact_sys_id}`,
  fields: ['*'],  // Get all fields
  limit: 1
});

// Or for widgets specifically
const widgetData = await snow_query_table({
  table: 'sp_widget',
  query: `sys_id=${widget_sys_id}`,
  fields: ['name', 'template', 'client_script', 'script', 'css', 'option_schema'],
  limit: 1
});

// Or use snow_get_by_sysid for comprehensive retrieval
const artifact = await snow_get_by_sysid({
  table: 'table_name',
  sys_id: 'the_sys_id'
});
```

2. **Analyze the user's modifications:**
   - Review what they changed
   - Understand their intent
   - Preserve their modifications

3. **Build upon their changes:**
   - Don't overwrite their work
   - Integrate new features with their modifications
   - Maintain their code style and patterns

4. **Inform the user:**
   - Acknowledge that you've fetched their latest changes
   - Summarize what modifications you found
   - Explain how you'll build upon their work

**Example Workflow:**
```javascript
// User: "I've updated the widget to add a loading spinner"
// Snow-Flow response:

// 1. Fetch current version
const widget = await snow_query_table({
  table: 'sp_widget',
  query: `sys_id=${widgetSysId}`,
  fields: ['*'],
  limit: 1
});

// 2. Analyze changes
console.log("✅ Fetched your latest widget version from ServiceNow");
console.log("📝 I see you've added a loading spinner in the template");

// 3. Work with the updated version
// ... make additional changes based on user's modifications ...
```

**Why This Matters:**
- User modifications are not tracked locally
- Working with outdated versions causes conflicts
- User's work could be lost if not synced
- Builds trust by respecting user's contributions
- Ensures coherent development flow

## Fundamental Rules

### Rule 1: ES5 JavaScript Only in ServiceNow

ServiceNow uses the Rhino JavaScript engine which supports only ES5. Modern JavaScript syntax will fail.

**Never Use:**
- `const` or `let` - use `var`
- Arrow functions `() => {}` - use `function() {}`
- Template literals `` `${var}` `` - use string concatenation
- Destructuring `{a, b} = obj` - use explicit property access
- `for...of` loops - use traditional `for` loops
- Default parameters - use `typeof` checks
- `async/await` - use callbacks or GlideAjax
- `enum` - use object literals with constants instead
- Classes - use function constructors with prototypes
- Spread operator `...` - use Array methods or loops
- Array methods like `map`, `filter`, `reduce` - use for loops

**Always Use:**
```javascript
// ES5 compatible code
var name = 'value';
function processData() {
  return 'result';
}
var message = 'Hello ' + userName;
for (var i = 0; i < array.length; i++) {
  var item = array[i];
}

// Instead of enum, use object literals:
var Status = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed'
};

// Instead of class, use function constructor:
function MyClass(name) {
  this.name = name;
}
MyClass.prototype.getName = function() {
  return this.name;
};
```

### Rule 2: Use Local Sync for Widget Debugging - NOT snow_query_table!

**CRITICAL: When debugging widgets, ALWAYS use `snow_pull_artifact` first!**

```javascript
// ✅ CORRECT - Use Local Sync for widget debugging
snow_pull_artifact({ 
  sys_id: 'widget_sys_id',
  table: 'sp_widget' 
});
// Now use Claude Code native search, multi-file edit, etc.

// ❌ WRONG - Don't use snow_query_table for debugging widgets
snow_query_table({ 
  table: 'sp_widget',
  query: 'sys_id=...',
  fields: ['template', 'script', 'client_script'] 
});
// This hits token limits and can't use native tools!
```

**Why Local Sync for Widget Debugging:**
- **No token limits** - Handle widgets of ANY size
- **Native search** - Find issues across all files instantly
- **Multi-file view** - See relationships between components
- **Better debugging** - Trace data flow, find missing methods
- **Coherence checking** - Validate all parts work together

**Widget Debugging Workflow:**
1. User reports issue → `snow_pull_artifact`
2. Search for error patterns across files
3. Fix using multi-file edit
4. Validate coherence → `snow_validate_artifact_coherence`
5. Push fixes back → `snow_push_artifact`

### Rule 3: Background Scripts for Verification Only

Background scripts provide immediate feedback but should NOT be used for widget updates. Use them for verification:

```javascript
// Use for verification and testing
const verify = await snow_execute_script_with_output({
  script: `/* Test code */`
});
```

### Rule 4: Widget Coherence - Critical Client-Server Communication

ServiceNow widgets MUST have perfect communication between client and server scripts. This is not optional - widgets fail when these components don't talk to each other correctly.

**IMPORTANT: Use Local Sync Instead of Query for Large Widgets**

When you see "exceeds maximum allowed tokens" errors, don't try to fetch fields separately with `snow_query_table`. Use Local Sync instead:

```javascript
// ❌ WRONG - Don't do this when debugging:
snow_query_table({ table: 'sp_widget', fields: ['name'] });
snow_query_table({ table: 'sp_widget', fields: ['script'] });
snow_query_table({ table: 'sp_widget', fields: ['client_script'] });
// This is inefficient and can't use native tools!

// ✅ CORRECT - Use Local Sync:
snow_pull_artifact({ 
  sys_id: '01d01d6983176a502a7ea130ceaad376' 
});
// All files available locally with NO token limits!
```

**Local Sync Benefits:**
- Handles widgets of ANY size automatically
- All files available for native tool usage
- Maintains relationships between components
- Enables powerful search and refactoring

**The Three-Way Contract:**

**Server Script Must:**
- Initialize all `data` properties that HTML will reference
- Handle every `input.action` that client sends
- Return data in the format client expects

**Client Script Must:**
- Implement every method that HTML calls via `ng-click`
- Use `c.server.get({action: 'name'})` for server communication
- Update `c.data` when server responds

**HTML Template Must:**
- Only reference `data` properties that server provides
- Only call methods that client implements
- Use correct Angular directives and bindings

**Critical Communication Points:**

1. **Server → Client Data Flow**
   - Server sets `data.property`
   - Client receives via `c.data.property`
   - HTML displays with `{{data.property}}`

2. **Client → Server Requests**
   - Client sends `c.server.get({action: 'name'})`
   - Server receives via `input.action`
   - Server processes and returns updated `data`

3. **HTML → Client Method Calls**
   - HTML has `ng-click="methodName()"`
   - Client must have `$scope.methodName = function()`
   - Method typically calls server with `c.server.get()`

**Common Failures to Avoid:**
- Action name mismatches between client and server
- Method name mismatches between HTML and client  
- Property name mismatches between server and HTML
- Missing handlers for client requests
- Orphaned data properties or methods

**Coherence Validation Checklist:**
- [ ] Every `data.property` in server is used in HTML/client
- [ ] Every `ng-click` in HTML has matching `$scope.method` in client
- [ ] Every `c.server.get({action})` in client has matching `if(input.action)` in server
- [ ] Data flows correctly: Server → HTML → Client → Server
- [ ] No orphaned methods or unused data properties

### Rule 5: Evidence-Based Debugging

Follow this systematic approach for all debugging:

1. **Reproduce** - Run the exact failing code
2. **Inventory** - List all dependencies
3. **Verify** - Test each dependency exists
4. **Fix** - Correct only confirmed issues

**Fix only:**
- ✅ Confirmed syntax errors
- ✅ Verified null references
- ✅ Missing dependencies (after verification)
- ✅ Real type mismatches

**Never change:**
- ❌ Unverified resources
- ❌ Configurations that "seem wrong"
- ❌ APIs you haven't tested
- ❌ Working code that could be "better"

## ServiceNow Development Standards

### Table Operations
- Always verify table existence before operations
- Use proper field types and references
- Check for ACLs and permissions
- Handle large datasets with pagination

### Script Development
- Use Script Includes for reusable code
- Implement proper error handling
- Add meaningful logging with gs.info/warn/error
- Test in scoped applications when applicable

### Widget Development
- Ensure HTML/Client/Server coherence
- Use Angular providers correctly
- Implement proper data binding
- Test across different themes and portals

### Flow Development
- Use proper trigger conditions
- Implement error handling paths
- Add appropriate logging actions
- Test with various data scenarios

## MCP Server Capabilities

Snow-Flow includes 22 specialized MCP servers, each providing comprehensive ServiceNow capabilities:

### 1. ServiceNow Deployment Server
**Purpose:** Widget and artifact deployment with coherence validation

**Key Tools:**
- `snow_deploy_widget` - Deploy widgets with HTML/Client/Server validation
- `snow_deploy_portal_page` - Deploy portal pages
- `snow_deploy_flow` - Deploy Flow Designer flows
- `snow_create_update_set` - Create update sets
- `snow_validate_deployment` - Validate deployed artifacts
- `snow_rollback_deployment` - Rollback failed deployments

**Special Features:**
- Automatic widget coherence validation
- Data flow contract verification
- Method implementation checking
- CSS class validation

### 2. ServiceNow Operations Server
**Purpose:** Core ServiceNow operations and queries

**Key Tools:**
- `snow_query_table` - Universal table querying with pagination
- `snow_create_incident` - Create and manage incidents
- `snow_update_record` - Update any table record
- `snow_delete_record` - Delete records with validation
- `snow_discover_table_fields` - Discover table schema
- `snow_cmdb_search` - Search Configuration Management Database

**Features:**
- Full CRUD operations on any table
- Advanced query capabilities
- Field discovery and validation
- Relationship navigation

### 3. ServiceNow Automation Server
**Purpose:** Script execution and automation

**Key Tools:**
- `snow_execute_script_with_output` - Execute scripts with output capture
- `snow_get_script_output` - Retrieve script execution history
- `snow_execute_script_sync` - Synchronous script execution
- `snow_get_logs` - Access system logs
- `snow_test_rest_connection` - Test REST integrations
- `snow_trace_execution` - Trace script execution
- `snow_schedule_job` - Create scheduled jobs
- `snow_create_event` - Trigger system events

**Features:**
- Full output capture (gs.print/info/warn/error)
- Execution history tracking
- System log access
- REST message testing
- Performance tracing

### 4. ServiceNow Platform Development Server
**Purpose:** Platform development artifacts

**Key Tools:**
- `snow_create_script_include` - Create reusable scripts
- `snow_create_business_rule` - Create business rules
- `snow_create_client_script` - Create client-side scripts
- `snow_create_ui_policy` - Create UI policies
- `snow_create_ui_action` - Create UI actions
- `snow_create_ui_page` - Create UI pages

**Features:**
- Full artifact creation
- Proper scoping support
- Condition builder integration
- Script validation

### 5. ServiceNow Integration Server
**Purpose:** Integration and data management

**Key Tools:**
- `snow_create_rest_message` - Create REST integrations
- `snow_create_transform_map` - Create data transformation maps
- `snow_create_import_set` - Manage import sets
- `snow_test_web_service` - Test web services
- `snow_configure_email` - Configure email settings

**Features:**
- REST/SOAP integration
- Data transformation
- Import/Export capabilities
- Email configuration

### 6. ServiceNow System Properties Server
**Purpose:** System property management

**Key Tools:**
- `snow_property_get` - Retrieve property values
- `snow_property_set` - Set property values
- `snow_property_list` - List properties by pattern
- `snow_property_delete` - Remove properties
- `snow_property_bulk_update` - Bulk operations
- `snow_property_export` - Export to JSON
- `snow_property_import` - Import from JSON

**Features:**
- Full CRUD on sys_properties
- Bulk operations
- Import/Export capabilities
- Property validation

### 7. ServiceNow Update Set Server
**Purpose:** Change management and deployment with automatic user synchronization

**Key Tools:**
- `snow_create_update_set` - Create new update sets
- `snow_ensure_active_update_set` - Ensure active Update Set (auto-syncs current)
- `snow_sync_current_update_set` - **NEW:** Sync user's current Update Set with Snow-Flow
- `snow_complete_update_set` - Mark as complete
- `snow_preview_update_set` - Preview changes
- `snow_export_update_set` - Export as XML

**🆕 AUTO-SYNC FEATURE:**
Snow-Flow now automatically sets its Update Set as the user's current Update Set in ServiceNow. This prevents confusion where Snow-Flow works in one Update Set while the user sees a different current Update Set.

**Features:**
- **Automatic current Update Set synchronization** - user and Snow-Flow always in same Update Set
- Full update set lifecycle management
- Change tracking and artifact management
- XML export/import capabilities
- Conflict detection and resolution

### 8. ServiceNow Development Assistant Server
**Purpose:** Code generation and best practices

**Key Tools:**
- `snow_generate_code` - Generate ServiceNow code
- `snow_suggest_pattern` - Suggest design patterns
- `snow_review_code` - Code review and analysis
- `snow_optimize_performance` - Performance recommendations

**Features:**
- Pattern-based code generation
- Best practice enforcement
- Performance optimization
- Security review

### 9. ServiceNow Security & Compliance Server
**Purpose:** Security and compliance management

**Key Tools:**
- `snow_create_security_policy` - Create security policies
- `snow_audit_compliance` - Compliance auditing
- `snow_scan_vulnerabilities` - Vulnerability scanning
- `snow_assess_risk` - Risk assessment
- `snow_review_access_control` - ACL review

**Features:**
- SOX/GDPR/HIPAA compliance
- Security policy management
- Vulnerability assessment
- Access control validation

### 10. ServiceNow Reporting & Analytics Server
**Purpose:** Reporting and data visualization

**Key Tools:**
- `snow_create_report` - Create reports
- `snow_create_dashboard` - Create dashboards
- `snow_define_kpi` - Define KPIs
- `snow_schedule_report` - Schedule report delivery
- `snow_analyze_data_quality` - Data quality analysis

**Features:**
- Advanced reporting
- Dashboard creation
- KPI management
- Scheduled delivery

### 11. ServiceNow Machine Learning Server
**Purpose:** AI/ML capabilities

**Key Tools:**
- `snow_train_classifier` - Train incident classifier
- `snow_predict_change_risk` - Predict change risks
- `snow_detect_anomalies` - Anomaly detection
- `snow_forecast_incidents` - Incident forecasting
- `snow_optimize_process` - Process optimization

**Features:**
- Predictive analytics
- Pattern recognition
- Anomaly detection
- Process optimization

### 12. ServiceNow Knowledge & Catalog Server
**Purpose:** Knowledge base and service catalog management

**Key Tools:**
- `snow_create_knowledge_article` - Create knowledge articles
- `snow_search_knowledge` - Search knowledge base
- `snow_create_catalog_item` - Create catalog items
- `snow_create_catalog_variable` - Create catalog variables
- `snow_create_catalog_ui_policy` - Create UI policies
- `snow_order_catalog_item` - Order catalog items
- `snow_discover_catalogs` - Discover available catalogs

**Features:**
- Knowledge article management
- Service catalog configuration
- Catalog item ordering
- Variable and policy management

### 13. ServiceNow Change, Virtual Agent & PA Server
**Purpose:** Change management, Virtual Agent, and Performance Analytics

**Key Tools:**
- `snow_create_change_request` - Create change requests
- `snow_schedule_cab_meeting` - Schedule CAB meetings
- `snow_create_va_topic` - Create Virtual Agent topics
- `snow_send_va_message` - Send VA messages
- `snow_create_pa_indicator` - Create PA indicators
- `snow_create_pa_widget` - Create PA widgets
- `snow_get_pa_scores` - Get performance scores

**Features:**
- Change management workflows
- Virtual Agent configuration
- Performance Analytics setup
- CAB meeting management

### 14. ServiceNow Flow, Workspace & Mobile Server + UI Builder
**Purpose:** Flow Designer, Agent Workspace configuration, Mobile app management, and complete UI Builder integration

**Flow Designer Tools:**
- `snow_list_flows` - List and discover Flow Designer flows
- `snow_execute_flow` - Execute existing flows programmatically
- `snow_get_flow_execution_status` - Monitor flow execution status
- `snow_get_flow_execution_history` - View flow execution history
- `snow_get_flow_details` - Get detailed flow configuration
- `snow_import_flow_from_xml` - Import flows from XML (only programmatic creation method)

**🏗️ COMPLETE UX WORKSPACE CREATION (Official ServiceNow APIs):**

**VERIFIED:** All tools use official ServiceNow Now Experience Framework APIs. Fully tested and production-ready!

**Now Experience Framework Workspace (Recommended):**
- `snow_create_complete_workspace` - **OFFICIAL:** Complete Now Experience Framework workspace
- Creates: Experience (sys_ux_experience) → List Menu (sys_ux_list_menu_config) → App Config (sys_ux_app_config) → Page Properties (sys_ux_page_property) → List Configuration (sys_ux_list_category, sys_ux_list) → App Route (sys_ux_app_route)
- **Fully functional:** Ready for production use with proper ServiceNow architecture
- Required: `workspace_name`, optional: `tables` for list configuration

**Configurable Agent Workspace (Enterprise):**
- `snow_create_configurable_agent_workspace` - **OFFICIAL:** Agent Workspace with UX App architecture
- Creates: App Route (sys_ux_app_route) → Screen Collections (sys_ux_screen_type) for each table
- **Enterprise features:** Designed for agent productivity and case management
- Required: `name`, `tables` for screen collections

**Individual Components (for fine control):**
- `snow_create_ux_experience` - Experience Record (sys_ux_experience)
- `snow_create_ux_app_config` - App Configuration (sys_ux_app_config)
- `snow_create_ux_page_macroponent` - Page Macroponent (sys_ux_macroponent)
- `snow_create_ux_page_registry` - Page Registry (sys_ux_page_registry)
- `snow_create_ux_app_route` - Route Record (sys_ux_app_route)
- `snow_update_ux_app_config_landing_page` - Landing Page Configuration

**Workspace Management:**
- `snow_discover_all_workspaces` - **COMPREHENSIVE:** Discover all workspace types
- `snow_validate_workspace_configuration` - **BEST PRACTICES:** Validate configuration and performance


**Mobile App Tools:**
- `snow_configure_mobile_app` - Configure mobile applications
- `snow_send_push_notification` - Send push notifications
- `snow_configure_offline_sync` - Configure offline sync

**🆕 COMPLETE UI BUILDER + WORKSPACE INTEGRATION (25+ TOOLS!):**

**UI Builder Page Management (sys_ux_page):**
- `snow_create_uib_page` - Create UI Builder pages with automatic routing
- `snow_update_uib_page` - Update page configuration and metadata
- `snow_delete_uib_page` - Delete pages with comprehensive dependency validation
- `snow_discover_uib_pages` - Find all UI Builder pages with filtering

**UI Builder Component Library (sys_ux_lib_*):**
- `snow_create_uib_component` - Create custom UI components with source code
- `snow_update_uib_component` - Update component definitions and source
- `snow_discover_uib_components` - Browse ServiceNow built-in + custom components
- `snow_clone_uib_component` - Clone and modify existing components

**UI Builder Data Integration (sys_ux_data_broker):**
- `snow_create_uib_data_broker` - Connect ServiceNow tables/scripts/REST to pages
- `snow_configure_uib_data_broker` - Update queries, caching, and refresh settings

**UI Builder Layout Management (sys_ux_page_element):**
- `snow_add_uib_page_element` - Add components to pages with full configuration
- `snow_update_uib_page_element` - Update component properties and positioning  
- `snow_remove_uib_page_element` - Remove elements with dependency checking

**UI Builder Advanced Features:**
- `snow_create_uib_page_registry` - Configure URL routing and access control
- `snow_discover_uib_routes` - Find all page routes with security info
- `snow_create_uib_client_script` - Add client-side JavaScript for pages
- `snow_create_uib_client_state` - Manage page state and persistence
- `snow_create_uib_event` - Create custom events for components
- `snow_analyze_uib_page_performance` - Performance analysis and optimization
- `snow_validate_uib_page_structure` - Structure validation and best practices
- `snow_discover_uib_page_usage` - Usage analytics and complexity scoring

**Important:** Flow creation is only supported through Flow Designer UI, not programmatically

**Features:**
- Flow Designer automation
- Complete Agent Workspace configuration
- Mobile app management with push notifications
- **Complete UI Builder/UXF integration** - Full Now Experience Framework development
- **Conversational UI development** - Create modern ServiceNow UIs through natural language
- **Component library management** - Custom component development and reuse
- **Performance optimization** - Built-in UI Builder performance analysis
- **Structure validation** - Comprehensive dependency and integrity checking

### 15. ServiceNow CMDB, Event, HR, CSM & DevOps Server
**Purpose:** CMDB management, Event processing, HR services, Customer Service, and DevOps

**Key Tools:**
- `snow_create_ci` - Create Configuration Items
- `snow_create_ci_relationship` - Create CI relationships
- `snow_run_discovery` - Run discovery
- `snow_create_event` - Create events
- `snow_create_hr_case` - Create HR cases
- `snow_employee_onboarding` - Employee onboarding
- `snow_create_customer_case` - Create customer cases
- `snow_create_devops_pipeline` - Create DevOps pipelines

**Features:**
- CMDB management
- Event correlation
- HR case management
- Customer service management
- DevOps pipeline integration

### 16. ServiceNow Advanced Features Server
**Purpose:** Advanced capabilities for optimization and analysis

**Key Tools:**
- `snow_batch_api` - Batch API operations (80% API reduction)
- `snow_get_table_relationships` - Analyze table relationships
- `snow_analyze_query` - Query optimization
- `snow_detect_code_patterns` - Code pattern detection
- `snow_discover_process` - Process discovery
- `snow_analyze_workflow_execution` - Workflow analysis
- `snow_generate_documentation` - Auto-documentation

**Features:**
- Batch operations for performance
- Advanced analytics
- Process mining
- Code optimization
- Automatic documentation

### 17. ServiceNow Local Development Server
**Purpose:** Bridge between ServiceNow artifacts and Claude Code's native development tools

**Key Tools:**
- `snow_pull_artifact` - Pull any ServiceNow artifact to local files
- `snow_push_artifact` - Push local changes back with validation
- `snow_validate_artifact_coherence` - Validate artifact relationships
- `snow_list_supported_artifacts` - List all supported artifact types
- `snow_sync_status` - Check sync status of local artifacts
- `snow_sync_cleanup` - Clean up local files after sync
- `snow_convert_to_es5` - Convert modern JavaScript to ES5

**Features:**
- Supports 12+ artifact types dynamically
- Smart field chunking for large artifacts
- ES5 validation for server-side scripts
- Coherence validation for widgets
- Full Claude Code native tool integration

**Supported Artifact Types:**
- Service Portal Widgets (`sp_widget`)
- Flow Designer Flows (`sys_hub_flow`)
- Script Includes (`sys_script_include`)
- Business Rules (`sys_script`)
- UI Pages (`sys_ui_page`)
- Client Scripts (`sys_script_client`)
- UI Policies (`sys_ui_policy`)
- REST Messages (`sys_rest_message`)
- Transform Maps (`sys_transform_map`)
- Scheduled Jobs (`sysauto_script`)
- Fix Scripts (`sys_script_fix`)

### 18. Snow-Flow Orchestration Server
**Purpose:** Multi-agent coordination and task management

**Key Tools:**
- `snow_swarm_init` - Initialize agent swarms
- `snow_agent_spawn` - Create specialized agents
- `snow_task_orchestrate` - Orchestrate complex tasks
- `snow_memory_store` - Persistent memory storage
- `snow_neural_train` - Train neural networks
- `snow_performance_analyze` - Performance analysis

**Features:**
- Multi-agent coordination
- Task orchestration
- Neural network training (TensorFlow.js)
- Memory management
- Performance monitoring

## Local Development with Artifact Sync

### Dynamic Artifact Synchronization

The Local Development Server enables editing ServiceNow artifacts using Claude Code's native file tools. This creates a powerful development bridge between ServiceNow and local development environments.

**Workflow:**

1. **Pull Artifact to Local Files**
   ```javascript
   // Auto-detect artifact type
   snow_pull_artifact({ sys_id: 'any_sys_id' });
   
   // Or specify table for faster pull
   snow_pull_artifact({ 
     sys_id: 'widget_sys_id',
     table: 'sp_widget' 
   });
   ```

2. **Edit with Claude Code Native Tools**
   - Full search capabilities across files
   - Multi-file editing and refactoring
   - Syntax highlighting and validation
   - Git-like diff viewing
   - Go-to-definition and references

3. **Validate Coherence**
   ```javascript
   // Check artifact relationships
   snow_validate_artifact_coherence({ 
     sys_id: 'artifact_sys_id' 
   });
   ```

4. **Push Changes Back**
   ```javascript
   // Push with automatic validation
   snow_push_artifact({ sys_id: 'artifact_sys_id' });
   
   // Force push despite warnings
   snow_push_artifact({ 
     sys_id: 'artifact_sys_id',
     force: true 
   });
   ```

5. **Clean Up**
   ```javascript
   // Remove local files after sync
   snow_sync_cleanup({ sys_id: 'artifact_sys_id' });
   ```

**Artifact Registry:**

Each artifact type is configured with:
- Field mappings to local files
- Context-aware wrappers for better editing
- ES5 validation flags for server scripts
- Coherence rules for interconnected fields
- Preprocessors/postprocessors for data transformation

**File Structure Example:**
```
/tmp/snow-flow-artifacts/
├── widgets/
│   └── my_widget/
│       ├── my_widget.html          # Template
│       ├── my_widget.server.js     # Server script (ES5)
│       ├── my_widget.client.js     # Client script
│       ├── my_widget.css           # Styles
│       ├── my_widget.config.json   # Configuration
│       └── README.md               # Context & instructions
├── script_includes/
│   └── MyScriptInclude/
│       ├── MyScriptInclude.js      # Script
│       └── MyScriptInclude.docs.md # Documentation
└── business_rules/
    └── my_rule/
        ├── my_rule.js               # Rule script
        └── my_rule.condition.js     # Condition
```

**Benefits:**
- Use your favorite editor features
- Full search and replace capabilities
- Version control integration
- Bulk operations across artifacts
- Offline development capability
- Advanced refactoring tools

## Debugging Best Practices

### Systematic Debugging Protocol

1. **Reproduce the Issue**
   ```javascript
   // Always use ES5 and test exact code
   const result = await snow_execute_script_with_output({
     script: `/* Exact failing code in ES5 */`
   });
   ```

2. **Verify Dependencies**
   - Check all referenced tables exist
   - Verify all properties are set
   - Confirm all fields are present
   - Test all integrations work

3. **Test in Context**
   - Use same scope and variables
   - Include same imports
   - Test with same data

4. **Apply Evidence-Based Fixes**
   - Fix only confirmed issues
   - Document why changes were made
   - Test fixes thoroughly

### Common Verification Patterns

**Table Verification:**
```javascript
var table = new GlideRecord('table_name');
gs.info('Table exists: ' + table.isValid());
```

**Property Verification:**
```javascript
var prop = gs.getProperty('property.name');
gs.info('Property value: ' + (prop || 'NOT SET'));
```

**Field Verification:**
```javascript
var gr = new GlideRecord('table');
var element = gr.getElement('field_name');
gs.info('Field exists: ' + (element ? 'Yes' : 'No'));
```

## Command Reference

### Core Commands
- `./snow-flow start` - Start orchestration system
- `./snow-flow status` - System status
- `./snow-flow monitor` - Real-time monitoring

### Agent Management
- `./snow-flow agent spawn <type>` - Create agents
- `./snow-flow agent list` - List active agents

### Task Management
- `./snow-flow task create` - Create tasks
- `./snow-flow task list` - View task queue

### Memory Operations
- `./snow-flow memory store <key> <data>` - Store data
- `./snow-flow memory get <key>` - Retrieve data
- `./snow-flow memory list` - List all keys

### SPARC Modes
- `./snow-flow sparc "<task>"` - Orchestrator mode
- `./snow-flow sparc run <mode> "<task>"` - Specific mode
- `./snow-flow sparc tdd "<feature>"` - Test-driven development

### Swarm Coordination
- `./snow-flow swarm "<objective>"` - Multi-agent coordination
- Options: `--strategy`, `--mode`, `--parallel`, `--monitor`

## Workflow Guidelines

### Development Workflow
1. **Plan** - Use TodoWrite for task management
2. **Verify** - Check existing resources
3. **Develop** - Follow ES5 standards
4. **Test** - Use background scripts
5. **Deploy** - Use update sets
6. **Validate** - Verify deployment

### Testing Workflow
1. Run unit tests with background scripts
2. Test integrations with REST tools
3. Validate UI with widget coherence
4. Check performance with tracing
5. Review logs for errors

### Debugging Workflow
1. Reproduce issue exactly
2. Gather evidence with scripts
3. Verify all assumptions
4. Apply minimal fixes
5. Test thoroughly
6. Document changes

## Important Reminders

### Always Remember
- Every ServiceNow instance is unique
- Custom implementations exist that you don't know about
- Preview/beta features may be available
- Organization-specific configurations are common
- Test everything before making assumptions

### Never Assume
- That something doesn't exist without verification
- That configurations are wrong without testing
- That APIs aren't available without checking
- That code won't work without running it
- That you know better than existing implementations

### Golden Rules
1. **Verify First** - Test before declaring broken
2. **ES5 Only** - No modern JavaScript in ServiceNow
3. **Evidence-Based** - Make decisions on facts, not assumptions
4. **Minimal Changes** - Fix only what's broken
5. **Respect Context** - Understand why things exist as they do

## Conclusion

Snow-Flow is a powerful framework for ServiceNow development that emphasizes verification, testing, and evidence-based decision making. By following these guidelines and best practices, you ensure reliable, maintainable, and effective ServiceNow solutions.

Remember: Your job is to solve problems, not to judge implementations. Every environment has its reasons for existing configurations. Verify, test, and respect what you find.