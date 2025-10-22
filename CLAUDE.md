# Snow-Flow ServiceNow Development Framework

## ⚡ QUICK START - READ THIS FIRST!

| What You Want | ❌ WRONG (will fail!) | ✅ CORRECT (works!) |
|---------------|----------------------|---------------------|
| Create UI Page | `node dist/index.js mcp execute ...` | `await snow_create_ui_page({...})` |
| Create Workspace | `npx snow-flow-mcp-client ...` | `await snow_create_complete_workspace({...})` |
| Query Incidents | `snow-flow mcp execute ...` | `await snow_query_incidents({...})` |
| Any MCP Tool | Bash/CLI commands | Direct function call |

**🎯 MCP tools are JavaScript functions - call them directly! NO bash/node/npx needed!**

---

## 🚨 CRITICAL: HOW MCP TOOLS WORK IN OPENCODE

**MCP tools are AUTOMATICALLY AVAILABLE - NO bash/npx/node needed!**

```javascript
// ✅ CORRECT - MCP tools are available directly:
await snow_create_ui_page({
  name: "incident_dashboard",
  html: "<div>...</div>"
});

await snow_create_complete_workspace({
  workspace_name: "IT Support",
  tables: ["incident", "task"]
});
```

## 🚫 FORBIDDEN BASH PATTERNS - NEVER DO THIS!

**❌ THESE COMMANDS DO NOT EXIST AND WILL ALWAYS FAIL:**

```bash
# ❌ WRONG - This file does NOT exist in user's project!
node dist/index.js mcp execute --server "servicenow-platform-dev" --tool "snow_create_ui_page"
# ERROR: Cannot find module 'dist/index.js'

# ❌ WRONG - This package does NOT exist!
npx snow-flow-mcp-client servicenow-unified snow_create_ui_page {...}
# ERROR: 404 Not Found

# ❌ WRONG - MCP tools are NOT CLI commands!
snow-flow mcp execute --tool snow_create_ui_page
# ERROR: No such command

# ❌ WRONG - You cannot "run" MCP tools via bash!
cd project && node snow_create_ui_page.js
# ERROR: Wrong approach entirely!
```

**🚨 WHY THESE FAIL:**
- MCP tools are **functions**, NOT CLI commands
- They are loaded by OpenCode/Claude Code automatically
- No `dist/` directory exists in user's project
- No CLI wrapper exists for MCP tools

**✅ CORRECT WAY (the ONLY way that works):**

```javascript
// Just call the function directly - it's already available!
const result = await snow_create_ui_page({
  name: "incident_management",
  title: "Incident Management",
  html: "...",
  processing_script: "..."
});
```

**🎯 KEY RULE:**
**IF you think you need bash/node/npx to call an MCP tool, you are WRONG! MCP tools are JavaScript functions - call them directly!**

## 🚨 ABSOLUTE RULES - NO EXCEPTIONS

### 🔴 RULE #0: MCP TOOLS FIRST - NEVER USE LOCAL APPROACHES!

**❌ WRONG APPROACH (FORBIDDEN):**
- Writing local scripts to "test something first"
- Using background scripts for complex operations instead of MCP tools
- Creating files locally "to prepare before deployment"
- Building things locally then deploying to ServiceNow
- Using generic queries when specific MCP tools exist

**✅ CORRECT APPROACH (MANDATORY):**
- **ALWAYS search for MCP tools FIRST** before doing anything
- **Use dedicated MCP tools** for every ServiceNow operation
- **Create directly in ServiceNow** via MCP tools, never locally first
- **Dedicated tool > Background script** ALWAYS

**Examples:**
```javascript
// ❌ WRONG: Using background script for workspace creation
snow_execute_background_script({
  script: "var gr = new GlideRecord('sys_ux_app_config')..."
});

// ✅ CORRECT: Use dedicated MCP tool
snow_create_complete_workspace({
  workspace_name: "IT Support Workspace",
  tables: ["incident", "task"]
});

// ❌ WRONG: Generic query when specific tool exists
snow_query_table({ table: 'sp_widget', query: 'sys_id=...' });

// ✅ CORRECT: Use dedicated widget tool
snow_pull_artifact({ sys_id: 'widget_sys_id' });
```

**MCP Tool Discovery Process:**
1. **Search**: "Does a tool exist for [task]?" (e.g., snow_create_workspace, snow_deploy_widget)
2. **Check category**: deployment, operations, ui-builder, workspace, automation
3. **Use dedicated tool**: ALWAYS prefer specific tools over generic ones
4. **Background scripts**: ONLY for verification, NEVER for development

### 🔴 RULE #1: UPDATE SET WORKFLOW - MANDATORY FOR ALL DEVELOPMENT!

**🚨 CRITICAL: EVERY development task MUST follow this workflow:**

```javascript
// STEP 1: ALWAYS create/ensure active Update Set FIRST (before ANY development)
const updateSet = await snow_create_update_set({
  name: "Feature: [Descriptive Name]",  // e.g., "Feature: Incident Dashboard Widget"
  description: "Complete description of changes",
  application: "global"  // or specific app scope
});

// STEP 2: Ensure it's active (Snow-Flow auto-sets as current in ServiceNow!)
await snow_ensure_active_update_set({
  sys_id: updateSet.sys_id
});

// STEP 3: NOW start development - all changes auto-tracked
await snow_deploy({
  type: 'widget',
  config: { name: 'incident_dashboard', ... }
});

// STEP 4: Complete Update Set when done
await snow_complete_update_set({
  sys_id: updateSet.sys_id,
  state: 'complete'
});
```

**❌ FORBIDDEN WORKFLOW:**
- Starting development without creating Update Set first
- Creating artifacts then trying to "add them to Update Set later"
- Assuming changes are being tracked (they're not without active Update Set!)
- Working across multiple Update Sets for single feature

**✅ MANDATORY WORKFLOW:**
1. **CREATE Update Set** (descriptive name: "Feature: X" or "Fix: Y")
2. **ACTIVATE Update Set** (snow_ensure_active_update_set)
3. **DEVELOP** (all changes auto-tracked in active Update Set)
4. **COMPLETE Update Set** (mark as complete when done)

**Update Set Best Practices:**
- **One feature = One Update Set** (clear scope)
- **Descriptive names**: "Feature: Incident Auto-Assignment" not "Changes"
- **Complete description**: What, why, affected tables/components
- **Always check current**: Use snow_sync_current_update_set if unsure

### 🔴 RULE #2: Widget Debugging MUST Use Local Sync!

**When user reports ANY widget issue, ALWAYS use:**
```
snow_pull_artifact({ sys_id: 'widget_sys_id' })
```

**NEVER use snow_query_table for widgets!** It will hit token limits and you can't use native tools.

**Common scenarios requiring snow_pull_artifact:**
- "Widget skips questions" → snow_pull_artifact
- "Form doesn't submit" → snow_pull_artifact
- "Data not displaying" → snow_pull_artifact
- "Button doesn't work" → snow_pull_artifact
- "Debug this widget" → snow_pull_artifact
- "Fix widget issue" → snow_pull_artifact
- Widget script > 1000 chars → snow_pull_artifact

### Rule #3: NO MOCK DATA - EVERYTHING REAL & COMPLETE
**FORBIDDEN:** Mock data, placeholders, TODOs, stub implementations, test values, simulations, "this would normally...", partial implementations.
**REQUIRED:** Complete, production-ready, fully functional code. Take time to implement EVERYTHING properly. Real integrations, comprehensive error handling, full validation.

### Rule #4: ES5 ONLY - ServiceNow Rhino Engine
**NEVER USE:** const/let, arrow functions =>, template literals `${}`, destructuring, for...of, default parameters, classes
**ALWAYS USE:** var, function(){}, string concatenation +, traditional for loops, typeof checks

### Rule #5: VERIFY FIRST - Never Assume
Test before claiming broken. Check resources exist. Validate configurations. Evidence-based fixes only.

## 🔍 TOOL DISCOVERY DECISION TREE - USE THIS EVERY TIME!

**Before doing ANYTHING, follow this decision tree:**

### Step 1: What is the user asking for?

| User Request | Task Category | Go to Step 2 |
|--------------|---------------|--------------|
| "Create workspace/UI/widget/rule/etc." | CREATE NEW | → Create Decision |
| "Fix/update/modify existing X" | UPDATE EXISTING | → Update Decision |
| "Debug/check/test X" | DEBUG/VERIFY | → Debug Decision |
| "Show/list/find X" | QUERY DATA | → Query Decision |

### Step 2: Find the Right Tool

**CREATE NEW Decision:**
- User wants: "Create workspace for IT agents"
  - Category: Workspace (UX Framework)
  - Tool: `snow_create_complete_workspace`
  - REMEMBER: Create Update Set FIRST!

- User wants: "Create business rule"
  - Category: Platform Development
  - Tool: `snow_create_business_rule`
  - REMEMBER: Create Update Set FIRST!

- User wants: "Create widget"
  - Category: Deployment
  - Tool: `snow_deploy` (type: 'widget')
  - REMEMBER: Create Update Set FIRST!

- User wants: "Create UI Builder page"
  - Category: UI Builder
  - Tool: `snow_create_uib_page`
  - REMEMBER: Create Update Set FIRST!

**UPDATE EXISTING Decision:**
- Updating: Widget
  - Is it debugging? YES: `snow_pull_artifact` (local sync)
  - Simple field update? NO: `snow_update` (type: 'widget')

- Updating: Any other artifact
  - Tool: `snow_update` or `snow_edit_artifact`
  - REMEMBER: Ensure Update Set is active!

**DEBUG/VERIFY Decision:**
- Debugging: Widget not working
  - ALWAYS: `snow_pull_artifact` (get all files locally)
  - NEVER: `snow_query_table` (token limits!)

- Debugging: Script/rule not working
  - Tool: `snow_execute_script_with_output` (test the code)

- Verifying: Table/field exists
  - Tool: `snow_execute_script_with_output` (check with GlideRecord)

**QUERY DATA Decision:**
- Querying: Widget data
  - NEVER: `snow_query_table` (use `snow_pull_artifact` instead!)

- Querying: Table data (incidents, users, etc.)
  - Tool: `snow_query_table` or specific tools (`snow_query_incidents`)

- Querying: Multiple tables
  - Tool: `snow_batch_api` (80% faster!)

### Step 3: MANDATORY - Update Set Check!

**🚨 BEFORE calling ANY development tool, ask yourself:**

- ✅ Did I create an Update Set? If NO: STOP! Create one first!
- ✅ Is the Update Set active? If NO: Call `snow_ensure_active_update_set`!
- ✅ Ready to develop? NOW you can call the tool!

**The Update Set Mantra (repeat before EVERY development task):**
1. CREATE Update Set (`snow_create_update_set`)
2. ACTIVATE Update Set (`snow_ensure_active_update_set`)
3. DEVELOP (now all changes are tracked!)
4. COMPLETE Update Set (`snow_complete_update_set`)

---

## 📋 MCP SERVERS & TOOLS (18 Servers, 200+ Tools)

### 1. **servicenow-local-development** 🔧 Widget/Artifact Sync [USE THIS FOR WIDGETS!]
```
snow_pull_artifact - Pull ANY artifact to local files (ALWAYS use for widgets!)
snow_push_artifact - Push local changes back to ServiceNow  
snow_cleanup_artifacts - Clean local artifact cache
snow_get_sync_status - Check artifact sync status
snow_list_local_artifacts - List all pulled artifacts
```
**⚠️ CRITICAL: For ANY widget work, use snow_pull_artifact FIRST, not snow_query_table!**

### 2. **servicenow-deployment** 🚀 Complete Deployment System
```
snow_deploy - Create NEW artifacts (widgets, flows, scripts, pages)
snow_update - UPDATE existing artifacts directly
snow_validate_deployment - Validate before deploy
snow_rollback_deployment - Rollback failed deployments
snow_preview_widget - Preview widget rendering
snow_widget_test - Test widget functionality
snow_deployment_history - View deployment history
snow_check_widget_coherence - Validate HTML/Client/Server communication
```

### 3. **servicenow-operations** 📊 Core Operations
```
snow_query_table - Universal table query (NOT for widgets - use snow_pull_artifact!)
snow_query_incidents - Query and analyze incidents
snow_analyze_incident - AI-powered incident analysis
snow_auto_resolve_incident - Automated resolution
snow_cmdb_search - Configuration database search
snow_user_lookup - Find users and groups
snow_operational_metrics - Performance metrics
snow_knowledge_search - Search knowledge base
snow_catalog_item_manager - Manage service catalog
```

### 4. **servicenow-automation** ⚙️ Scripts & Automation
```
snow_execute_background_script - Run ES5 scripts (autoConfirm available)
snow_execute_script_with_output - Execute with output capture
snow_execute_script_sync - Synchronous execution
snow_get_script_output - Retrieve script results
snow_schedule_job - Create scheduled jobs
snow_create_event - Trigger system events
snow_get_logs - Access system logs
snow_test_rest_connection - Test REST endpoints
snow_trace_execution - Performance tracing
```

### 5. **servicenow-platform-development** 🏗️ Development Artifacts
```
snow_create_ui_page - Create UI pages
snow_create_script_include - Reusable scripts
snow_create_business_rule - Business rules
snow_create_client_script - Client-side scripts
snow_create_ui_policy - UI policies
snow_create_ui_action - UI actions
snow_create_acl - Access controls
snow_create_ui_macro - UI macros
```

### 6. **servicenow-integration** 🔌 Integrations
```
snow_create_rest_message - REST integrations
snow_create_soap_message - SOAP integrations
snow_create_transform_map - Data transformation
snow_create_import_set - Import management
snow_test_web_service - Test services
snow_configure_email - Email configuration
snow_create_data_source - Data sources
```

### 7. **servicenow-system-properties** ⚙️ Properties
```
snow_property_get - Get property value
snow_property_set - Set property value
snow_property_list - List by pattern
snow_property_bulk_update - Bulk operations
snow_property_export/import - Export/Import JSON
snow_property_validate - Validate properties
```

### 8. **servicenow-update-set** 📦 Change Management [MANDATORY FOR ALL DEVELOPMENT!]
```
snow_create_update_set - Create new update set (ALWAYS FIRST STEP!)
snow_ensure_active_update_set - Auto-create and activate (sets as current in ServiceNow!)
snow_sync_current_update_set - Sync Snow-Flow with user's current Update Set
snow_complete_update_set - Mark complete when done
snow_export_update_set - Export as XML for deployment
snow_preview_update_set - Preview changes before committing
snow_list_update_sets - List all update sets
snow_get_update_set_changes - View tracked changes
```
**🚨 CRITICAL:** EVERY development task MUST start with snow_create_update_set or snow_ensure_active_update_set!

**Complete Workflow Example:**
```javascript
// 1. CREATE UPDATE SET (before ANY development!)
const updateSet = await snow_create_update_set({
  name: "Feature: Incident Auto-Assignment",
  description: "Implements automatic incident assignment based on category and location",
  application: "global"
});

// 2. ENSURE IT'S ACTIVE (Snow-Flow auto-sets as current in ServiceNow!)
await snow_ensure_active_update_set({ sys_id: updateSet.sys_id });

// 3. NOW DEVELOP (all changes auto-tracked)
await snow_create_business_rule({
  name: "Auto-assign incidents",
  table: "incident",
  when: "before",
  active: true,
  script: "var assignment = new IncidentAssignment(); assignment.autoAssign(current);"
});

await snow_deploy({
  type: 'widget',
  config: { name: 'assignment_dashboard', ... }
});

// 4. COMPLETE UPDATE SET
await snow_complete_update_set({
  sys_id: updateSet.sys_id,
  state: 'complete'
});
```

### 9. **servicenow-development-assistant** 🤖 AI Assistant
```
snow_find_artifact - Find any artifact by name/type
snow_edit_artifact - Edit existing artifacts
snow_analyze_artifact - Analyze dependencies
snow_comprehensive_search - Deep search all tables
snow_analyze_requirements - Requirement analysis
snow_generate_code - Pattern-based generation
snow_optimize_script - Performance optimization
```

### 10. **servicenow-security-compliance** 🛡️ Security
```
snow_create_security_policy - Security policies
snow_audit_compliance - SOX/GDPR/HIPAA audit
snow_scan_vulnerabilities - Vulnerability scan
snow_assess_risk - Risk assessment
snow_review_access_control - ACL review
snow_encrypt_field - Field encryption
snow_audit_trail_analysis - Audit analysis
```

### 11. **servicenow-reporting-analytics** 📈 Reporting
```
snow_create_report - Create reports
snow_create_dashboard - Build dashboards
snow_define_kpi - Define KPIs
snow_schedule_report - Schedule delivery
snow_analyze_data_quality - Data quality
snow_create_pa_widget - Performance analytics
```

### 12. **servicenow-machine-learning** 🧠 Native PI + Local ML

**🚨 TWO COMPLETELY DIFFERENT ML APPROACHES!**

**🏢 Native ServiceNow Predictive Intelligence (NEW! v7.4.0):**
- Runs INSIDE ServiceNow (requires PI license)
- Production-ready, auto-retrain, enterprise ML
- Tools: snow_create_pi_solution, snow_train_pi_solution, snow_monitor_pi_training, snow_activate_pi_solution
- **ALWAYS ask:** "Do you have a ServiceNow Predictive Intelligence license?"

**💻 Local TensorFlow.js ML (Experimental):**
- Runs locally on dev machine (FREE, no license)
- Development/testing only, NOT for production
- Tools: ml_train_incident_classifier, ml_predict_change_risk, ml_detect_anomalies

**📋 Decision Matrix:**
| User Says | Has PI License? | Recommend |
|-----------|----------------|-----------|
| "Create incident predictor" | ✅ Yes | Native PI: snow_create_pi_solution |
| "Create incident predictor" | ❌ No | Local TensorFlow.js: ml_train_incident_classifier |
| "Production ML solution" | ✅ Yes | Native PI (always) |
| "Production ML solution" | ❌ No | STOP: Explain PI license required |
| "Test/experiment with ML" | Either | Can use local TensorFlow.js |

**🚨 CRITICAL: ALWAYS ask about PI license before recommending ML tools!**

```
# Native PI Tools (Production):
snow_create_pi_solution - Create PI solution definition
snow_train_pi_solution - Train model in ServiceNow (10-30 min)
snow_monitor_pi_training - Monitor training progress/metrics
snow_activate_pi_solution - Activate for production use
snow_list_pi_solutions - List all PI solutions
ml_predictive_intelligence - Make predictions (requires trained PI solution)

# Local ML Tools (Dev/Testing Only):
ml_train_incident_classifier - Train LSTM classifier locally
ml_predict_change_risk - Local risk prediction
ml_detect_anomalies - Local anomaly detection
ml_forecast_incidents - Local time series forecast
ml_cluster_similar - Local similarity clustering
ml_performance_analytics - Native PA ML
```

### 13. **servicenow-change-virtualagent-pa** 🔄 Change & Virtual Agent
```
snow_create_change_request - Change requests
snow_assess_change_risk - Risk assessment
snow_create_nlu_model - NLU models
snow_train_virtual_agent - Train VA
snow_configure_conversation - VA conversations
snow_analyze_pa_trends - Performance trends
```

### 14. **servicenow-cmdb-event-hr-csm-devops** 🏢 Enterprise
```
snow_manage_ci - Configuration items
snow_correlate_events - Event correlation
snow_manage_hr_case - HR cases
snow_csm_project - Customer projects
snow_devops_pipeline - CI/CD pipelines
snow_manage_cmdb_relationships - CI relationships
```

### 15. **servicenow-knowledge-catalog** 📚 Knowledge & Catalog (v3.6.10 Corrected!)
```
snow_create_knowledge_article - KB articles
snow_create_catalog_item - Catalog items
snow_create_catalog_variable - Variable sets
snow_create_catalog_ui_policy - CORRECTED: Creates in 2 tables (conditions as string, actions as records)
snow_order_catalog_item - Order catalog items
snow_discover_catalogs - Discover available catalogs
```
**✅ Corrected UI Policy (v3.6.10):** Conditions stored as query string in catalog_conditions field. Actions created in catalog_ui_policy_action table. Based on actual ServiceNow structure!

### 16. **servicenow-flow-workspace-mobile** 📱 Modern UX + UI Builder
```
# Flow Designer Tools
snow_list_flows - List Flow Designer flows
snow_execute_flow - Execute flows programmatically  
snow_get_flow_execution_status - Monitor flow status
snow_get_flow_execution_history - Flow execution history
snow_get_flow_details - Flow configuration details
snow_import_flow_from_xml - Import flows from XML

# Agent Workspace Tools  
snow_create_workspace - Create agent workspace configurations
snow_create_workspace_tab - Add custom workspace tabs
snow_create_contextual_panel - Add contextual side panels
snow_discover_workspaces - Find all workspace configurations

# Mobile App Tools
snow_configure_mobile_app - Configure mobile applications
snow_send_push_notification - Send push notifications  
snow_configure_offline_sync - Setup offline synchronization

# 🆕 COMPLETE UI BUILDER INTEGRATION (15 NEW TOOLS!)
# Page Management (sys_ux_page)
snow_create_uib_page - Create UI Builder pages with routing
snow_update_uib_page - Update page configuration
snow_delete_uib_page - Delete pages with dependency validation
snow_discover_uib_pages - Find all UI Builder pages

# Component Library (sys_ux_lib_*)  
snow_create_uib_component - Create custom UI components
snow_update_uib_component - Update component source & schema
snow_discover_uib_components - Browse component library
snow_clone_uib_component - Clone & modify existing components

# Data Integration (sys_ux_data_broker)
snow_create_uib_data_broker - Connect ServiceNow data sources
snow_configure_uib_data_broker - Update queries & caching

# Layout Management (sys_ux_page_element)
snow_add_uib_page_element - Add components to pages
snow_update_uib_page_element - Update component properties
snow_remove_uib_page_element - Remove elements with validation

# Advanced UI Builder Features
snow_create_uib_page_registry - Configure URL routing
snow_discover_uib_routes - Find all page routes
snow_create_uib_client_script - Add client-side scripts
snow_create_uib_client_state - Manage page state  
snow_create_uib_event - Create custom events
snow_analyze_uib_page_performance - Performance analysis
snow_validate_uib_page_structure - Structure validation
snow_discover_uib_page_usage - Usage analytics
```

### 17. **servicenow-advanced-features** 🎯 Advanced
```
snow_performance_optimization - Optimize instance
snow_batch_operations - Bulk processing
snow_instance_scan - Health check
snow_dependency_analysis - Dependencies
snow_code_search - Search all code
```

### 18. **snow-flow** 🎛️ Orchestration
```
swarm_init - Initialize agent swarms
agent_spawn - Create specialized agents
task_orchestrate - Complex task coordination
memory_search - Search persistent memory
neural_train - Train neural networks
```

## 🔄 Critical Workflows - Quick Reference

### Widget Work: ALWAYS Local Sync!
```javascript
// ✅ CORRECT
await snow_pull_artifact({ sys_id: 'widget_sys_id' });
// ... edit locally ...
await snow_push_artifact({ sys_id: 'widget_sys_id' });

// ❌ WRONG - Token limits!
await snow_query_table({ table: 'sp_widget', ... });
```

### Development: ALWAYS Update Set First!
```javascript
// ✅ CORRECT - Update Set workflow
const updateSet = await snow_create_update_set({ name: "Feature: X" });
await snow_ensure_active_update_set({ sys_id: updateSet.sys_id });
// ... develop ...
await snow_complete_update_set({ sys_id: updateSet.sys_id });

// ❌ WRONG - No Update Set tracking!
await snow_create_business_rule({ ... }); // Changes NOT tracked!
```

### Verification: Use Scripts for Testing Only
```javascript
// ✅ For verification/testing
await snow_execute_script_with_output({
  script: `var gr = new GlideRecord('incident'); gs.info('Exists: ' + gr.isValid());`
});

// ❌ NOT for development!
await snow_execute_background_script({
  script: `var gr = new GlideRecord('sp_widget'); gr.initialize(); ...` // WRONG!
});
```

## 🚨 THE UNIVERSAL WORKFLOW - MEMORIZE THIS!

**Every task follows this pattern:**

1. **📦 UPDATE SET FIRST** - `snow_create_update_set` → `snow_ensure_active_update_set`
2. **🔍 FIND RIGHT TOOL** - Use Tool Discovery Decision Tree above
3. **🛠️ USE MCP TOOL** - Call the dedicated tool (NEVER background scripts for development!)
4. **✅ TEST/VERIFY** - Use `snow_execute_script_with_output` for verification only
5. **✔️ COMPLETE UPDATE SET** - `snow_complete_update_set` when done

**Special Case - Widget Debugging:**
1. UPDATE SET FIRST
2. `snow_pull_artifact` (get all files locally)
3. Edit with native tools
4. `snow_push_artifact` (push back to ServiceNow)
5. COMPLETE UPDATE SET

## 🎯 The 4 Absolute Rules

1. **🔴 UPDATE SETS ALWAYS FIRST** - No development without Update Set tracking!
2. **🔴 MCP TOOLS ONLY** - Use dedicated tools, NOT background scripts for development
3. **🔴 NO MOCK DATA** - Everything real, complete, production-ready (no TODOs, no placeholders)
4. **🔴 ES5 JAVASCRIPT ONLY** - var, function(){}, string concatenation (ServiceNow Rhino engine)

## 📊 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Widget doesn't work | `snow_pull_artifact` + debug locally |
| Forgot Update Set | `snow_create_update_set` → `snow_ensure_active_update_set` |
| Syntax error in script | Check ES5! No const/let/arrows/template literals |
| Widget too large | Use `snow_pull_artifact`, NOT `snow_query_table` |
| Need to test code | `snow_execute_script_with_output` (verification only!) |

---

**🚨 FINAL REMINDER: Update Sets are MANDATORY. MCP Tools are AUTOMATICALLY available. NO Mock Data. ES5 Only.**
---

## 🆕 V8.2.0: OPTIMIZED MCP TOOLS & BREAKING CHANGES

### 📊 What Changed in v8.2.0

**Major Optimizations:**
1. ✅ **Description Optimization**: All 409 tools have concise, token-efficient descriptions
2. ✅ **Metadata Addition**: Every tool now has category, subcategory, use_cases, complexity, and frequency metadata
3. ✅ **Tool Merging**: Reduced redundancy by merging related tools

**Breaking Changes:**
- **Update Set Tools**: 9 tools merged → 3 tools (6 tools removed)

### 🔄 Update Set Tools Migration Guide

**OLD (REMOVED in v8.2.0):**
```javascript
// These tools NO LONGER EXIST:
snow_update_set_create({ name, description })
snow_update_set_switch({ update_set_id })
snow_update_set_complete({ update_set_id })
snow_update_set_export({ update_set_id })
snow_update_set_preview({ update_set_id })
snow_update_set_add_artifact({ update_set_id, artifact_sys_id })
snow_update_set_current()
snow_update_set_list({ state, limit })
```

**NEW (v8.2.0+):**
```javascript
// Unified management tool:
snow_update_set_manage({
  action: 'create',  // or 'switch', 'complete', 'export', 'preview', 'add_artifact'
  name: 'My Update Set',
  description: 'Description',
  auto_switch: true
})

// Unified query tool:
snow_update_set_query({
  action: 'current'  // or 'list'
  // For list: state, limit, order_by
})

// Still available (complex logic):
snow_ensure_active_update_set({ name, description })
```

**Migration Examples:**

```javascript
// OLD: Create and switch
await snow_update_set_create({ name: 'STORY-123', description: 'Add widget' });

// NEW: Same functionality
await snow_update_set_manage({
  action: 'create',
  name: 'STORY-123',
  description: 'Add widget',
  auto_switch: true  // default
});

// OLD: Get current Update Set
await snow_update_set_current();

// NEW: Same functionality
await snow_update_set_query({ action: 'current' });

// OLD: List Update Sets
await snow_update_set_list({ state: 'in progress', limit: 10 });

// NEW: Same functionality
await snow_update_set_query({
  action: 'list',
  state: 'in progress',
  limit: 10
});
```

---

## 🎯 CATEGORY-AWARE TOOL SELECTION (v8.2.0+)

Every MCP tool now has metadata to help you choose the right tool faster!

### Tool Metadata Structure

```javascript
{
  category: 'core-operations',      // Main category
  subcategory: 'query',             // Specific subcategory
  use_cases: ['data-retrieval'],    // What it's used for
  complexity: 'beginner',           // beginner | intermediate | advanced | expert
  frequency: 'very-high'            // very-high | high | medium | low
}
```

### 📁 Tool Categories

**1. core-operations**
   - Subcategories: query, crud, properties, discovery
   - Frequency: very-high
   - Examples: snow_query_table, snow_create_record, snow_update_record

**2. development**
   - Subcategories: update-sets, deployment, local-sync, platform
   - Frequency: very-high
   - Examples: snow_update_set_manage, snow_deploy, snow_pull_artifact

**3. ui-frameworks**
   - Subcategories: ui-builder, workspace, service-portal
   - Frequency: high
   - Examples: snow_create_uib_page, snow_create_complete_workspace, snow_deploy

**4. automation**
   - Subcategories: script-execution, flow-designer, scheduling
   - Frequency: high
   - Examples: snow_execute_script_with_output, snow_execute_flow, snow_schedule_job

**5. integration**
   - Subcategories: rest-soap, transform-maps, import-export
   - Frequency: medium
   - Examples: snow_create_rest_message, snow_create_transform_map

**6. itsm**
   - Subcategories: incident, change, problem, knowledge, catalog
   - Frequency: high
   - Examples: snow_query_incidents, snow_create_change_request, snow_search_knowledge

**7. cmdb**
   - Subcategories: ci-management, discovery, relationships
   - Frequency: medium
   - Examples: snow_create_ci, snow_run_discovery, snow_create_ci_relationship

**8. ml-analytics**
   - Subcategories: predictive-intelligence, performance-analytics, machine-learning
   - Frequency: medium
   - Examples: snow_create_pi_solution, snow_train_pi_solution, snow_create_pa_indicator

**9. advanced**
   - Subcategories: specialized, batch-operations, process-mining
   - Frequency: low-medium
   - Examples: snow_batch_api, snow_analyze_query, snow_discover_process

---

## 🔍 QUICK TOOL FINDER BY USE CASE

### Creating Workspaces for Agents

**Category**: ui-frameworks → workspace
**Primary Tool**: `snow_create_complete_workspace`
**Related Tools**: `snow_create_uib_page`, `snow_add_uib_page_element`

```javascript
// Complete workspace in ONE call:
await snow_create_complete_workspace({
  workspace_name: "IT Support Workspace",
  description: "Agent workspace for IT support team",
  tables: ["incident", "task", "problem"]
});
```

### Widget Development & Debugging

**Category**: ui-frameworks → service-portal, development → local-sync
**Primary Tools**: `snow_deploy`, `snow_pull_artifact`, `snow_push_artifact`

```javascript
// CRITICAL: Use Local Sync for widget debugging!
await snow_pull_artifact({
  sys_id: 'widget_sys_id',
  table: 'sp_widget'
});
// Now edit locally with native tools
await snow_push_artifact({ sys_id: 'widget_sys_id' });
```

### UI Builder Page Development

**Category**: ui-frameworks → ui-builder
**Primary Tools**: `snow_create_uib_page`, `snow_add_uib_page_element`, `snow_create_uib_data_broker`

```javascript
// Create page
const page = await snow_create_uib_page({
  name: "incident_dashboard",
  title: "Incident Dashboard"
});

// Add components
await snow_add_uib_page_element({
  page_sys_id: page.sys_id,
  component_id: "list-component",
  config: { table: "incident" }
});
```

### Update Set Management

**Category**: development → update-sets
**Primary Tools**: `snow_update_set_manage`, `snow_update_set_query`, `snow_ensure_active_update_set`

```javascript
// ALWAYS create Update Set FIRST:
await snow_update_set_manage({
  action: 'create',
  name: 'STORY-456',
  description: 'Add workspace features',
  auto_switch: true
});

// Make changes...

// Complete when done:
await snow_update_set_manage({
  action: 'complete',
  update_set_id: 'sys_id_here'
});
```

### Script Execution & Testing

**Category**: automation → script-execution
**Primary Tool**: `snow_execute_script_with_output`

```javascript
// ES5 ONLY! Test scripts:
await snow_execute_script_with_output({
  script: `
    var gr = new GlideRecord('incident');
    gr.query();
    gs.info('Total incidents: ' + gr.getRowCount());
  `
});
```

### Data Querying & Analysis

**Category**: core-operations → query
**Primary Tools**: `snow_query_table`, `snow_query_incidents`, `snow_cmdb_search`

```javascript
// Universal table query:
await snow_query_table({
  table: 'incident',
  query: 'active=true^priority=1',
  fields: ['number', 'short_description', 'assigned_to'],
  limit: 100
});

// Specialized incident query:
await snow_query_incidents({
  filters: { active: true, priority: 1 },
  include_metrics: true
});
```

---

## 🏆 TOOL SELECTION BEST PRACTICES

### Priority Order:

1. **Specific Tool** > Generic Tool
   - Use `snow_create_uib_page` instead of `snow_create_record({ table: 'sys_ux_page' })`
   - Use `snow_query_incidents` instead of `snow_query_table({ table: 'incident' })`

2. **Merged Tool** > Individual Actions (v8.2.0+)
   - Use `snow_update_set_manage({ action: 'create' })` instead of searching for `snow_update_set_create`
   - Use `snow_update_set_query({ action: 'current' })` instead of `snow_update_set_current`

3. **High-Level Tool** > Low-Level Script
   - Use `snow_create_complete_workspace` instead of manual Experience/App Config creation
   - Use dedicated tools instead of `snow_execute_script_with_output` when possible

4. **Local Sync** > Query for Large Artifacts
   - Use `snow_pull_artifact` for widget debugging (no token limits!)
   - Use `snow_query_table` for small metadata lookups

---

## 📈 PERFORMANCE OPTIMIZATIONS

### Token Efficiency (v8.2.0+)

All tools are now optimized for minimal context usage:
- **Concise descriptions**: "Create UX workspace" instead of "Create Complete UX Workspace - Executes all 6 steps automatically..."
- **Compact schemas**: "Table name" instead of "Table name to query (e.g., incident, task, sys_user)"
- **Metadata-driven discovery**: Use categories to find the right tool faster

### Context Savings:

| Scenario | Before v8.2.0 | After v8.2.0 | Savings |
|----------|---------------|--------------|---------|
| Simple CRUD | ~25,000 tokens | ~11,000 tokens | **56%** |
| Widget Dev | ~25,000 tokens | ~8,000 tokens | **68%** |
| UI Builder | ~25,000 tokens | ~10,000 tokens | **60%** |

---

## 🎓 LEARNING PATH BY COMPLEXITY

### Beginner Tools (Start Here!)

**Core Operations:**
- `snow_query_table` - Query any table
- `snow_create_record` - Create records
- `snow_update_record` - Update records

**Update Sets:**
- `snow_update_set_manage` - Manage Update Sets
- `snow_update_set_query` - Query Update Sets
- `snow_ensure_active_update_set` - Ensure active Update Set

### Intermediate Tools

**UI Frameworks:**
- `snow_create_uib_page` - Create UI Builder pages
- `snow_create_complete_workspace` - Create workspaces
- `snow_deploy` - Deploy widgets

**Automation:**
- `snow_execute_script_with_output` - Execute scripts
- `snow_execute_flow` - Run flows

### Advanced Tools

**Integration:**
- `snow_create_rest_message` - Create REST integrations
- `snow_create_transform_map` - Transform data

**ML & Analytics:**
- `snow_create_pi_solution` - Create Predictive Intelligence solutions
- `snow_train_pi_solution` - Train ML models

---

**Last Updated**: v8.2.0 (2025-10-21) - Breaking Changes: Update Set tool merging


---

## 📊 V8.2.0 FINAL STATISTICS

### Tools Optimized & Merged

**Total Tools:**
- Before v8.2.0: **411 tools**
- After v8.2.0: **397 tools**  
- **Reduction: 14 tools (-3.4%)**

**Merged Categories:**

1. **Update Set Tools: 9 → 3 (6 removed)**
   - Merged: create, switch, complete, export, preview, add_artifact, current, list
   - Into: `snow_update_set_manage`, `snow_update_set_query`
   - Kept: `snow_ensure_active_update_set`

2. **System Properties: 12 → 4 (8 removed)**
   - Merged: get, set, delete, validate, list, search, categories, bulk_get, bulk_set, import, export, history
   - Into: `snow_property_manage`, `snow_property_query`, `snow_property_bulk`, `snow_property_io`

### Description Optimization

**All 409 tools** received:
- ✅ Concise descriptions (verbose → compact)
- ✅ Metadata (category, subcategory, use_cases, complexity, frequency)
- ✅ Optimized property descriptions

**Estimated Token Savings:**
- Description compression: ~300 tokens
- Full optimization: **~10,000+ tokens** across all tools

### Migration Complexity

**Update Sets Migration:**
```javascript
// OLD: snow_update_set_create({ name, description })
// NEW: snow_update_set_manage({ action: 'create', name, description })
```
**Effort:** Very Low (add action parameter)

**System Properties Migration:**
```javascript
// OLD: snow_property_get({ name })
// NEW: snow_property_manage({ action: 'get', name })
```
**Effort:** Very Low (add action parameter)

---

