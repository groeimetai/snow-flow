"use strict";
/**
 * Manual Instructions Generator - Creates detailed manual setup guides
 *
 * This module generates comprehensive, step-by-step instructions for ServiceNow
 * configurations that cannot be automated through MCP tools or direct API calls.
 *
 * Features:
 * - Role-specific instructions (admin, developer, end-user)
 * - Environment-aware guidance (dev, test, prod)
 * - Risk assessment and warnings
 * - Prerequisites and dependencies
 * - Verification steps and testing guidance
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManualInstructionsGenerator = exports.MANUAL_INSTRUCTION_TEMPLATES = void 0;
/**
 * Manual instruction templates for ServiceNow configurations
 */
exports.MANUAL_INSTRUCTION_TEMPLATES = {
    // System Configuration
    system_property: {
        title: 'Create System Property',
        overview: 'System properties control global ServiceNow behavior and should be configured carefully.',
        prerequisites: ['admin role', 'understanding of property impact'],
        riskLevel: 'medium',
        requiredRoles: ['admin'],
        instructions: [
            {
                step: 1,
                title: 'Navigate to System Properties',
                description: 'Access the system properties configuration',
                navigation: ['System Definition', 'System Properties'],
                actions: [
                    'Click on System Definition in the left navigation',
                    'Select System Properties from the submenu',
                    'Review existing properties to avoid duplicates'
                ],
                estimatedTime: '1 minute'
            },
            {
                step: 2,
                title: 'Create New Property',
                description: 'Add the new system property with correct settings',
                navigation: [],
                actions: [
                    'Click the "New" button',
                    'Enter the property name (use descriptive naming)',
                    'Set the property value',
                    'Add a clear description explaining the purpose',
                    'Select appropriate type (string, boolean, integer, etc.)'
                ],
                warnings: [
                    'Test property changes in development first',
                    'Document the business reason for the property',
                    'Some properties require instance restart'
                ],
                estimatedTime: '3 minutes'
            }
        ],
        verificationGuide: [
            'Verify property appears in system properties list',
            'Test that property value is correctly applied',
            'Monitor system logs for any warnings or errors'
        ]
    },
    // Database Management
    database_index: {
        title: 'Create Database Index',
        overview: 'Database indexes improve query performance but should be created carefully to avoid negative impact.',
        prerequisites: ['admin role', 'database performance knowledge', 'development environment testing'],
        riskLevel: 'high',
        requiredRoles: ['admin'],
        instructions: [
            {
                step: 1,
                title: 'Navigate to Table Configuration',
                description: 'Access the target table for index creation',
                navigation: ['System Definition', 'Tables'],
                actions: [
                    'Search for the target table',
                    'Open the table definition',
                    'Go to the "Database Indexes" related list'
                ],
                warnings: [
                    'NEVER create indexes on production without development testing',
                    'Monitor database performance during index creation'
                ],
                estimatedTime: '2 minutes'
            },
            {
                step: 2,
                title: 'Create Index',
                description: 'Configure the database index with optimal settings',
                navigation: [],
                actions: [
                    'Click "New" in the Database Indexes related list',
                    'Set a descriptive index name',
                    'Select index type (index, unique, etc.)',
                    'Add fields to index in optimal order',
                    'Consider composite indexes for multi-field queries'
                ],
                warnings: [
                    'Index creation can impact database performance',
                    'Test query performance before and after',
                    'Consider maintenance windows for large tables'
                ],
                verificationSteps: [
                    'Verify index appears in database',
                    'Test query performance improvement',
                    'Monitor for any locking issues'
                ],
                estimatedTime: '10 minutes'
            }
        ],
        troubleshooting: [
            {
                issue: 'Index creation fails',
                solution: 'Check for duplicate index names, verify field names exist, ensure sufficient database permissions'
            },
            {
                issue: 'Performance degradation',
                solution: 'Review index strategy, consider dropping unused indexes, analyze query execution plans'
            }
        ]
    },
    // Navigation and UI
    application_menu: {
        title: 'Create Application Menu',
        overview: 'Application menus organize functionality and provide user navigation within ServiceNow applications.',
        prerequisites: ['admin role', 'understanding of application structure'],
        riskLevel: 'low',
        requiredRoles: ['admin'],
        instructions: [
            {
                step: 1,
                title: 'Navigate to Application Menus',
                description: 'Access the application menu configuration',
                navigation: ['System Definition', 'Application Menus'],
                actions: [
                    'Find the target application',
                    'Note the existing menu structure',
                    'Plan the new menu placement'
                ],
                estimatedTime: '1 minute'
            },
            {
                step: 2,
                title: 'Create Menu Module',
                description: 'Add a new module to the application menu',
                navigation: [],
                actions: [
                    'Right-click on the application or existing module',
                    'Select "New Module"',
                    'Set the module title and order',
                    'Configure the link type (LIST, DETAIL, etc.)',
                    'Set appropriate roles and conditions'
                ],
                verificationSteps: [
                    'Verify menu appears in application navigator',
                    'Test menu link functionality',
                    'Confirm proper role-based access'
                ],
                estimatedTime: '3 minutes'
            }
        ]
    },
    // Authentication and Security
    ldap_config: {
        title: 'Configure LDAP Authentication',
        overview: 'LDAP integration enables Single Sign-On and centralized user management.',
        prerequisites: ['security_admin role', 'LDAP server details', 'network connectivity'],
        riskLevel: 'high',
        requiredRoles: ['security_admin', 'admin'],
        instructions: [
            {
                step: 1,
                title: 'Navigate to LDAP Servers',
                description: 'Access LDAP configuration interface',
                navigation: ['System LDAP', 'LDAP Servers'],
                actions: [
                    'Review existing LDAP configurations',
                    'Gather LDAP server connection details',
                    'Prepare test user accounts'
                ],
                warnings: [
                    'LDAP configuration affects user authentication',
                    'Test thoroughly before enabling in production',
                    'Have fallback admin account ready'
                ],
                estimatedTime: '2 minutes'
            },
            {
                step: 2,
                title: 'Create LDAP Server Configuration',
                description: 'Configure connection to LDAP server',
                navigation: [],
                actions: [
                    'Click "New" to create LDAP server',
                    'Enter server hostname and port',
                    'Configure SSL settings if required',
                    'Set bind DN and password',
                    'Configure user and group search bases'
                ],
                warnings: [
                    'Use secure connection (LDAPS) when possible',
                    'Store service account credentials securely',
                    'Test connection before saving'
                ],
                estimatedTime: '15 minutes'
            },
            {
                step: 3,
                title: 'Configure User Mapping',
                description: 'Map LDAP attributes to ServiceNow user fields',
                navigation: [],
                actions: [
                    'Set up attribute mapping for user fields',
                    'Configure group membership mapping',
                    'Set default roles for LDAP users',
                    'Enable user provisioning if needed'
                ],
                verificationSteps: [
                    'Test LDAP connection',
                    'Verify user authentication',
                    'Confirm group membership sync',
                    'Test with multiple user accounts'
                ],
                estimatedTime: '10 minutes'
            }
        ],
        troubleshooting: [
            {
                issue: 'Connection fails',
                solution: 'Verify server details, check network connectivity, confirm firewall rules, validate credentials'
            },
            {
                issue: 'Users cannot authenticate',
                solution: 'Check user DN format, verify search base configuration, confirm attribute mapping'
            }
        ]
    },
    // Performance and Monitoring
    performance_analytics: {
        title: 'Configure Performance Analytics',
        overview: 'Performance Analytics provides data-driven insights through cubes and dashboards.',
        prerequisites: ['pa_admin role', 'data source understanding', 'dashboard requirements'],
        riskLevel: 'medium',
        requiredRoles: ['pa_admin'],
        instructions: [
            {
                step: 1,
                title: 'Navigate to Performance Analytics',
                description: 'Access PA configuration',
                navigation: ['Performance Analytics', 'Data Collector', 'Cubes'],
                actions: [
                    'Review existing cubes',
                    'Identify data sources',
                    'Plan cube structure'
                ],
                estimatedTime: '3 minutes'
            },
            {
                step: 2,
                title: 'Create Data Cube',
                description: 'Set up data collection cube',
                navigation: [],
                actions: [
                    'Click "New" to create cube',
                    'Set cube name and description',
                    'Select source table',
                    'Configure collection schedule',
                    'Define dimensions and measures'
                ],
                estimatedTime: '15 minutes'
            }
        ]
    },
    // Placeholder entries for other requirement types
    module_navigation: { title: 'Configure Module Navigation' },
    form_layout: { title: 'Design Form Layout' },
    form_section: { title: 'Create Form Section' },
    list_layout: { title: 'Configure List Layout' },
    dictionary_entry: { title: 'Create Dictionary Entry' },
    choice_list: { title: 'Configure Choice List' },
    reference_qualifier: { title: 'Set Reference Qualifier' },
    workflow_activity: { title: 'Create Workflow Activity' },
    workflow_transition: { title: 'Configure Workflow Transition' },
    sla_definition: { title: 'Define SLA' },
    escalation_rule: { title: 'Create Escalation Rule' },
    approval_definition: { title: 'Configure Approval Process' },
    oauth_provider: { title: 'Set up OAuth Provider' },
    saml_config: { title: 'Configure SAML Authentication' },
    sso_config: { title: 'Configure Single Sign-On' },
    mfa_config: { title: 'Set up Multi-Factor Authentication' },
    web_service: { title: 'Create Web Service' },
    soap_message: { title: 'Configure SOAP Message' },
    import_set_transformer: { title: 'Create Import Set Transformer' },
    data_source: { title: 'Configure Data Source' },
    ldap_server: { title: 'Configure LDAP Server' },
    email_template: { title: 'Create Email Template' },
    inbound_email_action: { title: 'Configure Inbound Email Action' },
    processor: { title: 'Create Processor' },
    pdf_generator: { title: 'Configure PDF Generator' },
    sys_script_validator: { title: 'Create Script Validator' },
    scheduled_task: { title: 'Create Scheduled Task' },
    metric_definition: { title: 'Define Metric' },
    job_queue: { title: 'Configure Job Queue' },
    transaction_quota: { title: 'Set Transaction Quota' },
    database_view: { title: 'Create Database View' },
    table_rotation: { title: 'Configure Table Rotation' },
    partitioning_config: { title: 'Set up Table Partitioning' },
    cache_configuration: { title: 'Configure Cache Settings' },
    system_definition: { title: 'Update System Definition' },
    theme_configuration: { title: 'Configure Theme' },
    branding_config: { title: 'Set up Branding' },
    formatter: { title: 'Create Formatter' },
    related_list: { title: 'Configure Related List' },
    coremeta_data: { title: 'Configure Core Metadata' },
    // Core artifacts (should be handled by MCP tools, but fallback instructions)
    widget: { title: 'Create Service Portal Widget' },
    flow: { title: 'Create Flow Designer Flow' },
    business_rule: { title: 'Create Business Rule' },
    script_include: { title: 'Create Script Include' },
    table: { title: 'Create Table' },
    application: { title: 'Create Application' },
    user_role: { title: 'Create User Role' },
    user_group: { title: 'Create User Group' },
    user_account: { title: 'Create User Account' },
    group_membership: { title: 'Assign Group Membership' },
    acl_rule: { title: 'Create Access Control Rule' },
    data_policy: { title: 'Create Data Policy' },
    ui_page: { title: 'Create UI Page' },
    ui_action: { title: 'Create UI Action' },
    ui_policy: { title: 'Create UI Policy' },
    client_script: { title: 'Create Client Script' },
    catalog_item: { title: 'Create Catalog Item' },
    catalog_variable: { title: 'Create Catalog Variable' },
    catalog_category: { title: 'Create Catalog Category' },
    notification_rule: { title: 'Create Notification Rule' },
    scheduled_job: { title: 'Create Scheduled Job' },
    event_rule: { title: 'Create Event Rule' },
    event_registration: { title: 'Register Event' },
    rest_message: { title: 'Create REST Message' },
    transform_map: { title: 'Create Transform Map' },
    import_set: { title: 'Create Import Set' },
    report: { title: 'Create Report' },
    dashboard: { title: 'Create Dashboard' },
    dashboard_tab: { title: 'Create Dashboard Tab' },
    homepage: { title: 'Configure Homepage' },
    update_set: { title: 'Create Update Set' },
    workflow_integration: { title: 'Configure Workflow Integration' },
    approval_workflow: { title: 'Create Approval Workflow' },
    integration_endpoint: { title: 'Create Integration Endpoint' },
    query_rule: { title: 'Create Query Rule' },
    incident_table: { title: 'Configure Incident Table' },
    incident__analysis: { title: 'Set up Incident Analysis' },
    knowledge_article: { title: 'Create Knowledge Article' }
};
class ManualInstructionsGenerator {
    /**
     * Generate detailed manual instructions for a single requirement
     */
    static generateInstructions(requirement) {
        const template = exports.MANUAL_INSTRUCTION_TEMPLATES[requirement.type];
        if (!template) {
            return this.generateGenericInstructions(requirement);
        }
        // Merge template with requirement-specific data
        const guide = {
            requirement,
            title: template.title || `Configure ${requirement.type}`,
            overview: template.overview || `Manual setup required for ${requirement.name}`,
            prerequisites: template.prerequisites || ['admin role', 'system understanding'],
            totalEstimatedTime: this.calculateTotalTime(template.instructions || []),
            riskLevel: template.riskLevel || 'medium',
            requiredRoles: template.requiredRoles || ['admin'],
            environment: 'development',
            instructions: template.instructions || [],
            verificationGuide: template.verificationGuide || this.generateGenericVerification(requirement),
            troubleshooting: template.troubleshooting || [],
            relatedDocuments: this.generateRelatedDocuments(requirement.type)
        };
        // Customize instructions with requirement-specific data
        guide.instructions = this.customizeInstructions(guide.instructions, requirement);
        return guide;
    }
    /**
     * Generate bulk manual guide for multiple requirements
     */
    static generateBulkInstructions(requirements) {
        const guides = requirements.map(req => this.generateInstructions(req));
        const executionOrder = this.planExecutionOrder(requirements);
        return {
            title: `Manual Configuration Guide for ${requirements.length} Requirements`,
            overview: this.generateBulkOverview(requirements),
            executionOrder,
            guides,
            overallRisks: this.identifyOverallRisks(guides),
            coordinationNotes: this.generateCoordinationNotes(requirements)
        };
    }
    /**
     * Generate instructions from failed automation results
     */
    static generateFromFailedResults(results) {
        return results
            .filter(result => result.status === 'failed' || result.status === 'manual_required')
            .map(result => {
            const guide = this.generateInstructions(result.requirement);
            // Add failure-specific information
            if (result.errorMessage) {
                guide.overview += ` Note: Automation failed with error: ${result.errorMessage}`;
            }
            if (result.manualSteps && result.manualSteps.length > 0) {
                const failureStep = {
                    step: 0,
                    title: 'Automation Failure Recovery',
                    description: 'Steps to recover from failed automation attempt',
                    navigation: [],
                    actions: result.manualSteps,
                    warnings: ['Verify automation did not create partial configuration'],
                    estimatedTime: '2 minutes'
                };
                guide.instructions.unshift(failureStep);
            }
            return guide;
        });
    }
    /**
     * Generate environment-specific instructions
     */
    static generateForEnvironment(requirement, environment) {
        const guide = this.generateInstructions(requirement);
        guide.environment = environment;
        // Add environment-specific warnings and procedures
        switch (environment) {
            case 'production':
                guide.riskLevel = guide.riskLevel === 'low' ? 'medium' : 'high';
                guide.prerequisites.push('change management approval', 'maintenance window', 'rollback plan');
                guide.instructions.forEach(instruction => {
                    instruction.warnings = instruction.warnings || [];
                    instruction.warnings.push('PRODUCTION ENVIRONMENT - Exercise extreme caution');
                });
                break;
            case 'testing':
                guide.prerequisites.push('test data available', 'test scenarios defined');
                break;
            case 'development':
                guide.prerequisites.push('development instance access');
                break;
        }
        return guide;
    }
    // Private helper methods
    static generateGenericInstructions(requirement) {
        return {
            requirement,
            title: `Configure ${requirement.type}: ${requirement.name}`,
            overview: `Manual configuration required for ${requirement.type}. This is a generic guide as specific instructions are not available.`,
            prerequisites: ['admin role', 'ServiceNow platform knowledge'],
            totalEstimatedTime: '15-30 minutes',
            riskLevel: 'medium',
            requiredRoles: ['admin'],
            environment: 'development',
            instructions: [
                {
                    step: 1,
                    title: 'Research Configuration',
                    description: 'Find the appropriate ServiceNow configuration area',
                    navigation: ['Research in ServiceNow documentation'],
                    actions: [
                        'Search ServiceNow documentation for configuration steps',
                        'Identify the correct navigation path',
                        'Review similar existing configurations'
                    ],
                    estimatedTime: '10 minutes'
                },
                {
                    step: 2,
                    title: 'Create Configuration',
                    description: 'Implement the required configuration',
                    navigation: ['Navigate to appropriate section'],
                    actions: [
                        'Create new configuration item',
                        'Set name and description appropriately',
                        'Configure settings according to requirements',
                        'Test configuration thoroughly'
                    ],
                    warnings: ['Test in development environment first'],
                    estimatedTime: '15 minutes'
                }
            ],
            verificationGuide: this.generateGenericVerification(requirement),
            troubleshooting: [
                {
                    issue: 'Configuration not found',
                    solution: 'Check ServiceNow documentation or contact system administrator'
                }
            ],
            relatedDocuments: ['ServiceNow Product Documentation', 'Internal Configuration Standards']
        };
    }
    static generateGenericVerification(requirement) {
        return [
            `Verify ${requirement.name} appears in the appropriate list`,
            'Test functionality according to requirements',
            'Confirm proper access controls are in place',
            'Document configuration for future reference'
        ];
    }
    static calculateTotalTime(instructions) {
        if (instructions.length === 0)
            return '15 minutes';
        const totalMinutes = instructions.reduce((total, instruction) => {
            const time = instruction.estimatedTime || '5 minutes';
            const minutes = parseInt(time.match(/\d+/)?.[0] || '5');
            return total + minutes;
        }, 0);
        return `${totalMinutes} minutes`;
    }
    static customizeInstructions(instructions, requirement) {
        return instructions.map(instruction => ({
            ...instruction,
            actions: instruction.actions.map(action => action
                .replace('${name}', requirement.name)
                .replace('${description}', requirement.description || requirement.name))
        }));
    }
    static generateBulkOverview(requirements) {
        const typeCount = requirements.reduce((acc, req) => {
            acc[req.type] = (acc[req.type] || 0) + 1;
            return acc;
        }, {});
        const typeSummary = Object.entries(typeCount)
            .map(([type, count]) => `${count} ${type}`)
            .join(', ');
        return `This guide covers manual configuration of ${requirements.length} ServiceNow requirements: ${typeSummary}. Follow the execution order to ensure proper sequencing and dependencies.`;
    }
    static planExecutionOrder(requirements) {
        // Group requirements by logical execution phases
        const phases = [
            {
                phase: 'Foundation Setup',
                types: ['table', 'application', 'system_property', 'database_index'],
                parallelExecution: false
            },
            {
                phase: 'Security Configuration',
                types: ['user_role', 'user_group', 'acl_rule', 'data_policy', 'ldap_config', 'oauth_provider'],
                parallelExecution: true
            },
            {
                phase: 'Core Development',
                types: ['business_rule', 'script_include', 'client_script', 'ui_policy', 'ui_action'],
                parallelExecution: true
            },
            {
                phase: 'User Interface',
                types: ['widget', 'ui_page', 'form_layout', 'form_section', 'application_menu'],
                parallelExecution: true
            },
            {
                phase: 'Workflows and Automation',
                types: ['flow', 'workflow_activity', 'scheduled_job', 'notification_rule', 'event_rule'],
                parallelExecution: true
            },
            {
                phase: 'Integration and Analytics',
                types: ['rest_message', 'web_service', 'performance_analytics', 'report', 'dashboard'],
                parallelExecution: true
            }
        ];
        return phases
            .map(phase => {
            const phaseRequirements = requirements.filter(req => phase.types.includes(req.type));
            if (phaseRequirements.length === 0)
                return null;
            const totalTime = phaseRequirements.length * 10; // Estimate 10 min per requirement
            const estimatedTime = phase.parallelExecution
                ? `${Math.max(10, totalTime / 3)} minutes (parallel)`
                : `${totalTime} minutes (sequential)`;
            return {
                phase: phase.phase,
                requirements: phaseRequirements,
                parallelExecution: phase.parallelExecution,
                estimatedTime
            };
        })
            .filter(Boolean);
    }
    static identifyOverallRisks(guides) {
        const risks = [];
        const highRiskCount = guides.filter(g => g.riskLevel === 'high').length;
        if (highRiskCount > 0) {
            risks.push(`${highRiskCount} high-risk configurations require extra caution`);
        }
        const securityConfigs = guides.filter(g => ['ldap_config', 'oauth_provider', 'saml_config', 'acl_rule'].includes(g.requirement.type)).length;
        if (securityConfigs > 0) {
            risks.push(`${securityConfigs} security configurations may affect user access`);
        }
        const databaseConfigs = guides.filter(g => ['database_index', 'table', 'database_view'].includes(g.requirement.type)).length;
        if (databaseConfigs > 0) {
            risks.push(`${databaseConfigs} database configurations may impact performance`);
        }
        return risks;
    }
    static generateCoordinationNotes(requirements) {
        const notes = [];
        // Check for common coordination scenarios
        const hasTableAndBR = requirements.some(r => r.type === 'table') &&
            requirements.some(r => r.type === 'business_rule');
        if (hasTableAndBR) {
            notes.push('Create tables before business rules to ensure proper field references');
        }
        const hasUserAndGroup = requirements.some(r => r.type === 'user_account') &&
            requirements.some(r => r.type === 'user_group');
        if (hasUserAndGroup) {
            notes.push('Create user groups before individual user accounts for proper role assignment');
        }
        const hasFlowAndCatalog = requirements.some(r => r.type === 'flow') &&
            requirements.some(r => r.type === 'catalog_item');
        if (hasFlowAndCatalog) {
            notes.push('Test flows independently before linking to catalog items');
        }
        return notes;
    }
    static generateRelatedDocuments(requirementType) {
        const docMap = {
            'system_property': ['System Properties Documentation', 'Configuration Management Guide'],
            'database_index': ['Database Administration Guide', 'Performance Tuning Documentation'],
            'ldap_config': ['LDAP Integration Guide', 'Authentication Configuration'],
            'oauth_provider': ['OAuth Configuration Guide', 'Security Best Practices'],
            'performance_analytics': ['PA Implementation Guide', 'Dashboard Design Standards'],
            'workflow_activity': ['Workflow Development Guide', 'Process Design Documentation']
        };
        return docMap[requirementType] || ['ServiceNow Product Documentation', 'Implementation Best Practices'];
    }
}
exports.ManualInstructionsGenerator = ManualInstructionsGenerator;
//# sourceMappingURL=manual-instructions-generator.js.map