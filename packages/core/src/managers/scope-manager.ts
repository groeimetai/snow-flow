/**
 * Scope Manager for ServiceNow Artifact Deployment
 * 
 * Centralized management of deployment scopes, providing intelligent
 * scope selection and management capabilities.
 */

import { GlobalScopeStrategy, ScopeType, ScopeConfiguration, GlobalScopeDeploymentResult } from '../strategies/global-scope-strategy.js';
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { Logger } from '../utils/logger.js';

export interface ScopeManagerOptions {
  defaultScope?: ScopeType;
  allowFallback?: boolean;
  validatePermissions?: boolean;
  enableMigration?: boolean;
}

export interface ScopeDecision {
  selectedScope: ScopeType;
  confidence: number;
  rationale: string;
  fallbackScope?: ScopeType;
  validationResult: any;
  recommendations: string[];
}

export interface DeploymentContext {
  artifactType: string;
  artifactData: any;
  userPreferences?: ScopeConfiguration;
  projectScope?: ScopeType;
  environmentType?: 'development' | 'testing' | 'production';
  complianceRequirements?: string[];
}

export class ScopeManager {
  private strategy: GlobalScopeStrategy;
  private client: ServiceNowClient;
  private logger: Logger;
  private options: ScopeManagerOptions;
  private scopeCache: Map<string, ScopeDecision> = new Map();

  constructor(options: ScopeManagerOptions = {}) {
    this.strategy = new GlobalScopeStrategy();
    this.client = new ServiceNowClient();
    this.logger = new Logger('ScopeManager');
    this.options = {
      defaultScope: ScopeType.GLOBAL,
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
  async makeScopeDecision(context: DeploymentContext): Promise<ScopeDecision> {
    const cacheKey = this.generateCacheKey(context);
    
    // Check cache first
    if (this.scopeCache.has(cacheKey)) {
      const cached = this.scopeCache.get(cacheKey)!;
      this.logger.info('Using cached scope decision', { selectedScope: cached.selectedScope });
      return cached;
    }

    this.logger.info('Making scope decision', { 
      artifactType: context.artifactType,
      artifactName: context.artifactData.name,
      environmentType: context.environmentType
    });

    // Step 1: Analyze artifact requirements
    const scopeConfig = await this.strategy.analyzeScopeRequirements(
      context.artifactType, 
      context.artifactData
    );

    // Step 2: Apply user preferences and project scope
    const adjustedConfig = this.applyUserPreferences(scopeConfig, context);

    // Step 3: Validate permissions if enabled
    let validationResult: any = { isValid: true, issues: [], warnings: [] };
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
  async deployWithScopeManagement(context: DeploymentContext): Promise<GlobalScopeDeploymentResult> {
    this.logger.info('Starting scope-managed deployment', { 
      artifactType: context.artifactType,
      artifactName: context.artifactData.name
    });

    // Make scope decision
    const decision = await this.makeScopeDecision(context);

    // Prepare deployment configuration
    const deploymentConfig: ScopeConfiguration = {
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
    const result = await this.strategy.deployWithGlobalScope(
      context.artifactType,
      context.artifactData,
      deploymentConfig
    );

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
  async migrateArtifactsToOptimalScope(artifacts: any[]): Promise<any> {
    if (!this.options.enableMigration) {
      throw new Error('Migration is not enabled in scope manager options');
    }

    this.logger.info('Starting artifact migration', { count: artifacts.length });

    const migrationResults = {
      totalArtifacts: artifacts.length,
      successful: 0,
      failed: 0,
      skipped: 0,
      details: [] as any[]
    };

    for (const artifact of artifacts) {
      try {
        const context: DeploymentContext = {
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
          } else {
            migrationResults.failed++;
          }
        } else {
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
      } catch (error) {
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
  async getProjectScopeRecommendations(projectArtifacts: any[]): Promise<any> {
    this.logger.info('Generating project scope recommendations', { 
      artifactCount: projectArtifacts.length 
    });

    const recommendations = {
      overallScope: ScopeType.GLOBAL,
      confidence: 0,
      artifactBreakdown: {
        global: 0,
        application: 0,
        mixed: 0
      },
      recommendations: [] as string[],
      risks: [] as string[],
      benefits: [] as string[]
    };

    const decisions: ScopeDecision[] = [];

    // Analyze each artifact
    for (const artifact of projectArtifacts) {
      const context: DeploymentContext = {
        artifactType: artifact.sys_class_name || artifact.type,
        artifactData: artifact
      };

      const decision = await this.makeScopeDecision(context);
      decisions.push(decision);

      if (decision.selectedScope === ScopeType.GLOBAL) {
        recommendations.artifactBreakdown.global++;
      } else if (decision.selectedScope === ScopeType.APPLICATION) {
        recommendations.artifactBreakdown.application++;
      } else {
        recommendations.artifactBreakdown.mixed++;
      }
    }

    // Calculate overall recommendation
    const globalRatio = recommendations.artifactBreakdown.global / projectArtifacts.length;
    const applicationRatio = recommendations.artifactBreakdown.application / projectArtifacts.length;

    if (globalRatio > 0.6) {
      recommendations.overallScope = ScopeType.GLOBAL;
      recommendations.confidence = globalRatio;
      recommendations.recommendations.push('Deploy entire project to global scope for consistency');
      recommendations.benefits.push('Simplified deployment and maintenance');
      recommendations.benefits.push('Better cross-application integration');
    } else if (applicationRatio > 0.6) {
      recommendations.overallScope = ScopeType.APPLICATION;
      recommendations.confidence = applicationRatio;
      recommendations.recommendations.push('Deploy project to dedicated application scope');
      recommendations.benefits.push('Better isolation and security');
      recommendations.benefits.push('Easier application lifecycle management');
    } else {
      recommendations.overallScope = ScopeType.AUTO;
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
  async validateScopeConfiguration(config: ScopeConfiguration): Promise<any> {
    this.logger.info('Validating scope configuration', { type: config.type });

    const validation = {
      isValid: true,
      issues: [] as string[],
      warnings: [] as string[],
      recommendations: [] as string[]
    };

    // Validate scope type
    if (!Object.values(ScopeType).includes(config.type)) {
      validation.isValid = false;
      validation.issues.push(`Invalid scope type: ${config.type}`);
    }

    // Validate application scope requirements
    if (config.type === ScopeType.APPLICATION) {
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
    if (config.type === ScopeType.GLOBAL && config.globalDomain !== 'global') {
      validation.warnings.push('Global scope should use "global" domain');
    }

    return validation;
  }

  /**
   * Clear scope cache
   */
  clearScopeCache(): void {
    this.scopeCache.clear();
    this.logger.info('Scope cache cleared');
  }

  /**
   * Get scope statistics
   */
  getScopeStatistics(): any {
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
      
      if (decision.selectedScope === ScopeType.GLOBAL) {
        stats.scopeDistribution.global++;
      } else if (decision.selectedScope === ScopeType.APPLICATION) {
        stats.scopeDistribution.application++;
      } else {
        stats.scopeDistribution.auto++;
      }
    }

    stats.averageConfidence = this.scopeCache.size > 0 ? totalConfidence / this.scopeCache.size : 0;

    return stats;
  }

  /**
   * Private helper methods
   */

  private generateCacheKey(context: DeploymentContext): string {
    return `${context.artifactType}:${context.artifactData.name}:${context.environmentType || 'default'}`;
  }

  private applyUserPreferences(config: ScopeConfiguration, context: DeploymentContext): ScopeConfiguration {
    if (!context.userPreferences) {
      return config;
    }

    // Override with user preferences
    return {
      ...config,
      ...context.userPreferences
    };
  }

  private makeFinalDecision(
    config: ScopeConfiguration, 
    validation: any, 
    context: DeploymentContext
  ): ScopeDecision {
    let selectedScope = config.type;
    let confidence = 0.8;
    let rationale = 'Based on artifact _analysis';
    let fallbackScope: ScopeType | undefined;

    // Apply validation results
    if (!validation.isValid) {
      if (validation.canCreateGlobal && config.type === ScopeType.APPLICATION) {
        selectedScope = ScopeType.GLOBAL;
        fallbackScope = ScopeType.APPLICATION;
        confidence = 0.6;
        rationale = 'Fallback to global scope due to permission issues';
      } else if (validation.canCreateScoped && config.type === ScopeType.GLOBAL) {
        selectedScope = ScopeType.APPLICATION;
        fallbackScope = ScopeType.GLOBAL;
        confidence = 0.6;
        rationale = 'Fallback to application scope due to permission issues';
      } else {
        confidence = 0.3;
        rationale = 'Limited options due to permission constraints';
      }
    }

    // Apply environment-specific rules
    if (context.environmentType === 'production') {
      // Production deployments prefer global scope for stability
      if (selectedScope === ScopeType.APPLICATION && validation.canCreateGlobal) {
        selectedScope = ScopeType.GLOBAL;
        confidence = Math.max(confidence, 0.7);
        rationale += ' (production environment preference)';
      }
    }

    // Apply project scope preferences
    if (context.projectScope) {
      if (context.projectScope === ScopeType.GLOBAL && validation.canCreateGlobal) {
        selectedScope = ScopeType.GLOBAL;
        confidence = Math.max(confidence, 0.8);
        rationale += ' (project scope preference)';
      } else if (context.projectScope === ScopeType.APPLICATION && validation.canCreateScoped) {
        selectedScope = ScopeType.APPLICATION;
        confidence = Math.max(confidence, 0.8);
        rationale += ' (project scope preference)';
      }
    }

    const recommendations: string[] = [];

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

  private shouldMigrateArtifact(artifact: any, decision: ScopeDecision): boolean {
    const currentScope = artifact.sys_scope;
    const recommendedScope = decision.selectedScope;

    // Don't migrate if confidence is too low
    if (decision.confidence < 0.7) {
      return false;
    }

    // Don't migrate if already in optimal scope
    if (currentScope === 'global' && recommendedScope === ScopeType.GLOBAL) {
      return false;
    }

    if (currentScope !== 'global' && recommendedScope === ScopeType.APPLICATION) {
      return false;
    }

    return true;
  }

  private async migrateArtifact(artifact: any, decision: ScopeDecision): Promise<any> {
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
        sys_scope: decision.selectedScope === ScopeType.GLOBAL ? 'global' : decision.selectedScope,
        name: `${artifact.name}_migrated`
        // 🔧 TEST-001 FIX: Remove sys_id property instead of setting to undefined
        // This prevents "sys_id undefined" errors in testing tools
      };

      // 🔧 TEST-001 FIX: Explicitly delete sys_id so ServiceNow generates a new one
      delete newArtifactData.sys_id;

      const deploymentResult = await this.strategy.deployWithGlobalScope(
        artifact.sys_class_name || artifact.type,
        newArtifactData,
        { type: decision.selectedScope }
      );

      migrationResult.success = deploymentResult.success;
      migrationResult.details = deploymentResult;

      // In a real implementation, you would also:
      // 1. Update references to the old artifact
      // 2. Deactivate or delete the old artifact
      // 3. Verify the migration worked correctly

    } catch (error) {
      migrationResult.success = false;
      migrationResult.details = { error: error instanceof Error ? error.message : String(error) };
    }

    return migrationResult;
  }

  private async validatePermissions(permissions: string[]): Promise<any> {
    // Simplified permission validation
    // In practice, this would check actual ServiceNow permissions
    return {
      isValid: true,
      issues: [],
      warnings: []
    };
  }
}