// Complete Snow-Flow MCP Tools Database
// 🏔️ 23 MCP Servers with 355+ Tools - v4.2.0 ENTERPRISE OPTIMIZED

const snowFlowTools = {
  "servicenow-deployment": {
    name: "🚀 Deployment Server",
    description: "Widget and artifact deployment with COHERENCE VALIDATION",
    badge: "10+ Tools",
    tools: [
      {
        name: "snow_create_artifact",
        description: "Universal artifact creation tool for ServiceNow. Create widgets, pages, scripts, business rules, and more with a unified interface. Features automatic ES5 validation and update set management.",
        highlight: "RECOMMENDED: Use for all artifact creation"
      },
      {
        name: "snow_update", 
        description: "Updates existing ServiceNow artifacts (widgets, applications, etc.). Finds artifact by name or sys_id and modifies it."
      },
      {
        name: "snow_delete",
        description: "Safely deletes ServiceNow artifacts with dependency checking and rollback capability."
      },
      {
        name: "snow_validate_deployment",
        description: "Validates deployment artifacts for compatibility, dependencies, and permissions before execution. Returns validation report with potential issues."
      },
      {
        name: "snow_rollback_deployment",
        description: "Performs safe rollback of a failed deployment to previous state. Tracks rollback history and provides recovery recommendations."
      },
      {
        name: "snow_preview_widget",
        description: "Preview widget functionality before deployment with live rendering."
      },
      {
        name: "snow_widget_test",
        description: "Test widget functionality with automated coherence validation."
      },
      {
        name: "snow_deployment_status",
        description: "Retrieves comprehensive deployment status including active deployments, recent history, success rates, and performance metrics."
      },
      {
        name: "snow_deployment_debug",
        description: "Provides detailed debugging information including authentication status, permissions, active sessions, and recent deployment logs for troubleshooting."
      }
    ]
  },

  "servicenow-operations": {
    name: "⚙️ Operations Server",
    description: "Core ServiceNow operations and queries",
    badge: "15+ Tools",
    tools: [
      {
        name: "snow_query_table",
        description: "Universal table querying with pagination. Supports complex queries, field selection, and relationship traversal."
      },
      {
        name: "snow_create_incident",
        description: "Create and manage incidents with full field support and workflow integration."
      },
      {
        name: "snow_update_record",
        description: "Update any table record with field validation and audit trail."
      },
      {
        name: "snow_delete_record",
        description: "Delete records with cascade checking and recovery options."
      },
      {
        name: "snow_discover_table_fields",
        description: "Discover table schema including field types, references, and constraints."
      },
      {
        name: "snow_cmdb_search",
        description: "Search Configuration Management Database with relationship mapping."
      },
      {
        name: "snow_user_lookup",
        description: "Find users and groups with role and permission details."
      },
      {
        name: "snow_operational_metrics",
        description: "Get real-time operational metrics and performance indicators."
      },
      {
        name: "snow_knowledge_search",
        description: "Search knowledge base with relevance ranking and categorization."
      }
    ]
  },

  "servicenow-automation": {
    name: "🤖 Automation Server",
    description: "Script execution and automation - ES5 ONLY!",
    badge: "20+ Tools",
    tools: [
      {
        name: "snow_execute_script_with_output",
        description: "Execute ES5 scripts with full output capture (gs.print/info/warn/error). Remember: NO arrow functions, const/let, or template literals!"
      },
      {
        name: "snow_execute_background_script",
        description: "Execute background scripts with optional autoConfirm. ES5 ONLY - use var, function(), and string concatenation.",
        highlight: "NEW: autoConfirm option"
      },
      {
        name: "snow_confirm_script_execution",
        description: "Confirm script execution after user approval with unique ID tracking."
      },
      {
        name: "snow_get_script_output",
        description: "Retrieve script execution history and output logs."
      },
      {
        name: "snow_execute_script_sync",
        description: "Synchronous script execution with timeout protection. ES5 only!"
      },
      {
        name: "snow_get_logs",
        description: "Access system logs with filtering and real-time streaming."
      },
      {
        name: "snow_test_rest_connection",
        description: "Test REST integrations with request/response debugging."
      },
      {
        name: "snow_trace_execution",
        description: "Trace script execution with performance metrics. ES5 compatible."
      },
      {
        name: "snow_schedule_job",
        description: "Create and manage scheduled jobs with cron syntax support."
      },
      {
        name: "snow_create_event",
        description: "Trigger system events for workflow and integration."
      }
    ]
  },

  "servicenow-platform-development": {
    name: "🛠️ Platform Development Server",
    description: "Platform development artifacts",
    badge: "12+ Tools",
    tools: [
      {
        name: "snow_create_script_include",
        description: "Create reusable server-side scripts with ES5 validation."
      },
      {
        name: "snow_create_business_rule",
        description: "Create business rules with condition builder and script validation."
      },
      {
        name: "snow_create_client_script",
        description: "Create client-side scripts with form integration."
      },
      {
        name: "snow_create_ui_policy",
        description: "Create UI policies for dynamic form behavior."
      },
      {
        name: "snow_create_ui_action",
        description: "Create UI actions for custom form buttons and menu items."
      },
      {
        name: "snow_create_ui_page",
        description: "Create UI pages with Jelly template support."
      }
    ]
  },

  "servicenow-integration": {
    name: "🔌 Integration Server",
    description: "Integration and data management",
    badge: "10+ Tools",
    tools: [
      {
        name: "snow_create_rest_message",
        description: "Create REST integrations with authentication and error handling."
      },
      {
        name: "snow_create_transform_map",
        description: "Create data transformation maps for import/export."
      },
      {
        name: "snow_create_import_set",
        description: "Manage import sets with field mapping and validation."
      },
      {
        name: "snow_test_web_service",
        description: "Test web services with request/response inspection."
      },
      {
        name: "snow_configure_email",
        description: "Configure email notifications and inbound processing."
      }
    ]
  },

  "servicenow-system-properties": {
    name: "📊 System Properties Server",
    description: "System property management",
    badge: "12 Tools",
    tools: [
      {
        name: "snow_property_get",
        description: "Retrieve system property values with type conversion."
      },
      {
        name: "snow_property_set",
        description: "Set system properties with validation and change tracking."
      },
      {
        name: "snow_property_list",
        description: "List properties by pattern with filtering and sorting."
      },
      {
        name: "snow_property_delete",
        description: "Remove properties with cascade and dependency checking."
      },
      {
        name: "snow_property_bulk_update",
        description: "Bulk property operations with transaction support."
      },
      {
        name: "snow_property_export",
        description: "Export properties to JSON for backup and migration."
      },
      {
        name: "snow_property_import",
        description: "Import properties from JSON with conflict resolution."
      }
    ]
  },

  "servicenow-update-set": {
    name: "📦 Update Set Server",
    description: "Change management and deployment",
    badge: "6 Tools",
    tools: [
      {
        name: "snow_update_set_create",
        description: "Create new update sets with proper scoping."
      },
      {
        name: "snow_update_set_switch",
        description: "Switch active update set for change tracking."
      },
      {
        name: "snow_update_set_complete",
        description: "Mark update set as complete with validation."
      },
      {
        name: "snow_update_set_export",
        description: "Export update set as XML for deployment."
      },
      {
        name: "snow_ensure_active_update_set",
        description: "Ensure an active update set exists before changes."
      }
    ]
  },

  "servicenow-development-assistant": {
    name: "🧠 Development Assistant Server",
    description: "Intelligent artifact search and management",
    badge: "8+ Tools",
    tools: [
      {
        name: "snow_find_artifact",
        description: "Find any ServiceNow artifact by name, type, or pattern."
      },
      {
        name: "snow_edit_artifact",
        description: "Edit existing artifacts with intelligent field mapping."
      },
      {
        name: "snow_get_by_sysid",
        description: "Get any artifact by sys_id with full metadata."
      },
      {
        name: "snow_analyze_artifact",
        description: "Analyze artifact structure and dependencies."
      },
      {
        name: "snow_comprehensive_search",
        description: "Deep search across all ServiceNow tables."
      },
      {
        name: "snow_analyze_requirements",
        description: "Analyze development requirements and suggest implementation."
      }
    ]
  },

  "servicenow-security-compliance": {
    name: "🔒 Security & Compliance Server",
    description: "Security and compliance management",
    badge: "10+ Tools",
    tools: [
      {
        name: "snow_create_security_policy",
        description: "Create security policies with compliance mapping."
      },
      {
        name: "snow_audit_compliance",
        description: "Audit for SOX, GDPR, HIPAA compliance requirements."
      },
      {
        name: "snow_scan_vulnerabilities",
        description: "Scan for security vulnerabilities and misconfigurations."
      },
      {
        name: "snow_review_access_control",
        description: "Review and validate ACL configurations."
      }
    ]
  },

  "servicenow-reporting-analytics": {
    name: "📈 Reporting & Analytics Server",
    description: "Reporting and data visualization",
    badge: "10+ Tools",
    tools: [
      {
        name: "snow_create_report",
        description: "Create reports with charts and scheduling."
      },
      {
        name: "snow_create_dashboard",
        description: "Create interactive dashboards with widgets."
      },
      {
        name: "snow_define_kpi",
        description: "Define KPIs with targets and thresholds."
      },
      {
        name: "snow_schedule_report",
        description: "Schedule report delivery via email or portal."
      },
      {
        name: "snow_analyze_data_quality",
        description: "Analyze data quality and integrity issues."
      }
    ]
  },

  "servicenow-machine-learning": {
    name: "🤖 Machine Learning Server",
    description: "AI/ML capabilities with TensorFlow.js",
    badge: "10+ Tools",
    tools: [
      {
        name: "ml_train_incident_classifier",
        description: "Train LSTM neural network for incident classification."
      },
      {
        name: "ml_predict_change_risk",
        description: "Predict change request risk levels using ML models."
      },
      {
        name: "ml_detect_anomalies",
        description: "Detect anomalies in metrics and patterns."
      },
      {
        name: "ml_forecast_incidents",
        description: "Time series forecasting for incident volumes."
      },
      {
        name: "ml_performance_analytics",
        description: "Native Performance Analytics ML integration."
      }
    ]
  },

  "servicenow-knowledge-catalog": {
    name: "📚 Knowledge & Catalog Server",
    description: "Knowledge base and service catalog management",
    badge: "15+ Tools",
    tools: [
      {
        name: "snow_create_knowledge_article",
        description: "Create knowledge articles with KB validation. Now prevents orphaned articles by validating knowledge base exists!",
        highlight: "v4.2.0: Enhanced enterprise validation"
      },
      {
        name: "snow_search_knowledge",
        description: "Search knowledge base with relevance scoring."
      },
      {
        name: "snow_create_catalog_item",
        description: "Create service catalog items with workflow."
      },
      {
        name: "snow_create_catalog_variable",
        description: "Create catalog variables in correct table (item_option_new). Enterprise optimization in v4.2.0!",
        highlight: "v4.2.0: Enterprise ready"
      },
      {
        name: "snow_create_catalog_ui_policy",
        description: "Create catalog UI policies with conditions and actions. Enterprise scale debugging in v4.2.0.",
        highlight: "v4.2.0: Enterprise debugging"
      },
      {
        name: "snow_order_catalog_item",
        description: "Order catalog items programmatically."
      },
      {
        name: "snow_discover_catalogs",
        description: "Discover available service catalogs."
      },
      {
        name: "snow_create_knowledge_base",
        description: "Create new knowledge bases with proper configuration."
      },
      {
        name: "snow_discover_knowledge_bases",
        description: "List all available knowledge bases."
      }
    ]
  },

  "servicenow-change-virtualagent-pa": {
    name: "🔄 Change, Virtual Agent & PA Server",
    description: "Change management, Virtual Agent, and Performance Analytics",
    badge: "15+ Tools",
    tools: [
      {
        name: "snow_create_change_request",
        description: "Create change requests with CAB integration."
      },
      {
        name: "snow_schedule_cab_meeting",
        description: "Schedule CAB meetings with member notifications."
      },
      {
        name: "snow_create_va_topic",
        description: "Create Virtual Agent conversation topics."
      },
      {
        name: "snow_send_va_message",
        description: "Send messages through Virtual Agent."
      },
      {
        name: "snow_create_pa_indicator",
        description: "Create Performance Analytics indicators."
      },
      {
        name: "snow_create_pa_widget",
        description: "Create PA dashboard widgets."
      },
      {
        name: "snow_get_pa_scores",
        description: "Retrieve performance scores and trends."
      }
    ]
  },

  "servicenow-flow-workspace-mobile": {
    name: "📱 Flow, Configurable Workspaces & Mobile + UI Builder Server",
    description: "Flow Designer, Configurable Agent Workspaces (UX Apps), Mobile management + COMPLETE UI Builder integration",
    badge: "27+ Tools",
    highlight: "🏗️ UX App Architecture + UI Builder",
    tools: [
      // Flow Designer Tools
      {
        name: "snow_list_flows",
        description: "List and discover Flow Designer flows with status and triggers."
      },
      {
        name: "snow_execute_flow", 
        description: "Execute flows programmatically with input data and completion monitoring."
      },
      {
        name: "snow_get_flow_execution_status",
        description: "Monitor flow execution status, logs, and variable values."
      },
      {
        name: "snow_get_flow_execution_history",
        description: "View comprehensive flow execution history with statistics."
      },
      {
        name: "snow_get_flow_details",
        description: "Get detailed flow configuration, actions, and triggers."
      },
      {
        name: "snow_import_flow_from_xml",
        description: "Import flows from XML (only programmatic creation method)."
      },
      
      // 🏗️ COMPLETE UX WORKSPACE CREATION (6-Step Workflow)
      {
        name: "snow_create_complete_workspace",
        description: "Create Complete UX Workspace - Executes all 6 steps automatically: Experience → App Config → Page Macroponent → Page Registry → Route → Landing Page Route. Creates fully functional workspace.",
        highlight: "🎆 COMPLETE WORKFLOW"
      },
      {
        name: "snow_create_ux_experience",
        description: "STEP 1: Create UX Experience Record (sys_ux_experience) - The top-level container for the workspace.",
        highlight: "🏗️ Step 1"
      },
      {
        name: "snow_create_ux_app_config",
        description: "STEP 2: Create UX App Configuration Record (sys_ux_app_config) - Contains workspace settings and links to experience.",
        highlight: "🏗️ Step 2"
      },
      {
        name: "snow_create_ux_page_macroponent",
        description: "STEP 3: Create Page Macroponent Record (sys_ux_macroponent) - Defines actual page content to be displayed.",
        highlight: "🏗️ Step 3"
      },
      {
        name: "snow_create_ux_page_registry",
        description: "STEP 4: Create Page Registry Record (sys_ux_page_registry) - Registers page for use within workspace configuration.",
        highlight: "🏗️ Step 4"
      },
      {
        name: "snow_create_ux_app_route",
        description: "STEP 5: Create Route Record (sys_ux_app_route) - Defines URL slug that leads to the page.",
        highlight: "🏗️ Step 5"
      },
      {
        name: "snow_update_ux_app_config_landing_page",
        description: "STEP 6: Update App Configuration with Landing Page Route - Sets default landing page for workspace.",
        highlight: "🏗️ Step 6"
      },

      // Mobile App Tools
      {
        name: "snow_configure_mobile_app",
        description: "Configure mobile application settings and features."
      },
      {
        name: "snow_send_push_notification",
        description: "Send push notifications to mobile devices for users or roles."
      },
      {
        name: "snow_configure_offline_sync",
        description: "Configure offline data synchronization for mobile applications."
      },

      // 🆕 UI BUILDER TOOLS (15 NEW!) - Complete Now Experience Framework
      {
        name: "snow_create_uib_page",
        description: "Create UI Builder pages in Now Experience Framework with automatic routing using sys_ux_page API.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_update_uib_page", 
        description: "Update UI Builder page configuration, theme, and layout settings.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_delete_uib_page",
        description: "Safely delete UI Builder pages with comprehensive dependency validation.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_discover_uib_pages",
        description: "Discover all UI Builder pages with advanced filtering and relationship analysis.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_create_uib_component",
        description: "Create custom UI Builder components using sys_ux_lib_component API with source code management.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_update_uib_component",
        description: "Update UI Builder component definitions, source code, and properties schema.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_discover_uib_components", 
        description: "Browse UI Builder component library including ServiceNow built-in and custom components.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_clone_uib_component",
        description: "Clone and modify existing UI Builder components for customization.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_create_uib_data_broker",
        description: "Create UI Builder data brokers for connecting ServiceNow data sources using sys_ux_data_broker API.", 
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_configure_uib_data_broker",
        description: "Configure UI Builder data broker queries, caching, and refresh settings.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_add_uib_page_element",
        description: "Add component elements to UI Builder pages with full layout control using sys_ux_page_element API.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_update_uib_page_element",
        description: "Update UI Builder page element properties, positioning, and data binding.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_remove_uib_page_element", 
        description: "Remove UI Builder page elements with dependency validation and cleanup.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_create_uib_page_registry",
        description: "Create URL routing configuration for UI Builder pages using sys_ux_page_registry API.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_discover_uib_routes",
        description: "Discover all UI Builder page routes with security and parameter information.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_create_uib_client_script",
        description: "Create client-side scripts for UI Builder pages using sys_ux_client_script API.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_create_uib_client_state",
        description: "Create client state management for UI Builder pages using sys_ux_client_state API.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_create_uib_event",
        description: "Create custom events for UI Builder components using sys_ux_event API.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_analyze_uib_page_performance", 
        description: "Analyze UI Builder page performance with optimization recommendations.",
        highlight: "🆵 UI Builder"
      },
      {
        name: "snow_validate_uib_page_structure",
        description: "Validate UI Builder page structure, dependencies, and best practices.",
        highlight: "🆕 UI Builder"
      },
      {
        name: "snow_discover_uib_page_usage",
        description: "Analyze UI Builder page usage patterns and complexity scoring.",
        highlight: "🆕 UI Builder"
      }
    ]
  },

  "servicenow-cmdb-event-hr-csm-devops": {
    name: "🏢 CMDB, Event, HR, CSM & DevOps Server",
    description: "CMDB management, Event processing, HR services, Customer Service, and DevOps",
    badge: "20+ Tools",
    tools: [
      {
        name: "snow_create_ci",
        description: "Create Configuration Items with relationship mapping."
      },
      {
        name: "snow_create_ci_relationship",
        description: "Create relationships between CIs."
      },
      {
        name: "snow_run_discovery",
        description: "Run discovery for infrastructure mapping."
      },
      {
        name: "snow_create_event",
        description: "Create events for correlation and alerting."
      },
      {
        name: "snow_create_hr_case",
        description: "Create HR service cases with workflow."
      },
      {
        name: "snow_employee_onboarding",
        description: "Manage employee onboarding process."
      },
      {
        name: "snow_create_customer_case",
        description: "Create customer service cases."
      },
      {
        name: "snow_create_devops_pipeline",
        description: "Create and manage DevOps pipelines."
      }
    ]
  },

  "servicenow-advanced-features": {
    name: "⚡ Advanced Features Server",
    description: "Advanced optimization and analysis capabilities",
    badge: "15+ Tools",
    tools: [
      {
        name: "snow_batch_api",
        description: "Batch API operations for 80% performance improvement."
      },
      {
        name: "snow_get_table_relationships",
        description: "Analyze table relationships and dependencies."
      },
      {
        name: "snow_analyze_query",
        description: "Optimize queries for better performance."
      },
      {
        name: "snow_detect_code_patterns",
        description: "Detect code patterns and anti-patterns."
      },
      {
        name: "snow_discover_process",
        description: "Discover business processes from data."
      },
      {
        name: "snow_generate_documentation",
        description: "Auto-generate technical documentation."
      }
    ]
  },

  "servicenow-local-development": {
    name: "💻 Local Development Server",
    description: "Bridge between ServiceNow and Claude Code native tools",
    badge: "10+ Tools",
    tools: [
      {
        name: "snow_pull_artifact",
        description: "Pull ServiceNow artifacts to local files for native editing. Supports widgets, flows, scripts, and more!",
        highlight: "Use for large widgets!"
      },
      {
        name: "snow_push_artifact",
        description: "Push local changes back to ServiceNow with validation."
      },
      {
        name: "snow_validate_artifact_coherence",
        description: "Validate widget coherence between HTML, client, and server scripts."
      },
      {
        name: "snow_list_supported_artifacts",
        description: "List all supported artifact types for local sync."
      },
      {
        name: "snow_sync_status",
        description: "Check sync status of local artifacts."
      },
      {
        name: "snow_sync_cleanup",
        description: "Clean up local files after sync operations."
      },
      {
        name: "snow_convert_to_es5",
        description: "Convert modern JavaScript to ES5 for ServiceNow compatibility."
      }
    ]
  },

  "snow-flow-orchestration": {
    name: "🎯 Snow-Flow Orchestration Server",
    description: "Multi-agent coordination and task management",
    badge: "8 Tools",
    tools: [
      {
        name: "agent_init",
        description: "Initialize multi-agent orchestration for complex tasks."
      },
      {
        name: "agent_spawn",
        description: "Create specialized AI agents (researcher, coder, analyst)."
      },
      {
        name: "task_orchestrate",
        description: "Orchestrate complex multi-step tasks."
      },
      {
        name: "memory_search",
        description: "Search persistent memory across sessions."
      },
      {
        name: "neural_train",
        description: "Train neural networks using TensorFlow.js."
      },
      {
        name: "performance_report",
        description: "Generate comprehensive performance reports."
      }
    ]
  },

  // ===== NEW ENTERPRISE MCP SERVERS (v4.2.0) =====
  
  "servicenow-itam": {
    name: "🏢 IT Asset Management",
    description: "Complete enterprise asset lifecycle management with license optimization and compliance reporting",
    badge: "6 Enterprise Tools",
    highlight: "NEW in v4.2.0",
    tools: [
      {
        name: "snow_create_asset",
        description: "Create IT asset with full lifecycle tracking, warranty management, and financial controls. Supports asset tags, locations, assignments, and automated audit trails.",
        highlight: "Enterprise ITAM"
      },
      {
        name: "snow_manage_software_license",
        description: "Complete software license management with compliance tracking, usage optimization, cost analysis, and automatic renewal management.",
        highlight: "License Optimization"
      },
      {
        name: "snow_track_asset_lifecycle",
        description: "Track complete asset lifecycle from procurement through disposal with automated state transitions and compliance reporting.",
        highlight: "Lifecycle Automation"
      },
      {
        name: "snow_asset_compliance_report",
        description: "Generate comprehensive asset compliance reports for auditing with warranty tracking, cost analysis, and optimization recommendations.",
        highlight: "Compliance Reporting"
      },
      {
        name: "snow_optimize_licenses",
        description: "AI-powered license usage analysis with cost optimization recommendations, usage efficiency scoring, and potential savings calculations.",
        highlight: "AI Cost Optimization"
      },
      {
        name: "snow_asset_discovery",
        description: "Automated asset discovery from multiple sources with duplicate normalization, relationship creation, and CMDB integration.",
        highlight: "Discovery Automation"
      }
    ]
  },

  "servicenow-secops": {
    name: "🛡️ Security Operations",
    description: "Advanced security incident response with threat intelligence and automated SOAR capabilities",
    badge: "6 Security Tools",
    highlight: "NEW in v4.2.0",
    tools: [
      {
        name: "snow_create_security_incident",
        description: "Create security incidents with automated threat correlation, IOC processing, affected system linking, and priority assignment based on threat intelligence.",
        highlight: "Automated Threat Response"
      },
      {
        name: "snow_analyze_threat_intelligence",
        description: "Analyze and correlate threat intelligence with organizational security posture, IOC enrichment, and risk scoring with confidence intervals.",
        highlight: "Threat Intelligence"
      },
      {
        name: "snow_execute_security_playbook",
        description: "Execute automated security response playbooks with orchestrated containment, eradication, and recovery actions.",
        highlight: "SOAR Automation"
      },
      {
        name: "snow_vulnerability_risk_assessment",
        description: "Automated vulnerability risk assessment with CVSS scoring, business context analysis, and remediation prioritization.",
        highlight: "Risk Assessment"
      },
      {
        name: "snow_security_dashboard",
        description: "Real-time security operations dashboard with executive, analyst, incident response, and compliance views with trend analysis.",
        highlight: "Real-time SOC"
      },
      {
        name: "snow_automate_threat_response",
        description: "Fully automated threat response with containment, isolation, eradication, and recovery phases with notification orchestration.",
        highlight: "Automated Response"
      }
    ]
  },

  "servicenow-notifications": {
    name: "📨 Notification Framework",
    description: "Enterprise multi-channel notification system with templates, analytics, and preference management",
    badge: "6 Communication Tools",
    highlight: "NEW in v4.2.0",
    tools: [
      {
        name: "snow_send_notification",
        description: "Send multi-channel notifications (email, SMS, push, Slack, Teams) with template support, personalization, and delivery tracking.",
        highlight: "Multi-channel Messaging"
      },
      {
        name: "snow_create_notification_template",
        description: "Create reusable notification templates with variable substitution, multi-channel support, and automated formatting.",
        highlight: "Template Engine"
      },
      {
        name: "snow_notification_preferences",
        description: "Manage user notification preferences, quiet hours, escalation channels, and routing rules with granular control.",
        highlight: "Preference Management"
      },
      {
        name: "snow_emergency_broadcast",
        description: "Send emergency broadcast notifications with preference override, acknowledgment tracking, and targeted audience selection.",
        highlight: "Emergency Broadcasting"
      },
      {
        name: "snow_notification_analytics",
        description: "Analyze notification delivery rates, engagement metrics, channel effectiveness, and template performance with insights.",
        highlight: "Delivery Analytics"
      },
      {
        name: "snow_schedule_notification",
        description: "Schedule future notifications with advanced scheduling options, recurrence patterns, and conditional delivery triggers.",
        highlight: "Scheduled Delivery"
      }
    ]
  }
};

// Function to search tools
function searchTools(query) {
  const results = [];
  const searchTerm = query.toLowerCase();
  
  Object.entries(snowFlowTools).forEach(([serverId, server]) => {
    server.tools.forEach(tool => {
      if (tool.name.toLowerCase().includes(searchTerm) || 
          tool.description.toLowerCase().includes(searchTerm)) {
        results.push({
          server: server.name,
          serverId: serverId,
          tool: tool
        });
      }
    });
  });
  
  return results;
}

// Function to get all tools count
function getTotalToolsCount() {
  let count = 0;
  Object.values(snowFlowTools).forEach(server => {
    count += server.tools.length;
  });
  return count;
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { snowFlowTools, searchTools, getTotalToolsCount };
}