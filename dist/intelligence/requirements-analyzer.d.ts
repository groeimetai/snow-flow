/**
 * Requirements Analyzer - Intelligent Gap Analysis Engine
 *
 * Analyzes objectives to identify ALL required ServiceNow components,
 * not just what MCP tools can handle.
 */
export interface ServiceNowRequirement {
    id: string;
    type: RequirementType;
    name: string;
    description: string;
    priority: 'high' | 'medium' | 'low';
    dependencies: string[];
    estimatedEffort: 'low' | 'medium' | 'high';
    automatable: boolean;
    mcpCoverage: boolean;
    category: RequirementCategory;
    specificSteps?: string[];
    validationCriteria?: string[];
    riskLevel: 'low' | 'medium' | 'high';
}
export type RequirementType = 'widget' | 'flow' | 'business_rule' | 'script_include' | 'table' | 'application' | 'user_role' | 'acl_rule' | 'oauth_provider' | 'sso_config' | 'data_policy' | 'security_policy' | 'audit_rule' | 'encryption_context' | 'saml_config' | 'mfa_config' | 'import_set' | 'transform_map' | 'field_map' | 'web_service' | 'rest_message' | 'email_config' | 'ldap_config' | 'database_view' | 'database_index' | 'soap_message' | 'import_set_transformer' | 'coremeta_data' | 'ldap_server' | 'ui_action' | 'ui_policy' | 'ui_page' | 'ui_macro' | 'ui_script' | 'client_script' | 'css_include' | 'navigator_module' | 'homepage' | 'form_layout' | 'form_section' | 'list_layout' | 'related_list' | 'formatter' | 'application_menu' | 'module_navigation' | 'workflow' | 'scheduled_job' | 'event_rule' | 'notification' | 'email_template' | 'sla_definition' | 'escalation_rule' | 'approval_rule' | 'state_flow' | 'workflow_activity' | 'workflow_transition' | 'approval_definition' | 'approval_workflow' | 'notification_rule' | 'scheduled_task' | 'event_registration' | 'dictionary_entry' | 'choice_list' | 'ui_formatter' | 'display_value' | 'reference_qualifier' | 'data_lookup' | 'sys_property' | 'system_setting' | 'system_property' | 'system_definition' | 'theme_configuration' | 'branding_config' | 'table_rotation' | 'partitioning_config' | 'cache_configuration' | 'report' | 'dashboard' | 'metric' | 'kpi' | 'scheduled_report' | 'data_source' | 'gauge' | 'chart_configuration' | 'dashboard_tab' | 'performance_analytics' | 'metric_definition' | 'job_queue' | 'transaction_quota' | 'incident_table' | 'incident__analysis' | 'query_rule' | 'catalog_item' | 'catalog_category' | 'catalog_variable' | 'workflow_integration' | 'user_account' | 'user_group' | 'group_membership' | 'integration_endpoint' | 'update_set' | 'probe' | 'sensor' | 'discovery_rule' | 'cmdb_identification' | 'orchestration_workflow' | 'runbook' | 'knowledge_article' | 'inbound_email_action' | 'processor' | 'pdf_generator' | 'sys_script_validator' | 'mobile_app_config' | 'service_portal_config' | 'portal_widget' | 'portal_page' | 'portal_theme' | 'mobile_ui_policy';
export type RequirementCategory = 'core_development' | 'security_compliance' | 'data_integration' | 'user_interface' | 'process_automation' | 'system_configuration' | 'reporting_analytics' | 'mobile_portal' | 'monitoring_operations';
export interface ObjectiveAnalysis {
    objective: string;
    requirements: ServiceNowRequirement[];
    totalRequirements: number;
    mcpCoveredCount: number;
    gapCount: number;
    mcpCoveragePercentage: number;
    estimatedComplexity: 'low' | 'medium' | 'high' | 'enterprise';
    riskAssessment: 'low' | 'medium' | 'high';
    categories: RequirementCategory[];
    criticalPath: string[];
    estimatedDuration: string;
}
export declare class RequirementsAnalyzer {
    private static readonly OBJECTIVE_PATTERNS;
    private static readonly REQUIREMENT_DEFINITIONS;
    /**
     * Analyze an objective and identify all required ServiceNow components
     */
    static analyzeObjective(objective: string): ObjectiveAnalysis;
    private static identifyRequirements;
    private static createRequirement;
    private static addCoreRequirements;
    private static addRequirementIfMissing;
    private static addImpliedRequirements;
    private static generateRequirementName;
    private static calculatePriority;
    private static generateSpecificSteps;
    private static generateValidationCriteria;
    private static sortRequirements;
    private static calculateComplexity;
    private static assessRisk;
    private static calculateCriticalPath;
    private static estimateDuration;
}
//# sourceMappingURL=requirements-analyzer.d.ts.map