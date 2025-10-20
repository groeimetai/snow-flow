"use strict";
/**
 * MCP Coverage Analyzer - Maps what ServiceNow MCP tools can handle
 *
 * This module analyzes what ServiceNow configurations and operations
 * our current MCP tools can handle versus what requires manual intervention
 * or additional automation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpCoverageAnalyzer = exports.UNCOVERED_REQUIREMENTS = exports.MCP_TOOL_CAPABILITIES = void 0;
/**
 * Comprehensive mapping of all ServiceNow MCP tool capabilities
 */
exports.MCP_TOOL_CAPABILITIES = [
    // Core Development Tools (Primary Coverage)
    {
        tool: 'snow_deploy',
        requirementTypes: ['widget', 'flow', 'application', 'script_include', 'business_rule', 'table'],
        description: 'Unified deployment for core ServiceNow artifacts',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['app_creator', 'admin']
    },
    // Intelligent & Discovery Tools
    {
        tool: 'snow_find_artifact',
        requirementTypes: ['widget', 'flow', 'script_include', 'business_rule', 'table', 'application'],
        description: 'AI-powered artifact discovery and search',
        scope: 'both',
        autoDeployable: false
    },
    {
        tool: 'snow_comprehensive_search',
        requirementTypes: ['widget', 'flow', 'script_include', 'business_rule', 'table', 'user_role'],
        description: 'Multi-table search across ServiceNow',
        scope: 'both',
        autoDeployable: false
    },
    // Flow Development
    {
        tool: 'snow_create_flow',
        requirementTypes: ['flow', 'approval_workflow', 'notification_rule'],
        description: 'Natural language flow creation with AI',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['flow_designer']
    },
    {
        tool: 'snow_test_flow_with_mock',
        requirementTypes: ['flow', 'approval_workflow'],
        description: 'Flow testing with mock data and users',
        scope: 'both',
        autoDeployable: true
    },
    // Operations & ITSM
    {
        tool: 'snow_query_incidents',
        requirementTypes: ['incident_table', 'query_rule'],
        description: 'Advanced incident querying and _analysis',
        scope: 'both',
        autoDeployable: false
    },
    {
        tool: 'snow_analyze_incident',
        requirementTypes: ['incident__analysis', 'knowledge_article'],
        description: 'AI-powered incident _analysis with suggestions',
        scope: 'both',
        autoDeployable: false
    },
    // Catalog Management
    {
        tool: 'snow_catalog_item_search',
        requirementTypes: ['catalog_item', 'catalog_category'],
        description: 'Intelligent catalog item discovery with fuzzy matching',
        scope: 'both',
        autoDeployable: false
    },
    {
        tool: 'snow_catalog_item_manager',
        requirementTypes: ['catalog_item', 'catalog_variable'],
        description: 'Complete catalog item lifecycle management',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['catalog_admin']
    },
    {
        tool: 'snow_link_catalog_to_flow',
        requirementTypes: ['catalog_item', 'flow', 'workflow_integration'],
        description: 'Direct catalog-flow linking for fulfillment',
        scope: 'both',
        autoDeployable: true
    },
    // User & Group Management
    {
        tool: 'snow_create_user',
        requirementTypes: ['user_account'],
        description: 'User creation with department and role assignment',
        scope: 'global',
        autoDeployable: true,
        requiresPermissions: ['user_admin']
    },
    {
        tool: 'snow_create_user_group',
        requirementTypes: ['user_group'],
        description: 'Group creation with hierarchy support',
        scope: 'global',
        autoDeployable: true,
        requiresPermissions: ['user_admin']
    },
    {
        tool: 'snow_assign_user_to_group',
        requirementTypes: ['group_membership'],
        description: 'User-group assignment management',
        scope: 'global',
        autoDeployable: true,
        requiresPermissions: ['user_admin']
    },
    // Platform Development
    {
        tool: 'snow_create_ui_page',
        requirementTypes: ['ui_page'],
        description: 'UI Page creation with client and server scripts',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['admin']
    },
    {
        tool: 'snow_create_client_script',
        requirementTypes: ['client_script'],
        description: 'Client script creation for forms',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['admin']
    },
    {
        tool: 'snow_create_ui_policy',
        requirementTypes: ['ui_policy'],
        description: 'UI Policy creation for dynamic forms',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['admin']
    },
    {
        tool: 'snow_create_ui_action',
        requirementTypes: ['ui_action'],
        description: 'UI Action creation for forms and lists',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['admin']
    },
    // Integration Tools
    {
        tool: 'snow_create_rest_message',
        requirementTypes: ['rest_message', 'integration_endpoint'],
        description: 'REST Message endpoint creation',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['web_service_admin']
    },
    {
        tool: 'snow_create_transform_map',
        requirementTypes: ['transform_map', 'import_set'],
        description: 'Data transformation and import mapping',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['import_admin']
    },
    // Automation Tools
    {
        tool: 'snow_create_scheduled_job',
        requirementTypes: ['scheduled_job', 'scheduled_task'],
        description: 'Scheduled job creation with cron patterns',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['scheduler_admin']
    },
    {
        tool: 'snow_create_notification',
        requirementTypes: ['notification_rule', 'email_template'],
        description: 'Email notification creation with templates',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['notification_admin']
    },
    {
        tool: 'snow_create_event_rule',
        requirementTypes: ['event_rule', 'event_registration'],
        description: 'Event-driven automation rules',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['admin']
    },
    // Security & Compliance
    {
        tool: 'snow_create_access_control',
        requirementTypes: ['acl_rule'],
        description: 'Access Control List creation',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['security_admin'],
        limitations: ['Complex role hierarchies require manual review']
    },
    {
        tool: 'snow_create_data_policy',
        requirementTypes: ['data_policy'],
        description: 'Data policy and validation rules',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['admin']
    },
    // Reporting & Analytics
    {
        tool: 'snow_create_report',
        requirementTypes: ['report', 'dashboard_tab'],
        description: 'Report creation with dynamic fields',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['report_admin']
    },
    {
        tool: 'snow_create_dashboard',
        requirementTypes: ['dashboard', 'homepage'],
        description: 'Dashboard creation with widgets',
        scope: 'both',
        autoDeployable: true,
        requiresPermissions: ['admin']
    },
    // Update Set Management
    {
        tool: 'snow_update_set_create',
        requirementTypes: ['update_set'],
        description: 'Update Set lifecycle management',
        scope: 'global',
        autoDeployable: true,
        requiresPermissions: ['admin']
    }
];
/**
 * Requirements that have NO current MCP coverage and require manual intervention
 */
exports.UNCOVERED_REQUIREMENTS = [
    // Advanced Authentication
    'ldap_config', 'saml_config', 'oauth_provider', 'sso_config', 'mfa_config',
    // System Configuration
    'system_property', 'system_definition', 'application_menu', 'module_navigation',
    'theme_configuration', 'branding_config',
    // Database & Performance
    'database_index', 'database_view', 'table_rotation', 'partitioning_config',
    'cache_configuration',
    // Advanced Integration
    'web_service', 'soap_message', 'import_set_transformer', 'coremeta_data',
    'data_source', 'ldap_server',
    // Workflow & Process
    'workflow_activity', 'workflow_transition', 'sla_definition', 'escalation_rule',
    'approval_definition',
    // Advanced Automation
    'inbound_email_action', 'processor', 'pdf_generator', 'sys_script_validator',
    // Performance & Monitoring
    'performance_analytics', 'metric_definition', 'job_queue', 'transaction_quota',
    // Advanced UI
    'form_layout', 'form_section', 'list_layout', 'related_list', 'formatter',
    'reference_qualifier', 'choice_list', 'dictionary_entry'
];
class McpCoverageAnalyzer {
    /**
     * Analyze coverage for a list of requirements
     */
    static analyzeCoverage(requirements) {
        const covered = [];
        const gaps = [];
        const partialCoverage = [];
        for (const requirement of requirements) {
            const capability = this.findToolCapability(requirement.type);
            if (!capability) {
                gaps.push(requirement);
            }
            else if (capability.limitations && capability.limitations.length > 0) {
                // Partial coverage - tool exists but has limitations
                partialCoverage.push({
                    requirement,
                    coveringTool: capability.tool,
                    limitations: capability.limitations,
                    manualSteps: this.generateManualSteps(requirement, capability)
                });
            }
            else {
                covered.push(requirement);
            }
        }
        const coveragePercentage = Math.round(((covered.length + partialCoverage.length * 0.5) / requirements.length) * 100);
        const recommendations = this.generateRecommendations(covered, gaps, partialCoverage);
        return {
            covered,
            gaps,
            partialCoverage,
            coveragePercentage,
            recommendations
        };
    }
    /**
     * Analyze automation capabilities for a specific requirement
     */
    static analyzeAutomationCapability(requirement) {
        const capability = this.findToolCapability(requirement.type);
        if (!capability) {
            return {
                canAutomate: false,
                riskLevel: 'high',
                complexity: 'complex',
                estimatedTime: 'Manual setup required',
                fallbackStrategy: 'Provide detailed manual instructions'
            };
        }
        if (!capability.autoDeployable) {
            return {
                canAutomate: false,
                automationTool: capability.tool,
                riskLevel: 'low',
                complexity: 'simple',
                estimatedTime: '1-2 minutes',
                fallbackStrategy: 'Use tool for discovery, manual configuration'
            };
        }
        // Assess risk based on requirements and permissions
        const riskLevel = this.assessRiskLevel(requirement, capability);
        const complexity = this.assessComplexity(requirement, capability);
        return {
            canAutomate: true,
            automationTool: capability.tool,
            requiredPermissions: capability.requiresPermissions,
            riskLevel,
            complexity,
            estimatedTime: this.estimateTime(complexity),
            fallbackStrategy: this.getFallbackStrategy(requirement, capability)
        };
    }
    /**
     * Get all available tools for a requirement type
     */
    static getAvailableTools(requirementType) {
        return exports.MCP_TOOL_CAPABILITIES.filter(cap => cap.requirementTypes.includes(requirementType));
    }
    /**
     * Check if a requirement type is completely uncovered
     */
    static isUncovered(requirementType) {
        return exports.UNCOVERED_REQUIREMENTS.includes(requirementType);
    }
    /**
     * Generate automation strategy for a list of requirements
     */
    static generateAutomationStrategy(requirements) {
        const automatable = requirements.filter(req => {
            const capability = this.analyzeAutomationCapability(req);
            return capability.canAutomate;
        });
        const manual = requirements.filter(req => {
            const capability = this.analyzeAutomationCapability(req);
            return !capability.canAutomate;
        });
        // Generate execution sequence
        const sequence = this.planExecutionSequence(automatable);
        return { automatable, manual, sequence };
    }
    // Private helper methods
    static findToolCapability(requirementType) {
        return exports.MCP_TOOL_CAPABILITIES.find(cap => cap.requirementTypes.includes(requirementType));
    }
    static generateManualSteps(requirement, capability) {
        const steps = [];
        if (capability.limitations) {
            for (const limitation of capability.limitations) {
                if (limitation.includes('permissions')) {
                    steps.push(`Verify ${capability.requiresPermissions?.join(', ')} permissions before deployment`);
                }
                if (limitation.includes('manual review')) {
                    steps.push(`Review generated configuration before activation`);
                }
                if (limitation.includes('testing')) {
                    steps.push(`Test thoroughly in development environment first`);
                }
            }
        }
        return steps;
    }
    static generateRecommendations(covered, gaps, partial) {
        const recommendations = [];
        if (covered.length > 0) {
            recommendations.push(`✅ ${covered.length} requirements can be fully automated`);
        }
        if (partial.length > 0) {
            recommendations.push(`⚠️ ${partial.length} requirements have partial automation - manual steps needed`);
        }
        if (gaps.length > 0) {
            recommendations.push(`❌ ${gaps.length} requirements require manual configuration`);
            // Group gaps by category for better recommendations
            const gapsByCategory = this.categorizeGaps(gaps);
            for (const [category, count] of Object.entries(gapsByCategory)) {
                if (count > 0) {
                    recommendations.push(`• ${count} ${category} configurations need manual setup`);
                }
            }
        }
        // Strategic recommendations
        if (gaps.length / (covered.length + partial.length + gaps.length) > 0.3) {
            recommendations.push('💡 Consider extending MCP tools to cover more requirements');
        }
        if (partial.length > 0) {
            recommendations.push('🔧 Enable auto-permissions flag to reduce manual intervention');
        }
        return recommendations;
    }
    static categorizeGaps(gaps) {
        const categories = {
            'Authentication': 0,
            'Database': 0,
            'Integration': 0,
            'UI/Forms': 0,
            'Workflow': 0,
            'Security': 0,
            'System': 0
        };
        for (const gap of gaps) {
            switch (gap.type) {
                case 'ldap_config':
                case 'saml_config':
                case 'oauth_provider':
                case 'sso_config':
                case 'mfa_config':
                    categories['Authentication']++;
                    break;
                case 'database_index':
                case 'database_view':
                case 'table_rotation':
                case 'partitioning_config':
                    categories['Database']++;
                    break;
                case 'web_service':
                case 'soap_message':
                case 'import_set_transformer':
                case 'data_source':
                    categories['Integration']++;
                    break;
                case 'form_layout':
                case 'form_section':
                case 'list_layout':
                case 'dictionary_entry':
                    categories['UI/Forms']++;
                    break;
                case 'workflow_activity':
                case 'workflow_transition':
                case 'sla_definition':
                case 'escalation_rule':
                    categories['Workflow']++;
                    break;
                case 'acl_rule':
                case 'data_policy':
                    categories['Security']++;
                    break;
                default:
                    categories['System']++;
            }
        }
        return categories;
    }
    static assessRiskLevel(requirement, capability) {
        // Security-related requirements have higher risk
        if (['acl_rule', 'data_policy', 'user_role'].includes(requirement.type)) {
            return 'high';
        }
        // Global scope operations have medium risk
        if (capability.scope === 'global') {
            return 'medium';
        }
        // Standard development artifacts are low risk
        return 'low';
    }
    static assessComplexity(requirement, capability) {
        if (capability.limitations && capability.limitations.length > 2) {
            return 'complex';
        }
        if (capability.requiresPermissions && capability.requiresPermissions.length > 2) {
            return 'moderate';
        }
        return 'simple';
    }
    static estimateTime(complexity) {
        switch (complexity) {
            case 'simple': return '1-2 minutes';
            case 'moderate': return '3-5 minutes';
            case 'complex': return '5-10 minutes';
        }
    }
    static getFallbackStrategy(requirement, capability) {
        if (capability.limitations) {
            return 'Automatic deployment with manual verification';
        }
        if (capability.requiresPermissions) {
            return 'Request permissions, then automatic deployment';
        }
        return 'Full automatic deployment';
    }
    static planExecutionSequence(requirements) {
        // Group by dependencies and complexity
        const grouped = this.groupByExecutionOrder(requirements);
        return grouped.map((group, index) => ({
            step: index + 1,
            requirements: group,
            strategy: group.length > 1 ? 'parallel' : 'sequential',
            estimatedTime: this.calculateGroupTime(group)
        }));
    }
    static groupByExecutionOrder(requirements) {
        // Simple grouping - in a real implementation, this would analyze dependencies
        const groups = [];
        // Group 1: Foundation (tables, applications)
        const foundation = requirements.filter(req => ['table', 'application'].includes(req.type));
        if (foundation.length > 0)
            groups.push(foundation);
        // Group 2: Security and Users
        const security = requirements.filter(req => ['user_role', 'user_group', 'acl_rule', 'data_policy'].includes(req.type));
        if (security.length > 0)
            groups.push(security);
        // Group 3: Core Logic
        const logic = requirements.filter(req => ['business_rule', 'script_include', 'client_script'].includes(req.type));
        if (logic.length > 0)
            groups.push(logic);
        // Group 4: UI and Workflows
        const ui = requirements.filter(req => ['widget', 'flow', 'ui_page', 'ui_action'].includes(req.type));
        if (ui.length > 0)
            groups.push(ui);
        // Group 5: Integration and Automation
        const automation = requirements.filter(req => ['scheduled_job', 'notification_rule', 'rest_message'].includes(req.type));
        if (automation.length > 0)
            groups.push(automation);
        return groups;
    }
    static calculateGroupTime(requirements) {
        let totalMinutes = 0;
        for (const req of requirements) {
            const capability = this.analyzeAutomationCapability(req);
            const timeStr = capability.estimatedTime || '2 minutes';
            const minutes = parseInt(timeStr.match(/\d+/)?.[0] || '2');
            totalMinutes += minutes;
        }
        // For parallel execution, use the maximum time rather than sum
        const maxTime = Math.max(...requirements.map(req => {
            const capability = this.analyzeAutomationCapability(req);
            const timeStr = capability.estimatedTime || '2 minutes';
            return parseInt(timeStr.match(/\d+/)?.[0] || '2');
        }));
        return requirements.length > 1 ? `${maxTime} minutes (parallel)` : `${totalMinutes} minutes`;
    }
}
exports.McpCoverageAnalyzer = McpCoverageAnalyzer;
//# sourceMappingURL=mcp-coverage-analyzer.js.map