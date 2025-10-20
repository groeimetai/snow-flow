"use strict";
/**
 * Requirements Analyzer - Intelligent Gap Analysis Engine
 *
 * Analyzes objectives to identify ALL required ServiceNow components,
 * not just what MCP tools can handle.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequirementsAnalyzer = void 0;
const logger_1 = require("../utils/logger");
class RequirementsAnalyzer {
    /**
     * Analyze an objective and identify all required ServiceNow components
     */
    static analyzeObjective(objective) {
        logger_1.logger.info(`🔍 Analyzing objective: ${objective}`);
        const requirements = this.identifyRequirements(objective);
        const mcpCoveredCount = requirements.filter(r => r.mcpCoverage).length;
        const gapCount = requirements.length - mcpCoveredCount;
        const mcpCoveragePercentage = Math.round((mcpCoveredCount / requirements.length) * 100);
        const categories = [...new Set(requirements.map(r => r.category))];
        const estimatedComplexity = this.calculateComplexity(requirements);
        const riskAssessment = this.assessRisk(requirements);
        const criticalPath = this.calculateCriticalPath(requirements);
        const estimatedDuration = this.estimateDuration(requirements);
        const _analysis = {
            objective,
            requirements,
            totalRequirements: requirements.length,
            mcpCoveredCount,
            gapCount,
            mcpCoveragePercentage,
            estimatedComplexity,
            riskAssessment,
            categories,
            criticalPath,
            estimatedDuration
        };
        logger_1.logger.info(`📊 Analysis complete: ${requirements.length} requirements, ${gapCount} gaps (${100 - mcpCoveragePercentage}% coverage gap)`);
        return _analysis;
    }
    static identifyRequirements(objective) {
        const requirements = [];
        const objectiveLower = objective.toLowerCase();
        // Check against all pattern definitions
        for (const [patternName, pattern] of Object.entries(this.OBJECTIVE_PATTERNS)) {
            const matchScore = pattern.keywords.reduce((score, keyword) => {
                return objectiveLower.includes(keyword.toLowerCase()) ? score + 1 : score;
            }, 0);
            if (matchScore > 0) {
                logger_1.logger.info(`🎯 Matched pattern: ${patternName} (score: ${matchScore})`);
                // Add pattern requirements
                for (const reqType of pattern.requirements) {
                    if (!requirements.find(r => r.type === reqType)) {
                        const requirement = this.createRequirement(reqType, objective);
                        if (requirement) {
                            requirements.push(requirement);
                        }
                    }
                }
            }
        }
        // Add core requirements based on direct keyword matching
        this.addCoreRequirements(objectiveLower, requirements);
        // Add implied requirements based on dependencies
        this.addImpliedRequirements(requirements);
        // Sort by priority and dependencies
        return this.sortRequirements(requirements);
    }
    static createRequirement(type, objective) {
        const definition = this.REQUIREMENT_DEFINITIONS[type];
        if (!definition)
            return null;
        return {
            id: `req_${type}_${Date.now()}`,
            type,
            name: this.generateRequirementName(type, objective),
            description: definition.description,
            priority: this.calculatePriority(type, objective),
            dependencies: definition.prerequisites,
            estimatedEffort: definition.estimatedEffort,
            automatable: definition.automatable,
            mcpCoverage: definition.mcpCoverage,
            category: definition.category,
            specificSteps: this.generateSpecificSteps(type, objective),
            validationCriteria: this.generateValidationCriteria(type),
            riskLevel: definition.riskLevel
        };
    }
    static addCoreRequirements(objective, requirements) {
        // Widget keywords
        if (/widget|dashboard|portal|chart|display/.test(objective)) {
            this.addRequirementIfMissing('widget', objective, requirements);
        }
        // Flow keywords
        if (/flow|workflow|process|approval|automation/.test(objective)) {
            this.addRequirementIfMissing('flow', objective, requirements);
        }
        // Table keywords
        if (/table|record|data|store|database/.test(objective)) {
            this.addRequirementIfMissing('table', objective, requirements);
        }
        // Security keywords
        if (/security|permission|access|role|auth/.test(objective)) {
            this.addRequirementIfMissing('user_role', objective, requirements);
            this.addRequirementIfMissing('acl_rule', objective, requirements);
        }
        // Email keywords
        if (/email|notification|alert|notify/.test(objective)) {
            this.addRequirementIfMissing('email_template', objective, requirements);
            this.addRequirementIfMissing('notification', objective, requirements);
        }
    }
    static addRequirementIfMissing(type, objective, requirements) {
        if (!requirements.find(r => r.type === type)) {
            const requirement = this.createRequirement(type, objective);
            if (requirement) {
                requirements.push(requirement);
            }
        }
    }
    static addImpliedRequirements(requirements) {
        const typesPresent = new Set(requirements.map(r => r.type));
        // If we have flows, we probably need notifications
        if (typesPresent.has('flow') && !typesPresent.has('notification')) {
            const notification = this.createRequirement('notification', 'flow notification');
            if (notification)
                requirements.push(notification);
        }
        // If we have tables, we probably need some basic security
        if (typesPresent.has('table') && !typesPresent.has('acl_rule')) {
            const acl = this.createRequirement('acl_rule', 'table security');
            if (acl)
                requirements.push(acl);
        }
        // If we have widgets, we might need portal configuration
        if (typesPresent.has('widget') && !typesPresent.has('service_portal_config')) {
            const portalConfig = this.createRequirement('service_portal_config', 'widget portal setup');
            if (portalConfig)
                requirements.push(portalConfig);
        }
    }
    static generateRequirementName(type, objective) {
        const words = objective.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
        const relevantWords = words.filter(w => w.length > 3).slice(0, 3);
        const prefix = relevantWords.join(' ') || 'custom';
        return `${prefix} ${type.replace(/_/g, ' ')}`;
    }
    static calculatePriority(type, objective) {
        const definition = this.REQUIREMENT_DEFINITIONS[type];
        // High priority for core functionality and security
        if (['table', 'acl_rule', 'user_role', 'security_policy'].includes(type)) {
            return 'high';
        }
        // High priority if mentioned directly in objective
        if (objective.toLowerCase().includes(type.replace(/_/g, ' '))) {
            return 'high';
        }
        // Medium priority for automation and integration
        if (['flow', 'workflow', 'business_rule'].includes(type)) {
            return 'medium';
        }
        return definition.riskLevel === 'high' ? 'medium' : 'low';
    }
    static generateSpecificSteps(type, objective) {
        // Generate specific implementation steps based on requirement type
        const steps = [];
        switch (type) {
            case 'email_template':
                steps.push('Navigate to System Notification > Email > Templates', 'Create new email template with subject and body', 'Configure template variables and placeholders', 'Test template with sample data');
                break;
            case 'user_role':
                steps.push('Navigate to User Administration > Roles', 'Create new role with appropriate name', 'Add necessary permissions and ACLs', 'Assign role to relevant users or groups');
                break;
            case 'navigator_module':
                steps.push('Navigate to System Definition > Application Menus', 'Create new module under appropriate application', 'Configure table, view, and filter settings', 'Set proper role requirements for access');
                break;
            default:
                steps.push(`Configure ${type.replace(/_/g, ' ')} according to requirements`);
        }
        return steps;
    }
    static generateValidationCriteria(type) {
        const criteria = [];
        switch (type) {
            case 'email_template':
                criteria.push('Template renders correctly with test data', 'All variables are properly substituted', 'Email formatting is valid HTML');
                break;
            case 'user_role':
                criteria.push('Role has minimum required permissions', 'Role can be assigned to users', 'Access controls work as expected');
                break;
            default:
                criteria.push(`${type.replace(/_/g, ' ')} functions as intended`);
        }
        return criteria;
    }
    static sortRequirements(requirements) {
        // Sort by: priority (high first), then by dependency order, then by MCP coverage
        return requirements.sort((a, b) => {
            // Priority sorting
            const priorityOrder = { high: 3, medium: 2, low: 1 };
            if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            }
            // MCP coverage (covered items first for easier handling)
            if (a.mcpCoverage !== b.mcpCoverage) {
                return a.mcpCoverage ? -1 : 1;
            }
            // Risk level (low risk first)
            const riskOrder = { low: 1, medium: 2, high: 3 };
            return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        });
    }
    static calculateComplexity(requirements) {
        const totalCount = requirements.length;
        const highEffortCount = requirements.filter(r => r.estimatedEffort === 'high').length;
        const gapCount = requirements.filter(r => !r.mcpCoverage).length;
        const categories = new Set(requirements.map(r => r.category)).size;
        if (totalCount > 15 || highEffortCount > 5 || categories > 5) {
            return 'enterprise';
        }
        else if (totalCount > 10 || gapCount > 5 || categories > 3) {
            return 'high';
        }
        else if (totalCount > 5 || gapCount > 2) {
            return 'medium';
        }
        else {
            return 'low';
        }
    }
    static assessRisk(requirements) {
        const highRiskCount = requirements.filter(r => r.riskLevel === 'high').length;
        const securityCount = requirements.filter(r => r.category === 'security_compliance').length;
        const nonAutomatableCount = requirements.filter(r => !r.automatable).length;
        if (highRiskCount > 3 || securityCount > 2 || nonAutomatableCount > 5) {
            return 'high';
        }
        else if (highRiskCount > 1 || securityCount > 0 || nonAutomatableCount > 2) {
            return 'medium';
        }
        else {
            return 'low';
        }
    }
    static calculateCriticalPath(requirements) {
        // Find the sequence of high-priority requirements that are dependencies for others
        const highPriorityReqs = requirements.filter(r => r.priority === 'high');
        const path = highPriorityReqs
            .filter(r => !r.mcpCoverage) // Focus on gaps
            .slice(0, 5) // Top 5 critical items
            .map(r => r.name);
        return path;
    }
    static estimateDuration(requirements) {
        const effortHours = requirements.reduce((total, req) => {
            const baseHours = req.estimatedEffort === 'high' ? 8 :
                req.estimatedEffort === 'medium' ? 4 : 2;
            // Add complexity for non-MCP items
            const complexity = req.mcpCoverage ? 1 : 2;
            return total + (baseHours * complexity);
        }, 0);
        if (effortHours > 80) {
            return `${Math.ceil(effortHours / 40)} weeks`;
        }
        else if (effortHours > 16) {
            return `${Math.ceil(effortHours / 8)} days`;
        }
        else {
            return `${effortHours} hours`;
        }
    }
}
exports.RequirementsAnalyzer = RequirementsAnalyzer;
RequirementsAnalyzer.OBJECTIVE_PATTERNS = {
    // User Management & Security
    user_provisioning: {
        keywords: ['user', 'provisioning', 'account', 'create user', 'new employee', 'onboarding'],
        requirements: ['user_role', 'acl_rule', 'group_membership', 'email_template', 'workflow']
    },
    access_control: {
        keywords: ['access', 'permission', 'role', 'security', 'authorization'],
        requirements: ['user_role', 'acl_rule', 'security_policy', 'audit_rule']
    },
    // Data Integration
    data_import: {
        keywords: ['import', 'data load', 'csv', 'excel', 'migration', 'sync'],
        requirements: ['import_set', 'transform_map', 'field_map', 'scheduled_job']
    },
    api_integration: {
        keywords: ['api', 'rest', 'soap', 'web service', 'integration', 'external'],
        requirements: ['rest_message', 'web_service', 'oauth_provider', 'business_rule']
    },
    // Process Automation
    approval_process: {
        keywords: ['approval', 'review', 'authorize', 'escalate', 'workflow'],
        requirements: ['workflow', 'approval_rule', 'notification', 'email_template', 'sla_definition']
    },
    notification_system: {
        keywords: ['notification', 'email', 'alert', 'notify', 'message'],
        requirements: ['notification', 'email_template', 'event_rule', 'email_config']
    },
    // User Interface
    dashboard_portal: {
        keywords: ['dashboard', 'portal', 'homepage', 'overview', 'metrics'],
        requirements: ['widget', 'portal_page', 'portal_theme', 'navigator_module']
    },
    custom_form: {
        keywords: ['form', 'ui', 'input', 'custom fields', 'validation'],
        requirements: ['dictionary_entry', 'ui_policy', 'client_script', 'data_policy']
    },
    // Reporting & Analytics  
    reporting_system: {
        keywords: ['report', 'analytics', 'metrics', 'kpi', 'dashboard'],
        requirements: ['report', 'dashboard', 'scheduled_report', 'data_source']
    },
    // Infrastructure & Monitoring
    monitoring_system: {
        keywords: ['monitor', 'alert', 'health', 'performance', 'discovery'],
        requirements: ['probe', 'sensor', 'event_rule', 'notification', 'scheduled_job']
    },
    // ITSM Processes
    incident_management: {
        keywords: ['incident', 'ticket', 'issue', 'problem', 'support'],
        requirements: ['table', 'workflow', 'business_rule', 'notification', 'sla_definition']
    },
    change_management: {
        keywords: ['change', 'release', 'deployment', 'cab', 'approval'],
        requirements: ['workflow', 'approval_rule', 'scheduled_job', 'notification']
    },
    // Mobile & Modern
    mobile_app: {
        keywords: ['mobile', 'app', 'phone', 'tablet', 'ios', 'android'],
        requirements: ['mobile_app_config', 'mobile_ui_policy', 'rest_message']
    }
};
RequirementsAnalyzer.REQUIREMENT_DEFINITIONS = {
    // Core Development (MCP Covered)
    widget: {
        description: 'Service Portal widget for user interface',
        category: 'core_development',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: []
    },
    flow: {
        description: 'Flow Designer workflow for process automation',
        category: 'core_development',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: []
    },
    business_rule: {
        description: 'Server-side business logic and validation',
        category: 'core_development',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'medium',
        prerequisites: []
    },
    script_include: {
        description: 'Reusable server-side JavaScript functions',
        category: 'core_development',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: []
    },
    table: {
        description: 'Database table for data storage',
        category: 'core_development',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    application: {
        description: 'ServiceNow application container',
        category: 'core_development',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'high',
        riskLevel: 'medium',
        prerequisites: []
    },
    // Security & Compliance (Gaps!)
    user_role: {
        description: 'User roles and permission groups',
        category: 'security_compliance',
        automatable: true,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'high',
        prerequisites: []
    },
    acl_rule: {
        description: 'Access control list rules for data security',
        category: 'security_compliance',
        automatable: true,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'high',
        prerequisites: ['table']
    },
    oauth_provider: {
        description: 'OAuth authentication provider configuration',
        category: 'security_compliance',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    sso_config: {
        description: 'Single Sign-On configuration',
        category: 'security_compliance',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    data_policy: {
        description: 'Data validation and mandatory field policies',
        category: 'security_compliance',
        automatable: true,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['table']
    },
    security_policy: {
        description: 'Security policies and compliance rules',
        category: 'security_compliance',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'high',
        prerequisites: []
    },
    audit_rule: {
        description: 'Audit rules for tracking data changes',
        category: 'security_compliance',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'medium',
        prerequisites: ['table']
    },
    encryption_context: {
        description: 'Field encryption configuration',
        category: 'security_compliance',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: ['table']
    },
    // Data Integration (Partial MCP Coverage)
    import_set: {
        description: 'Import set table for data loading',
        category: 'data_integration',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: []
    },
    transform_map: {
        description: 'Transform map for data transformation',
        category: 'data_integration',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: ['import_set']
    },
    field_map: {
        description: 'Field mapping for data transformation',
        category: 'data_integration',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['transform_map']
    },
    web_service: {
        description: 'SOAP web service for integration',
        category: 'data_integration',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: []
    },
    rest_message: {
        description: 'REST message for API integration',
        category: 'data_integration',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: []
    },
    email_config: {
        description: 'Email server configuration',
        category: 'data_integration',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    ldap_config: {
        description: 'LDAP server configuration for user sync',
        category: 'data_integration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    database_view: {
        description: 'Database view for complex queries',
        category: 'data_integration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: ['table']
    },
    database_index: {
        description: 'Database index for performance optimization',
        category: 'data_integration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: ['table']
    },
    // User Interface (Partial MCP Coverage)
    ui_action: {
        description: 'Custom UI actions and buttons',
        category: 'user_interface',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['table']
    },
    ui_policy: {
        description: 'UI policies for dynamic form behavior',
        category: 'user_interface',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: ['table']
    },
    ui_page: {
        description: 'Custom UI pages and interfaces',
        category: 'user_interface',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'high',
        riskLevel: 'medium',
        prerequisites: []
    },
    ui_macro: {
        description: 'Reusable UI components and macros',
        category: 'user_interface',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: []
    },
    ui_script: {
        description: 'UI scripts for enhanced functionality',
        category: 'user_interface',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: []
    },
    client_script: {
        description: 'Client-side JavaScript for forms',
        category: 'user_interface',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['table']
    },
    css_include: {
        description: 'Custom CSS styles and themes',
        category: 'user_interface',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: []
    },
    navigator_module: {
        description: 'Application navigator menu items',
        category: 'user_interface',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['application']
    },
    homepage: {
        description: 'Custom homepage and dashboards',
        category: 'user_interface',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'medium',
        prerequisites: ['widget']
    },
    // Process Automation (Partial MCP Coverage)
    workflow: {
        description: 'Legacy workflow for process automation',
        category: 'process_automation',
        automatable: true,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'medium',
        prerequisites: []
    },
    scheduled_job: {
        description: 'Scheduled jobs for automation',
        category: 'process_automation',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: []
    },
    event_rule: {
        description: 'Event rules for automatic actions',
        category: 'process_automation',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: []
    },
    notification: {
        description: 'Email notifications and alerts',
        category: 'process_automation',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['email_template']
    },
    email_template: {
        description: 'Email templates for notifications',
        category: 'process_automation',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: []
    },
    sla_definition: {
        description: 'SLA definitions and tracking',
        category: 'process_automation',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: ['table']
    },
    escalation_rule: {
        description: 'Escalation rules for SLA breaches',
        category: 'process_automation',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: ['sla_definition']
    },
    approval_rule: {
        description: 'Approval rules and delegation',
        category: 'process_automation',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: []
    },
    state_flow: {
        description: 'State flow for record transitions',
        category: 'process_automation',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: ['table']
    },
    // System Configuration (Major Gaps!)
    dictionary_entry: {
        description: 'Table field definitions and properties',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'medium',
        prerequisites: ['table']
    },
    choice_list: {
        description: 'Choice lists for dropdown fields',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['dictionary_entry']
    },
    ui_formatter: {
        description: 'Custom field formatters and displays',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: []
    },
    display_value: {
        description: 'Display value configurations',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['dictionary_entry']
    },
    reference_qualifier: {
        description: 'Reference field qualifiers and filters',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: ['dictionary_entry']
    },
    data_lookup: {
        description: 'Data lookup definitions and rules',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: []
    },
    sys_property: {
        description: 'System properties and configuration',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'high',
        prerequisites: []
    },
    system_setting: {
        description: 'System settings and preferences',
        category: 'system_configuration',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'high',
        prerequisites: []
    },
    // Reporting & Analytics (Partial MCP Coverage)
    report: {
        description: 'Reports and data _analysis',
        category: 'reporting_analytics',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: ['table']
    },
    dashboard: {
        description: 'Dashboards and data visualization',
        category: 'reporting_analytics',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: ['report']
    },
    metric: {
        description: 'Custom metrics and indicators',
        category: 'reporting_analytics',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: []
    },
    kpi: {
        description: 'Key Performance Indicators',
        category: 'reporting_analytics',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: ['metric']
    },
    scheduled_report: {
        description: 'Scheduled report delivery',
        category: 'reporting_analytics',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['report']
    },
    data_source: {
        description: 'Data sources for reporting',
        category: 'reporting_analytics',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'medium',
        prerequisites: []
    },
    gauge: {
        description: 'Performance gauges and meters',
        category: 'reporting_analytics',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: ['metric']
    },
    chart_configuration: {
        description: 'Chart configuration and styling',
        category: 'reporting_analytics',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'low',
        riskLevel: 'low',
        prerequisites: ['dashboard']
    },
    // Mobile & Portal (Major Gaps!)
    mobile_app_config: {
        description: 'Mobile application configuration',
        category: 'mobile_portal',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    service_portal_config: {
        description: 'Service Portal configuration',
        category: 'mobile_portal',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'medium',
        prerequisites: []
    },
    portal_widget: {
        description: 'Service Portal widgets',
        category: 'mobile_portal',
        automatable: true,
        mcpCoverage: true,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: ['service_portal_config']
    },
    portal_page: {
        description: 'Service Portal pages',
        category: 'mobile_portal',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: ['service_portal_config']
    },
    portal_theme: {
        description: 'Service Portal themes and styling',
        category: 'mobile_portal',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'low',
        prerequisites: ['service_portal_config']
    },
    mobile_ui_policy: {
        description: 'Mobile-specific UI policies',
        category: 'mobile_portal',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'medium',
        prerequisites: ['mobile_app_config']
    },
    // Monitoring & Operations (Major Gaps!)
    probe: {
        description: 'Discovery probes for monitoring',
        category: 'monitoring_operations',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    sensor: {
        description: 'Discovery sensors and patterns',
        category: 'monitoring_operations',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    discovery_rule: {
        description: 'Discovery rules and classification',
        category: 'monitoring_operations',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    cmdb_identification: {
        description: 'CMDB identification rules',
        category: 'monitoring_operations',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    orchestration_workflow: {
        description: 'Orchestration workflows',
        category: 'monitoring_operations',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'high',
        prerequisites: []
    },
    runbook: {
        description: 'Automated runbooks',
        category: 'monitoring_operations',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'high',
        riskLevel: 'medium',
        prerequisites: []
    },
    knowledge_article: {
        description: 'Knowledge base articles',
        category: 'monitoring_operations',
        automatable: false,
        mcpCoverage: false,
        estimatedEffort: 'medium',
        riskLevel: 'low',
        prerequisites: []
    }
};
//# sourceMappingURL=requirements-analyzer.js.map