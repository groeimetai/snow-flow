export const CLAUDE_MD_TEMPLATE = `# Snow-Flow ServiceNow Development Framework

## 🚨 ABSOLUTE RULES - NO EXCEPTIONS

### Rule #1: NO MOCK DATA - EVERYTHING REAL & COMPLETE
**FORBIDDEN:** Mock data, placeholders, TODOs, stub implementations, test values, simulations, "this would normally...", partial implementations.
**REQUIRED:** Complete, production-ready, fully functional code. Take time to implement EVERYTHING properly. Real integrations, comprehensive error handling, full validation.

### Rule #2: ES5 ONLY - ServiceNow Rhino Engine
**NEVER USE:** const/let, arrow functions =>, template literals \`\${}\`, destructuring, for...of, default parameters, classes
**ALWAYS USE:** var, function(){}, string concatenation +, traditional for loops, typeof checks

### Rule #3: VERIFY FIRST - Never Assume
Test before claiming broken. Check resources exist. Validate configurations. Evidence-based fixes only.

## 📋 MCP SERVERS & TOOLS (18 Servers, 200+ Tools)

### 1. **servicenow-local-development** 🔧 Widget/Artifact Sync
\`\`\`
snow_pull_artifact - Pull ANY artifact to local files for native editing
snow_push_artifact - Push local changes back to ServiceNow  
snow_cleanup_artifacts - Clean local artifact cache
snow_get_sync_status - Check artifact sync status
snow_list_local_artifacts - List all pulled artifacts
\`\`\`

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
snow_query_table - Universal table query with pagination
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

### 12. **servicenow-machine-learning** 🧠 AI/ML
\`\`\`
ml_train_incident_classifier - Train LSTM classifier
ml_predict_change_risk - Risk prediction
ml_detect_anomalies - Anomaly detection
ml_forecast_incidents - Time series forecast
ml_cluster_similar - Similarity clustering
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

### 15. **servicenow-knowledge-catalog** 📚 Knowledge & Catalog
\`\`\`
snow_create_knowledge_article - KB articles
snow_manage_catalog_item - Catalog items
snow_configure_variables - Variable sets
snow_create_catalog_policy - Catalog policies
snow_manage_categories - Categories
\`\`\`

### 16. **servicenow-flow-workspace-mobile** 📱 Modern UX
\`\`\`
snow_create_flow - Flow Designer flows
snow_add_flow_action - Flow actions
snow_create_workspace - Workspace config
snow_configure_mobile_app - Mobile apps
snow_configure_offline_sync - Offline mode
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

export const CLAUDE_MD_TEMPLATE_VERSION = '3.6.2-CONSOLIDATED';