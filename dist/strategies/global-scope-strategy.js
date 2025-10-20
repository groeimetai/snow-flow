"use strict";
/**
 * Global Scope Strategy for ServiceNow Flow Creation
 *
 * This strategy implements a global scope approach for ServiceNow artifacts,
 * replacing the current application-scoped approach with a more flexible
 * global scope deployment model.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalScopeStrategy = exports.ScopeType = void 0;
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const logger_js_1 = require("../utils/logger.js");
var ScopeType;
(function (ScopeType) {
    ScopeType["GLOBAL"] = "global";
    ScopeType["APPLICATION"] = "application";
    ScopeType["AUTO"] = "auto";
})(ScopeType || (exports.ScopeType = ScopeType = {}));
class GlobalScopeStrategy {
    constructor() {
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        this.logger = new logger_js_1.Logger('GlobalScopeStrategy');
        // Default configuration prioritizes global scope
        this.defaultConfiguration = {
            type: ScopeType.GLOBAL,
            globalDomain: 'global',
            fallbackToGlobal: true,
            permissions: ['sys_scope.write', 'sys_metadata.write']
        };
    }
    /**
     * Analyze and determine the optimal scope for deployment
     */
    async analyzeScopeRequirements(artifactType, artifactData) {
        this.logger.info('Analyzing scope requirements', { artifactType, artifactData: artifactData.name });
        const scopeConfig = { ...this.defaultConfiguration };
        // Analyze artifact complexity and dependencies
        const complexity = this.assessArtifactComplexity(artifactType, artifactData);
        const dependencies = await this.analyzeDependencies(artifactType, artifactData);
        const permissions = await this.checkRequiredPermissions(artifactType);
        // Global scope is preferred for:
        // 1. System-wide flows and utilities
        // 2. Cross-application integrations
        // 3. Infrastructure components
        // 4. Shared libraries and common functions
        const globalScopeIndicators = [
            artifactData.name?.toLowerCase().includes('global'),
            artifactData.name?.toLowerCase().includes('system'),
            artifactData.name?.toLowerCase().includes('util'),
            artifactData.description?.toLowerCase().includes('cross-application'),
            artifactData.description?.toLowerCase().includes('shared'),
            complexity.isInfrastructure,
            dependencies.crossApplication,
            artifactType === 'script_include' && artifactData.api_name?.includes('Global'),
            artifactType === 'business_rule' && artifactData.table === 'global'
        ];
        const globalIndicatorCount = globalScopeIndicators.filter(Boolean).length;
        // Application scope is preferred for:
        // 1. Application-specific business logic
        // 2. Isolated functionality
        // 3. Customer-specific customizations
        const applicationScopeIndicators = [
            artifactData.scope && artifactData.scope !== 'global',
            artifactData.application_specific === true,
            complexity.isApplicationSpecific,
            !dependencies.crossApplication,
            artifactData.name?.toLowerCase().includes('custom'),
            artifactData.description?.toLowerCase().includes('application-specific')
        ];
        const applicationIndicatorCount = applicationScopeIndicators.filter(Boolean).length;
        // Decision logic
        if (globalIndicatorCount > applicationIndicatorCount) {
            scopeConfig.type = ScopeType.GLOBAL;
            scopeConfig.globalDomain = 'global';
            this.logger.info('Global scope recommended', {
                globalIndicators: globalIndicatorCount,
                applicationIndicators: applicationIndicatorCount
            });
        }
        else if (applicationIndicatorCount > globalIndicatorCount && artifactData.scope) {
            scopeConfig.type = ScopeType.APPLICATION;
            scopeConfig.applicationId = artifactData.scope;
            scopeConfig.applicationName = artifactData.application_name;
            this.logger.info('Application scope recommended', {
                scope: artifactData.scope,
                applicationIndicators: applicationIndicatorCount
            });
        }
        else {
            // Auto mode - let the system decide based on permissions and context
            scopeConfig.type = ScopeType.AUTO;
            this.logger.info('Auto scope mode selected - will determine at deployment time');
        }
        scopeConfig.permissions = permissions;
        return scopeConfig;
    }
    /**
     * Validate scope permissions and capabilities
     */
    async validateScopePermissions(scopeConfig) {
        this.logger.info('Validating scope permissions', { scopeType: scopeConfig.type });
        const result = {
            isValid: false,
            hasPermissions: false,
            canCreateGlobal: false,
            canCreateScoped: false,
            recommendedScope: ScopeType.GLOBAL,
            issues: [],
            warnings: []
        };
        try {
            // Check if user has global scope permissions
            const globalPermissions = await this.checkGlobalScopePermissions();
            result.canCreateGlobal = globalPermissions.hasPermission;
            if (!globalPermissions.hasPermission) {
                result.issues.push(...globalPermissions.issues);
                result.warnings.push('Global scope permissions not available - consider using application scope');
            }
            // Check if user has application scope permissions
            const applicationPermissions = await this.checkApplicationScopePermissions(scopeConfig.applicationId);
            result.canCreateScoped = applicationPermissions.hasPermission;
            if (!applicationPermissions.hasPermission) {
                result.issues.push(...applicationPermissions.issues);
            }
            // Determine validity and recommendation
            if (scopeConfig.type === ScopeType.GLOBAL) {
                result.isValid = result.canCreateGlobal;
                result.hasPermissions = result.canCreateGlobal;
                result.recommendedScope = result.canCreateGlobal ? ScopeType.GLOBAL : ScopeType.APPLICATION;
            }
            else if (scopeConfig.type === ScopeType.APPLICATION) {
                result.isValid = result.canCreateScoped;
                result.hasPermissions = result.canCreateScoped;
                result.recommendedScope = result.canCreateScoped ? ScopeType.APPLICATION : ScopeType.GLOBAL;
            }
            else {
                // Auto mode - prefer global if available, fallback to application
                result.isValid = result.canCreateGlobal || result.canCreateScoped;
                result.hasPermissions = result.canCreateGlobal || result.canCreateScoped;
                result.recommendedScope = result.canCreateGlobal ? ScopeType.GLOBAL : ScopeType.APPLICATION;
            }
            if (!result.isValid) {
                result.issues.push('Insufficient permissions for any scope type');
            }
            this.logger.info('Scope validation completed', {
                isValid: result.isValid,
                canCreateGlobal: result.canCreateGlobal,
                canCreateScoped: result.canCreateScoped,
                recommendedScope: result.recommendedScope
            });
        }
        catch (error) {
            this.logger.error('Scope validation failed', error);
            result.issues.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
        }
        return result;
    }
    /**
     * Deploy artifact using global scope strategy
     */
    async deployWithGlobalScope(artifactType, artifactData, scopeConfig) {
        this.logger.info('Starting global scope deployment', {
            artifactType,
            artifactName: artifactData.name,
            scopeType: scopeConfig?.type || 'default'
        });
        const config = scopeConfig || await this.analyzeScopeRequirements(artifactType, artifactData);
        const validation = await this.validateScopePermissions(config);
        if (!validation.isValid) {
            return {
                success: false,
                scope: config.type,
                domain: config.globalDomain || 'unknown',
                artifactId: '',
                permissions: config.permissions || [],
                message: `Deployment failed: ${validation.issues.join(', ')}`,
                warnings: validation.warnings
            };
        }
        try {
            // Apply the appropriate scope strategy
            let deploymentResult;
            let actualScope;
            if (config.type === ScopeType.GLOBAL || validation.recommendedScope === ScopeType.GLOBAL) {
                deploymentResult = await this.deployToGlobalScope(artifactType, artifactData, config);
                actualScope = ScopeType.GLOBAL;
            }
            else if (config.type === ScopeType.APPLICATION || validation.recommendedScope === ScopeType.APPLICATION) {
                deploymentResult = await this.deployToApplicationScope(artifactType, artifactData, config);
                actualScope = ScopeType.APPLICATION;
            }
            else {
                // Auto mode - try global first, fallback to application
                try {
                    deploymentResult = await this.deployToGlobalScope(artifactType, artifactData, config);
                    actualScope = ScopeType.GLOBAL;
                }
                catch (error) {
                    if (config.fallbackToGlobal) {
                        this.logger.warn('Global scope deployment failed, falling back to application scope', error);
                        deploymentResult = await this.deployToApplicationScope(artifactType, artifactData, config);
                        actualScope = ScopeType.APPLICATION;
                    }
                    else {
                        throw error;
                    }
                }
            }
            return {
                success: deploymentResult.success,
                scope: actualScope,
                domain: actualScope === ScopeType.GLOBAL ? 'global' : (config.applicationName || 'application'),
                artifactId: deploymentResult.sys_id || deploymentResult.id,
                permissions: config.permissions || [],
                message: `Successfully deployed to ${actualScope} scope`,
                warnings: validation.warnings,
                fallbackApplied: config.type !== actualScope
            };
        }
        catch (error) {
            this.logger.error('Global scope deployment failed', error);
            return {
                success: false,
                scope: config.type,
                domain: config.globalDomain || 'global',
                artifactId: '',
                permissions: config.permissions || [],
                message: `Deployment failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Deploy artifact to global scope
     */
    async deployToGlobalScope(artifactType, artifactData, config) {
        this.logger.info('Deploying to global scope', { artifactType, name: artifactData.name });
        // Set global scope context
        const globalArtifactData = {
            ...artifactData,
            sys_scope: 'global',
            sys_domain: 'global',
            sys_domain_path: '/',
            application: null, // Remove application association
            scope: 'global'
        };
        // Remove application-specific fields
        delete globalArtifactData.application_id;
        delete globalArtifactData.application_name;
        delete globalArtifactData.vendor;
        delete globalArtifactData.vendor_prefix;
        // Add global scope metadata
        globalArtifactData.sys_created_on = new Date().toISOString();
        globalArtifactData.sys_updated_on = new Date().toISOString();
        globalArtifactData.sys_class_name = this.getSystemClassName(artifactType);
        // Deploy based on artifact type
        switch (artifactType) {
            case 'flow':
                return await this.deployFlowToGlobalScope(globalArtifactData);
            case 'widget':
                return await this.deployWidgetToGlobalScope(globalArtifactData);
            case 'script_include':
                return await this.deployScriptIncludeToGlobalScope(globalArtifactData);
            case 'business_rule':
                return await this.deployBusinessRuleToGlobalScope(globalArtifactData);
            case 'table':
                return await this.deployTableToGlobalScope(globalArtifactData);
            default:
                throw new Error(`Unsupported artifact type for global scope: ${artifactType}`);
        }
    }
    /**
     * Deploy artifact to application scope (fallback)
     */
    async deployToApplicationScope(artifactType, artifactData, config) {
        this.logger.info('Deploying to application scope', {
            artifactType,
            name: artifactData.name,
            applicationId: config.applicationId
        });
        // If no application is specified, create one
        if (!config.applicationId) {
            const application = await this.createTemporaryApplication(artifactData.name);
            config.applicationId = application.sys_id;
            config.applicationName = application.name;
        }
        // Set application scope context
        const scopedArtifactData = {
            ...artifactData,
            sys_scope: config.applicationId,
            application: config.applicationId,
            scope: config.applicationId
        };
        // Use existing application deployment logic
        return await this.client.createRecord(this.getTableName(artifactType), scopedArtifactData);
    }
    /**
     * Deploy flow to global scope
     */
    async deployFlowToGlobalScope(flowData) {
        this.logger.info('Deploying flow to global scope', { name: flowData.name });
        // Enhanced flow data for global scope
        const globalFlowData = {
            ...flowData,
            // Global scope specific fields
            sys_scope: 'global',
            run_as: 'user_who_triggers', // Global flows typically run as triggering user
            access: 'public', // Global access
            source_ui: 'flow_designer',
            // Remove application-specific constraints
            application: null,
            category: flowData.category || 'global_automation',
            // Enhanced metadata
            sys_class_name: 'sys_hub_flow',
            type: 'flow',
            status: 'published'
        };
        // Ensure we're creating a flow, not a subflow
        globalFlowData.flow_type = 'flow';
        globalFlowData.sys_class_name = 'sys_hub_flow';
        this.logger.info('Creating flow with explicit type', {
            name: globalFlowData.name,
            type: globalFlowData.type,
            flow_type: globalFlowData.flow_type,
            sys_class_name: globalFlowData.sys_class_name
        });
        return await this.client.createFlow(globalFlowData);
    }
    /**
     * Deploy widget to global scope
     */
    async deployWidgetToGlobalScope(widgetData) {
        this.logger.info('Deploying widget to global scope', { name: widgetData.name });
        const globalWidgetData = {
            ...widgetData,
            sys_scope: 'global',
            category: widgetData.category || 'global_widgets',
            has_preview: true,
            public: true // Global widgets are public
        };
        return await this.client.createWidget(globalWidgetData);
    }
    /**
     * Deploy script include to global scope
     */
    async deployScriptIncludeToGlobalScope(scriptData) {
        this.logger.info('Deploying script include to global scope', { name: scriptData.name });
        const globalScriptData = {
            ...scriptData,
            sys_scope: 'global',
            access: 'public', // Global script includes are typically public
            active: true,
            api_name: scriptData.api_name || scriptData.name
        };
        return await this.client.createScriptInclude(globalScriptData);
    }
    /**
     * Deploy business rule to global scope
     */
    async deployBusinessRuleToGlobalScope(ruleData) {
        this.logger.info('Deploying business rule to global scope', { name: ruleData.name });
        const globalRuleData = {
            ...ruleData,
            sys_scope: 'global',
            active: true,
            order: ruleData.order || 100
        };
        return await this.client.createBusinessRule(globalRuleData);
    }
    /**
     * Deploy table to global scope
     */
    async deployTableToGlobalScope(tableData) {
        this.logger.info('Deploying table to global scope', { name: tableData.name });
        const globalTableData = {
            ...tableData,
            sys_scope: 'global',
            access: 'public',
            is_extendable: true,
            create_access_controls: true
        };
        return await this.client.createTable(globalTableData);
    }
    /**
     * Check global scope permissions
     */
    async checkGlobalScopePermissions() {
        try {
            // Check if user can create global scope artifacts
            const userRoles = await this.client.getRecords('sys_user_has_role', {
                sysparm_query: `user=javascript:gs.getUserID()`,
                sysparm_fields: 'role.name'
            });
            if (!userRoles.success) {
                return { hasPermission: false, issues: ['Cannot check user roles'] };
            }
            const roles = userRoles.data.map((r) => r.role?.name).filter(Boolean);
            const globalPermissionRoles = ['admin', 'system_administrator', 'global_admin'];
            const hasGlobalPermission = globalPermissionRoles.some(role => roles.includes(role));
            return {
                hasPermission: hasGlobalPermission,
                issues: hasGlobalPermission ? [] : [
                    '🔐 Permission Error: Global scope access required',
                    `Missing roles: ${globalPermissionRoles.filter(r => !roles.includes(r)).join(', ')}`,
                    'To fix:',
                    '1. Run: snow_escalate_permissions tool for detailed instructions',
                    '2. Or contact your ServiceNow administrator',
                    '3. Or use a personal developer instance from developer.servicenow.com'
                ]
            };
        }
        catch (error) {
            return {
                hasPermission: false,
                issues: [`Permission check failed: ${error instanceof Error ? error.message : String(error)}`]
            };
        }
    }
    /**
     * Check application scope permissions
     */
    async checkApplicationScopePermissions(applicationId) {
        try {
            if (!applicationId) {
                // User can create applications if they have app_creator or admin role
                const userRoles = await this.client.getRecords('sys_user_has_role', {
                    sysparm_query: `user=javascript:gs.getUserID()`,
                    sysparm_fields: 'role.name'
                });
                if (!userRoles.success) {
                    return { hasPermission: false, issues: ['Cannot check user roles'] };
                }
                const roles = userRoles.data.map((r) => r.role?.name).filter(Boolean);
                const appCreatorRoles = ['admin', 'system_administrator', 'app_creator'];
                const hasAppPermission = appCreatorRoles.some(role => roles.includes(role));
                return {
                    hasPermission: hasAppPermission,
                    issues: hasAppPermission ? [] : ['User lacks application creation permissions (admin, system_administrator, or app_creator role required)']
                };
            }
            // Check if application exists and user has access
            const app = await this.client.getRecord('sys_app', applicationId);
            return {
                hasPermission: !!app,
                issues: app ? [] : [`Application ${applicationId} not found or not accessible`]
            };
        }
        catch (error) {
            return {
                hasPermission: false,
                issues: [`Permission check failed: ${error instanceof Error ? error.message : String(error)}`]
            };
        }
    }
    /**
     * Assess artifact complexity for scope decision
     */
    assessArtifactComplexity(artifactType, artifactData) {
        const complexity = {
            isInfrastructure: false,
            isApplicationSpecific: false,
            crossApplication: false,
            sharedUtility: false
        };
        // Infrastructure indicators
        const infraKeywords = ['system', 'global', 'util', 'lib', 'common', 'shared', 'infrastructure'];
        const artifactText = `${artifactData.name} ${artifactData.description || ''}`.toLowerCase();
        complexity.isInfrastructure = infraKeywords.some(keyword => artifactText.includes(keyword));
        // Application-specific indicators
        const appKeywords = ['custom', 'specific', 'application', 'business', 'process'];
        complexity.isApplicationSpecific = appKeywords.some(keyword => artifactText.includes(keyword));
        // Cross-application indicators
        const crossAppKeywords = ['integration', 'cross', 'bridge', 'connector', 'api'];
        complexity.crossApplication = crossAppKeywords.some(keyword => artifactText.includes(keyword));
        // Shared utility indicators
        const utilityKeywords = ['utility', 'helper', 'tool', 'function', 'method'];
        complexity.sharedUtility = utilityKeywords.some(keyword => artifactText.includes(keyword));
        return complexity;
    }
    /**
     * Analyze artifact dependencies
     */
    async analyzeDependencies(artifactType, artifactData) {
        const dependencies = {
            crossApplication: false,
            globalDependencies: [],
            applicationDependencies: []
        };
        // Simple dependency _analysis based on artifact content
        const content = JSON.stringify(artifactData);
        // Check for global API calls
        const globalApiPatterns = [
            /gs\./g, // GlideSystem calls
            /GlideRecord\(/g, // Database access
            /gs\.getProperty\(/g, // System properties
            /gs\.log\(/g // System logging
        ];
        const hasGlobalApis = globalApiPatterns.some(pattern => pattern.test(content));
        if (hasGlobalApis) {
            dependencies.crossApplication = true;
            dependencies.globalDependencies.push('system_apis');
        }
        return dependencies;
    }
    /**
     * Check required permissions for artifact type
     */
    async checkRequiredPermissions(artifactType) {
        const permissionMap = {
            'flow': ['sys_hub_flow.write', 'sys_metadata.write'],
            'widget': ['sp_widget.write', 'sys_metadata.write'],
            'script_include': ['sys_script_include.write', 'sys_metadata.write'],
            'business_rule': ['sys_script.write', 'sys_metadata.write'],
            'table': ['sys_db_object.write', 'sys_metadata.write']
        };
        return permissionMap[artifactType] || ['sys_metadata.write'];
    }
    /**
     * Create temporary application for scoped deployment
     */
    async createTemporaryApplication(baseName) {
        const applicationData = {
            name: `Temp App for ${baseName}`,
            scope: `x_temp_${Date.now()}`,
            version: '1.0.0',
            short_description: `Temporary application for ${baseName}`,
            description: `Temporary application for scoped deployment of ${baseName}`,
            vendor: 'System',
            vendor_prefix: 'x',
            active: true
        };
        const result = await this.client.createApplication(applicationData);
        if (!result.success) {
            throw new Error(`Failed to create temporary application: ${result.error}`);
        }
        return result.data;
    }
    /**
     * Get system class name for artifact type
     */
    getSystemClassName(artifactType) {
        const classMap = {
            'flow': 'sys_hub_flow',
            'widget': 'sp_widget',
            'script_include': 'sys_script_include',
            'business_rule': 'sys_script',
            'table': 'sys_db_object'
        };
        return classMap[artifactType] || 'sys_metadata';
    }
    /**
     * Get table name for artifact type
     */
    getTableName(artifactType) {
        const tableMap = {
            'flow': 'sys_hub_flow',
            'widget': 'sp_widget',
            'script_include': 'sys_script_include',
            'business_rule': 'sys_script',
            'table': 'sys_db_object'
        };
        return tableMap[artifactType] || 'sys_metadata';
    }
    /**
     * Get migration strategy for existing scoped artifacts
     */
    async getMigrationStrategy(existingArtifacts) {
        this.logger.info('Generating migration strategy', { count: existingArtifacts.length });
        const migrationPlan = {
            totalArtifacts: existingArtifacts.length,
            globalCandidates: [],
            keepScoped: [],
            requiresReview: [],
            estimatedTime: 0,
            risks: [],
            recommendations: []
        };
        for (const artifact of existingArtifacts) {
            const _analysis = await this.analyzeScopeRequirements(artifact.type, artifact);
            if (_analysis.type === ScopeType.GLOBAL) {
                migrationPlan.globalCandidates.push({
                    ...artifact,
                    migrationComplexity: 'low',
                    dependencies: await this.analyzeDependencies(artifact.type, artifact)
                });
            }
            else {
                migrationPlan.keepScoped.push(artifact);
            }
        }
        // Calculate migration complexity and time
        migrationPlan.estimatedTime = migrationPlan.globalCandidates.length * 5; // 5 minutes per artifact
        if (migrationPlan.globalCandidates.length > 10) {
            migrationPlan.risks.push('Large number of artifacts to migrate - consider phased approach');
        }
        migrationPlan.recommendations.push('Test migration in development environment first', 'Backup existing artifacts before migration', 'Monitor for breaking changes after migration');
        return migrationPlan;
    }
}
exports.GlobalScopeStrategy = GlobalScopeStrategy;
//# sourceMappingURL=global-scope-strategy.js.map