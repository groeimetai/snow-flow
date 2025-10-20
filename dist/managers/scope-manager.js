"use strict";
/**
 * Scope Manager for ServiceNow Artifact Deployment
 *
 * Centralized management of deployment scopes, providing intelligent
 * scope selection and management capabilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScopeManager = void 0;
const global_scope_strategy_js_1 = require("../strategies/global-scope-strategy.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const logger_js_1 = require("../utils/logger.js");
class ScopeManager {
    constructor(options = {}) {
        this.scopeCache = new Map();
        this.strategy = new global_scope_strategy_js_1.GlobalScopeStrategy();
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.logger = new logger_js_1.Logger('ScopeManager');
        this.options = {
            defaultScope: global_scope_strategy_js_1.ScopeType.GLOBAL,
            allowFallback: true,
            validatePermissions: true,
            enableMigration: false,
            ...options
        };
        this.logger.info('ScopeManager initialized', { options: this.options });
    }
    /**
     * Make intelligent scope decision based on context
     */
    async makeScopeDecision(context) {
        const cacheKey = this.generateCacheKey(context);
        // Check cache first
        if (this.scopeCache.has(cacheKey)) {
            const cached = this.scopeCache.get(cacheKey);
            this.logger.info('Using cached scope decision', { selectedScope: cached.selectedScope });
            return cached;
        }
        this.logger.info('Making scope decision', {
            artifactType: context.artifactType,
            artifactName: context.artifactData.name,
            environmentType: context.environmentType
        });
        // Step 1: Analyze artifact requirements
        const scopeConfig = await this.strategy.analyzeScopeRequirements(context.artifactType, context.artifactData);
        // Step 2: Apply user preferences and project scope
        const adjustedConfig = this.applyUserPreferences(scopeConfig, context);
        // Step 3: Validate permissions if enabled
        let validationResult = { isValid: true, issues: [], warnings: [] };
        if (this.options.validatePermissions) {
            validationResult = await this.strategy.validateScopePermissions(adjustedConfig);
        }
        // Step 4: Make final decision
        const decision = this.makeFinalDecision(adjustedConfig, validationResult, context);
        // Step 5: Cache the decision
        this.scopeCache.set(cacheKey, decision);
        this.logger.info('Scope decision made', {
            selectedScope: decision.selectedScope,
            confidence: decision.confidence,
            rationale: decision.rationale
        });
        return decision;
    }
    /**
     * Deploy artifact using intelligent scope management
     */
    async deployWithScopeManagement(context) {
        this.logger.info('Starting scope-managed deployment', {
            artifactType: context.artifactType,
            artifactName: context.artifactData.name
        });
        // Make scope decision
        const decision = await this.makeScopeDecision(context);
        // Prepare deployment configuration
        const deploymentConfig = {
            type: decision.selectedScope,
            fallbackToGlobal: this.options.allowFallback && decision.fallbackScope !== undefined,
            permissions: decision.validationResult.permissions || []
        };
        // Add environment-specific configurations
        if (context.environmentType === 'production') {
            deploymentConfig.permissions?.push('production_deployment');
        }
        // Add compliance requirements
        if (context.complianceRequirements) {
            deploymentConfig.permissions?.push(...context.complianceRequirements);
        }
        // Execute deployment
        const result = await this.strategy.deployWithGlobalScope(context.artifactType, context.artifactData, deploymentConfig);
        // Log deployment outcome
        this.logger.info('Scope-managed deployment completed', {
            success: result.success,
            actualScope: result.scope,
            fallbackApplied: result.fallbackApplied
        });
        return result;
    }
    /**
     * Migrate existing artifacts to optimal scope
     */
    async migrateArtifactsToOptimalScope(artifacts) {
        if (!this.options.enableMigration) {
            throw new Error('Migration is not enabled in scope manager options');
        }
        this.logger.info('Starting artifact migration', { count: artifacts.length });
        const migrationResults = {
            totalArtifacts: artifacts.length,
            successful: 0,
            failed: 0,
            skipped: 0,
            details: []
        };
        for (const artifact of artifacts) {
            try {
                const context = {
                    artifactType: artifact.sys_class_name || artifact.type,
                    artifactData: artifact,
                    environmentType: 'development' // Safe default for migration
                };
                const decision = await this.makeScopeDecision(context);
                // Only migrate if the optimal scope is different from current
                if (this.shouldMigrateArtifact(artifact, decision)) {
                    const migrationResult = await this.migrateArtifact(artifact, decision);
                    migrationResults.details.push(migrationResult);
                    if (migrationResult.success) {
                        migrationResults.successful++;
                    }
                    else {
                        migrationResults.failed++;
                    }
                }
                else {
                    migrationResults.skipped++;
                    migrationResults.details.push({
                        artifactId: artifact.sys_id,
                        name: artifact.name,
                        currentScope: artifact.sys_scope,
                        recommendedScope: decision.selectedScope,
                        action: 'skipped',
                        reason: 'Already in optimal scope'
                    });
                }
            }
            catch (error) {
                migrationResults.failed++;
                migrationResults.details.push({
                    artifactId: artifact.sys_id,
                    name: artifact.name,
                    action: 'failed',
                    error: error instanceof Error ? error.message : String(error)
                });
            }
        }
        this.logger.info('Migration completed', {
            successful: migrationResults.successful,
            failed: migrationResults.failed,
            skipped: migrationResults.skipped
        });
        return migrationResults;
    }
    /**
     * Get scope recommendations for a project
     */
    async getProjectScopeRecommendations(projectArtifacts) {
        this.logger.info('Generating project scope recommendations', {
            artifactCount: projectArtifacts.length
        });
        const recommendations = {
            overallScope: global_scope_strategy_js_1.ScopeType.GLOBAL,
            confidence: 0,
            artifactBreakdown: {
                global: 0,
                application: 0,
                mixed: 0
            },
            recommendations: [],
            risks: [],
            benefits: []
        };
        const decisions = [];
        // Analyze each artifact
        for (const artifact of projectArtifacts) {
            const context = {
                artifactType: artifact.sys_class_name || artifact.type,
                artifactData: artifact
            };
            const decision = await this.makeScopeDecision(context);
            decisions.push(decision);
            if (decision.selectedScope === global_scope_strategy_js_1.ScopeType.GLOBAL) {
                recommendations.artifactBreakdown.global++;
            }
            else if (decision.selectedScope === global_scope_strategy_js_1.ScopeType.APPLICATION) {
                recommendations.artifactBreakdown.application++;
            }
            else {
                recommendations.artifactBreakdown.mixed++;
            }
        }
        // Calculate overall recommendation
        const globalRatio = recommendations.artifactBreakdown.global / projectArtifacts.length;
        const applicationRatio = recommendations.artifactBreakdown.application / projectArtifacts.length;
        if (globalRatio > 0.6) {
            recommendations.overallScope = global_scope_strategy_js_1.ScopeType.GLOBAL;
            recommendations.confidence = globalRatio;
            recommendations.recommendations.push('Deploy entire project to global scope for consistency');
            recommendations.benefits.push('Simplified deployment and maintenance');
            recommendations.benefits.push('Better cross-application integration');
        }
        else if (applicationRatio > 0.6) {
            recommendations.overallScope = global_scope_strategy_js_1.ScopeType.APPLICATION;
            recommendations.confidence = applicationRatio;
            recommendations.recommendations.push('Deploy project to dedicated application scope');
            recommendations.benefits.push('Better isolation and security');
            recommendations.benefits.push('Easier application lifecycle management');
        }
        else {
            recommendations.overallScope = global_scope_strategy_js_1.ScopeType.AUTO;
            recommendations.confidence = 0.5;
            recommendations.recommendations.push('Use mixed scope strategy - deploy artifacts to optimal individual scopes');
            recommendations.risks.push('Mixed scope may complicate maintenance');
        }
        // Add specific recommendations
        if (recommendations.artifactBreakdown.global > 0) {
            recommendations.recommendations.push('Ensure global scope permissions are available');
        }
        if (recommendations.artifactBreakdown.application > 0) {
            recommendations.recommendations.push('Consider creating dedicated application scope');
        }
        return recommendations;
    }
    /**
     * Validate scope configuration
     */
    async validateScopeConfiguration(config) {
        this.logger.info('Validating scope configuration', { type: config.type });
        const validation = {
            isValid: true,
            issues: [],
            warnings: [],
            recommendations: []
        };
        // Validate scope type
        if (!Object.values(global_scope_strategy_js_1.ScopeType).includes(config.type)) {
            validation.isValid = false;
            validation.issues.push(`Invalid scope type: ${config.type}`);
        }
        // Validate application scope requirements
        if (config.type === global_scope_strategy_js_1.ScopeType.APPLICATION) {
            if (!config.applicationId && !config.applicationName) {
                validation.warnings.push('Application scope specified but no application ID or name provided');
            }
        }
        // Validate permissions
        if (config.permissions && config.permissions.length > 0) {
            const permissionValidation = await this.validatePermissions(config.permissions);
            if (!permissionValidation.isValid) {
                validation.isValid = false;
                validation.issues.push(...permissionValidation.issues);
            }
        }
        // Validate global domain
        if (config.type === global_scope_strategy_js_1.ScopeType.GLOBAL && config.globalDomain !== 'global') {
            validation.warnings.push('Global scope should use "global" domain');
        }
        return validation;
    }
    /**
     * Clear scope cache
     */
    clearScopeCache() {
        this.scopeCache.clear();
        this.logger.info('Scope cache cleared');
    }
    /**
     * Get scope statistics
     */
    getScopeStatistics() {
        const stats = {
            cacheSize: this.scopeCache.size,
            scopeDistribution: {
                global: 0,
                application: 0,
                auto: 0
            },
            averageConfidence: 0
        };
        let totalConfidence = 0;
        for (const decision of this.scopeCache.values()) {
            totalConfidence += decision.confidence;
            if (decision.selectedScope === global_scope_strategy_js_1.ScopeType.GLOBAL) {
                stats.scopeDistribution.global++;
            }
            else if (decision.selectedScope === global_scope_strategy_js_1.ScopeType.APPLICATION) {
                stats.scopeDistribution.application++;
            }
            else {
                stats.scopeDistribution.auto++;
            }
        }
        stats.averageConfidence = this.scopeCache.size > 0 ? totalConfidence / this.scopeCache.size : 0;
        return stats;
    }
    /**
     * Private helper methods
     */
    generateCacheKey(context) {
        return `${context.artifactType}:${context.artifactData.name}:${context.environmentType || 'default'}`;
    }
    applyUserPreferences(config, context) {
        if (!context.userPreferences) {
            return config;
        }
        // Override with user preferences
        return {
            ...config,
            ...context.userPreferences
        };
    }
    makeFinalDecision(config, validation, context) {
        let selectedScope = config.type;
        let confidence = 0.8;
        let rationale = 'Based on artifact _analysis';
        let fallbackScope;
        // Apply validation results
        if (!validation.isValid) {
            if (validation.canCreateGlobal && config.type === global_scope_strategy_js_1.ScopeType.APPLICATION) {
                selectedScope = global_scope_strategy_js_1.ScopeType.GLOBAL;
                fallbackScope = global_scope_strategy_js_1.ScopeType.APPLICATION;
                confidence = 0.6;
                rationale = 'Fallback to global scope due to permission issues';
            }
            else if (validation.canCreateScoped && config.type === global_scope_strategy_js_1.ScopeType.GLOBAL) {
                selectedScope = global_scope_strategy_js_1.ScopeType.APPLICATION;
                fallbackScope = global_scope_strategy_js_1.ScopeType.GLOBAL;
                confidence = 0.6;
                rationale = 'Fallback to application scope due to permission issues';
            }
            else {
                confidence = 0.3;
                rationale = 'Limited options due to permission constraints';
            }
        }
        // Apply environment-specific rules
        if (context.environmentType === 'production') {
            // Production deployments prefer global scope for stability
            if (selectedScope === global_scope_strategy_js_1.ScopeType.APPLICATION && validation.canCreateGlobal) {
                selectedScope = global_scope_strategy_js_1.ScopeType.GLOBAL;
                confidence = Math.max(confidence, 0.7);
                rationale += ' (production environment preference)';
            }
        }
        // Apply project scope preferences
        if (context.projectScope) {
            if (context.projectScope === global_scope_strategy_js_1.ScopeType.GLOBAL && validation.canCreateGlobal) {
                selectedScope = global_scope_strategy_js_1.ScopeType.GLOBAL;
                confidence = Math.max(confidence, 0.8);
                rationale += ' (project scope preference)';
            }
            else if (context.projectScope === global_scope_strategy_js_1.ScopeType.APPLICATION && validation.canCreateScoped) {
                selectedScope = global_scope_strategy_js_1.ScopeType.APPLICATION;
                confidence = Math.max(confidence, 0.8);
                rationale += ' (project scope preference)';
            }
        }
        const recommendations = [];
        // Generate recommendations
        if (confidence < 0.5) {
            recommendations.push('Consider reviewing permissions or scope configuration');
        }
        if (fallbackScope) {
            recommendations.push(`Consider ${fallbackScope} scope as alternative`);
        }
        if (validation.warnings && validation.warnings.length > 0) {
            recommendations.push(...validation.warnings);
        }
        return {
            selectedScope,
            confidence,
            rationale,
            fallbackScope,
            validationResult: validation,
            recommendations
        };
    }
    shouldMigrateArtifact(artifact, decision) {
        const currentScope = artifact.sys_scope;
        const recommendedScope = decision.selectedScope;
        // Don't migrate if confidence is too low
        if (decision.confidence < 0.7) {
            return false;
        }
        // Don't migrate if already in optimal scope
        if (currentScope === 'global' && recommendedScope === global_scope_strategy_js_1.ScopeType.GLOBAL) {
            return false;
        }
        if (currentScope !== 'global' && recommendedScope === global_scope_strategy_js_1.ScopeType.APPLICATION) {
            return false;
        }
        return true;
    }
    async migrateArtifact(artifact, decision) {
        // This is a simplified migration - in practice, this would involve
        // complex operations like dependency checking, data migration, etc.
        const migrationResult = {
            artifactId: artifact.sys_id,
            name: artifact.name,
            currentScope: artifact.sys_scope,
            targetScope: decision.selectedScope,
            success: false,
            action: 'migrate',
            details: {}
        };
        try {
            // Create new artifact in target scope
            const newArtifactData = {
                ...artifact,
                sys_scope: decision.selectedScope === global_scope_strategy_js_1.ScopeType.GLOBAL ? 'global' : decision.selectedScope,
                name: `${artifact.name}_migrated`
                // 🔧 TEST-001 FIX: Remove sys_id property instead of setting to undefined
                // This prevents "sys_id undefined" errors in testing tools
            };
            // 🔧 TEST-001 FIX: Explicitly delete sys_id so ServiceNow generates a new one
            delete newArtifactData.sys_id;
            const deploymentResult = await this.strategy.deployWithGlobalScope(artifact.sys_class_name || artifact.type, newArtifactData, { type: decision.selectedScope });
            migrationResult.success = deploymentResult.success;
            migrationResult.details = deploymentResult;
            // In a real implementation, you would also:
            // 1. Update references to the old artifact
            // 2. Deactivate or delete the old artifact
            // 3. Verify the migration worked correctly
        }
        catch (error) {
            migrationResult.success = false;
            migrationResult.details = { error: error instanceof Error ? error.message : String(error) };
        }
        return migrationResult;
    }
    async validatePermissions(permissions) {
        // Simplified permission validation
        // In practice, this would check actual ServiceNow permissions
        return {
            isValid: true,
            issues: [],
            warnings: []
        };
    }
}
exports.ScopeManager = ScopeManager;
//# sourceMappingURL=scope-manager.js.map