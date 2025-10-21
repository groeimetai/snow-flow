"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLAUDE_MD_TEMPLATE_VERSION = exports.CLAUDE_MD_TEMPLATE = void 0;
exports.CLAUDE_MD_TEMPLATE = `# Snow-Flow ServiceNow Development Framework

## 🚨 ABSOLUTE RULES - NO EXCEPTIONS

### 🔴 CRITICAL: Widget Debugging MUST Use Local Sync!

**When user reports ANY widget issue, ALWAYS use:**
\`\`\`
snow_pull_artifact({ sys_id: 'widget_sys_id' })
\`\`\`

**NEVER use snow_query_table for widgets!** It will hit token limits and you can't use native tools.

**Common scenarios requiring snow_pull_artifact:**
- "Widget skips questions" → snow_pull_artifact
- "Form doesn't submit" → snow_pull_artifact  
- "Data not displaying" → snow_pull_artifact
- "Button doesn't work" → snow_pull_artifact
- "Debug this widget" → snow_pull_artifact
- "Fix widget issue" → snow_pull_artifact
- Widget script > 1000 chars → snow_pull_artifact

### Rule #1: NO MOCK DATA - EVERYTHING REAL & COMPLETE
**FORBIDDEN:** Mock data, placeholders, TODOs, stub implementations, test values, simulations, "this would normally...", partial implementations.
**REQUIRED:** Complete, production-ready, fully functional code. Take time to implement EVERYTHING properly. Real integrations, comprehensive error handling, full validation.

### Rule #2: ES5 ONLY - ServiceNow Rhino Engine
**NEVER USE:** const/let, arrow functions =>, template literals \`\${}\`, destructuring, for...of, default parameters, classes
**ALWAYS USE:** var, function(){}, string concatenation +, traditional for loops, typeof checks

### Rule #3: VERIFY FIRST - Never Assume
Test before claiming broken. Check resources exist. Validate configurations. Evidence-based fixes only.

## 📋 MCP SERVERS & TOOLS (18 Servers, 200+ Tools)

### 1. **servicenow-local-development** 🔧 Widget/Artifact Sync [USE THIS FOR WIDGETS!]
\`\`\`
snow_pull_artifact - Pull ANY artifact to local files (ALWAYS use for widgets!)
snow_push_artifact - Push local changes back to ServiceNow  
snow_cleanup_artifacts - Clean local artifact cache
snow_get_sync_status - Check artifact sync status
snow_list_local_artifacts - List all pulled artifacts
\`\`\`
**⚠️ CRITICAL: For ANY widget work, use snow_pull_artifact FIRST, not snow_query_table!**

### 2. **servicenow-deployment** 🚀 Complete Deployment System
\`\`\`
snow_deploy - Create NEW artifacts (widgets, flows, scripts, pages)
snow_update - UPDATE existing artifacts directly
snow_validate_deployment - Validate before deploy
snow_rollback_deployment - Rollback failed deployments
snow_preview_widget - Preview widget rendering
snow_widget_test - Test widget functionality
snow_deployment_history - View deployment history
snow_check_widget_coherence - Validate HTML/Client/Server communication
\`\`\`

### 3. **servicenow-operations** 📊 Core Operations
\`\`\`
snow_query_table - Universal table query (NOT for widgets - use snow_pull_artifact!)
snow_query_incidents - Query and analyze incidents
snow_analyze_incident - AI-powered incident analysis
snow_auto_resolve_incident - Automated resolution
snow_cmdb_search - Configuration database search
snow_user_lookup - Find users and groups
snow_operational_metrics - Performance metrics
snow_knowledge_search - Search knowledge base
snow_catalog_item_manager - Manage service catalog
\`\`\`

### 4. **servicenow-automation** ⚙️ Scripts & Automation
\`\`\`
snow_execute_background_script - Run ES5 scripts (autoConfirm available)
snow_execute_script_with_output - Execute with output capture
snow_execute_script_sync - Synchronous execution
snow_get_script_output - Retrieve script results
snow_schedule_job - Create scheduled jobs
snow_create_event - Trigger system events
snow_get_logs - Access system logs
snow_test_rest_connection - Test REST endpoints
snow_trace_execution - Performance tracing
\`\`\`

### 5. **servicenow-platform-development** 🏗️ Development Artifacts
\`\`\`
snow_create_ui_page - Create UI pages
snow_create_script_include - Reusable scripts
snow_create_business_rule - Business rules
snow_create_client_script - Client-side scripts
snow_create_ui_policy - UI policies
snow_create_ui_action - UI actions
snow_create_acl - Access controls
snow_create_ui_macro - UI macros
\`\`\`

### 6. **servicenow-integration** 🔌 Integrations
\`\`\`
snow_create_rest_message - REST integrations
snow_create_soap_message - SOAP integrations
snow_create_transform_map - Data transformation
snow_create_import_set - Import management
snow_test_web_service - Test services
snow_configure_email - Email configuration
snow_create_data_source - Data sources
\`\`\`

### 7. **servicenow-system-properties** ⚙️ Properties
\`\`\`
snow_property_get - Get property value
snow_property_set - Set property value
snow_property_list - List by pattern
snow_property_bulk_update - Bulk operations
snow_property_export/import - Export/Import JSON
snow_property_validate - Validate properties
\`\`\`

### 8. **servicenow-update-set** 📦 Change Management
\`\`\`
snow_update_set_create - Create update set
snow_update_set_switch - Switch active set
snow_update_set_complete - Mark complete
snow_update_set_export - Export as XML
snow_update_set_preview - Preview changes
snow_ensure_active_update_set - Auto-create if needed
\`\`\`

### 9. **servicenow-development-assistant** 🤖 AI Assistant
\`\`\`
snow_find_artifact - Find any artifact by name/type
snow_edit_artifact - Edit existing artifacts
snow_analyze_artifact - Analyze dependencies
snow_comprehensive_search - Deep search all tables
snow_analyze_requirements - Requirement analysis
snow_generate_code - Pattern-based generation
snow_optimize_script - Performance optimization
\`\`\`

### 10. **servicenow-security-compliance** 🛡️ Security
\`\`\`
snow_create_security_policy - Security policies
snow_audit_compliance - SOX/GDPR/HIPAA audit
snow_scan_vulnerabilities - Vulnerability scan
snow_assess_risk - Risk assessment
snow_review_access_control - ACL review
snow_encrypt_field - Field encryption
snow_audit_trail_analysis - Audit analysis
\`\`\`

### 11. **servicenow-reporting-analytics** 📈 Reporting
\`\`\`
snow_create_report - Create reports
snow_create_dashboard - Build dashboards
snow_define_kpi - Define KPIs
snow_schedule_report - Schedule delivery
snow_analyze_data_quality - Data quality
snow_create_pa_widget - Performance analytics
\`\`\`

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

\`\`\`
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
\`\`\`

### 13. **servicenow-change-virtualagent-pa** 🔄 Change & Virtual Agent
\`\`\`
snow_create_change_request - Change requests
snow_assess_change_risk - Risk assessment
snow_create_nlu_model - NLU models
snow_train_virtual_agent - Train VA
snow_configure_conversation - VA conversations
snow_analyze_pa_trends - Performance trends
\`\`\`

### 14. **servicenow-cmdb-event-hr-csm-devops** 🏢 Enterprise
\`\`\`
snow_manage_ci - Configuration items
snow_correlate_events - Event correlation
snow_manage_hr_case - HR cases
snow_csm_project - Customer projects
snow_devops_pipeline - CI/CD pipelines
snow_manage_cmdb_relationships - CI relationships
\`\`\`

### 15. **servicenow-knowledge-catalog** 📚 Knowledge & Catalog (v3.6.10 Corrected!)
\`\`\`
snow_create_knowledge_article - KB articles
snow_create_catalog_item - Catalog items
snow_create_catalog_variable - Variable sets
snow_create_catalog_ui_policy - CORRECTED: Creates in 2 tables (conditions as string, actions as records)
snow_order_catalog_item - Order catalog items
snow_discover_catalogs - Discover available catalogs
\`\`\`
**✅ Corrected UI Policy (v3.6.10):** Conditions stored as query string in catalog_conditions field. Actions created in catalog_ui_policy_action table. Based on actual ServiceNow structure!

### 16. **servicenow-flow-workspace-mobile** 📱 Modern UX + UI Builder
\`\`\`
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
\`\`\`

### 17. **servicenow-advanced-features** 🎯 Advanced
\`\`\`
snow_performance_optimization - Optimize instance
snow_batch_operations - Bulk processing
snow_instance_scan - Health check
snow_dependency_analysis - Dependencies
snow_code_search - Search all code
\`\`\`

### 18. **snow-flow** 🎛️ Orchestration
\`\`\`
swarm_init - Initialize agent swarms
agent_spawn - Create specialized agents
task_orchestrate - Complex task coordination
memory_search - Search persistent memory
neural_train - Train neural networks
\`\`\`

## 🔄 Critical Workflows

### Widget Debugging (ALWAYS use Local Sync!)
\`\`\`javascript
// ✅ CORRECT - Local sync for debugging
await snow_pull_artifact({ sys_id: 'widget_sys_id' });
// Edit with native tools (search, multi-file, etc.)
await snow_push_artifact({ sys_id: 'widget_sys_id' });

// ❌ WRONG - Token limit explosion
await snow_query_table({ table: 'sp_widget', query: 'sys_id=...' });
\`\`\`

### Verification Pattern
\`\`\`javascript
// Always verify with REAL data, not placeholders
await snow_execute_script_with_output({
  script: \`
    var gr = new GlideRecord('incident');
    gr.addQuery('active', true);
    gr.query();
    gs.info('Found: ' + gr.getRowCount() + ' active incidents');
    
    // Test actual property
    var prop = gs.getProperty('instance_name');
    gs.info('Instance: ' + prop);
  \`
});
\`\`\`

### Complete Widget Creation (NO PLACEHOLDERS)
\`\`\`javascript
await snow_deploy({
  type: 'widget',
  config: {
    name: 'my_widget',
    title: 'Production Widget',
    template: '<div ng-repeat="item in data.items">{{item.name}}</div>',
    script: \`
      (function() {
        data.items = [];
        var gr = new GlideRecord('incident');
        gr.addQuery('active', true);
        gr.setLimit(10);
        gr.query();
        while (gr.next()) {
          data.items.push({
            name: gr.getDisplayValue('number'),
            description: gr.getDisplayValue('short_description')
          });
        }
      })();
    \`,
    client_script: \`
      function($scope) {
        var c = this;
        c.refresh = function() {
          c.server.get().then(function(r) {
            console.log('Refreshed');
          });
        };
      }
    \`
  }
});
\`\`\`

### Catalog UI Policy (v3.6.10 Corrected)
\`\`\`javascript
await snow_create_catalog_ui_policy({
  cat_item: 'catalog_item_sys_id',
  short_description: 'Dynamic Field Control',
  // Conditions converted to ServiceNow query string format
  conditions: [
    {
      catalog_variable: 'user_type',  // Can use name or sys_id
      operation: 'is',  // or 'is not', 'contains', 'is empty', etc.
      value: 'employee',
      and_or: 'AND'  // Connect with AND or OR
    },
    {
      catalog_variable: 'department',
      operation: 'is not empty',
      value: ''
    }
  ],
  // Actions still create separate records
  actions: [
    {
      catalog_variable: 'manager_approval',
      visible: true,
      mandatory: true
    },
    {
      catalog_variable: 'cost_center',
      mandatory: true
    }
  ]
});
// Creates policy with conditions as query string in catalog_conditions field
// Actions created as separate records in catalog_ui_policy_action table
\`\`\`

## ⚡ Command Reference

### Core Commands
- \`snow-flow init\` - Initialize project with this CLAUDE.md
- \`snow-flow auth login\` - Authenticate with ServiceNow
- \`snow-flow status\` - System status
- \`snow-flow swarm "<task>"\` - Multi-agent coordination

### Development Flow
1. **Pull artifact**: \`snow_pull_artifact\` for local editing
2. **Edit locally**: Use Claude's native search/edit tools
3. **Push changes**: \`snow_push_artifact\` to ServiceNow
4. **Test**: \`snow_execute_script_with_output\` with REAL code
5. **Deploy**: \`snow_update_set_complete\` when ready

## 🎯 Golden Rules

1. **NO MOCK DATA** - Everything real, complete, production-ready
2. **ES5 ONLY** - var, function(){}, no modern JS
3. **VERIFY FIRST** - Test before assuming
4. **LOCAL SYNC** - Use snow_pull_artifact for widgets
5. **COMPLETE CODE** - No TODOs, no placeholders
6. **TOKEN AWARE** - Use batch operations
7. **UPDATE SETS** - Track all changes

## 📊 Quick Reference

| Issue | Solution |
|-------|----------|
| Widget doesn't work | \`snow_pull_artifact\` → debug locally |
| Script syntax error | ES5 only! var, function(){} |
| Can't find table | \`snow_discover_table_fields\` |
| Property missing | \`snow_property_manager\` |
| Need to test | \`snow_execute_script_with_output\` |
| Deployment failed | \`snow_rollback_deployment\` |

Remember: TAKE THE TIME. DO IT RIGHT. NO MOCK DATA. NO EXCEPTIONS.`;
exports.CLAUDE_MD_TEMPLATE_VERSION = '3.6.2-CONSOLIDATED';
//# sourceMappingURL=claude-md-template.js.map