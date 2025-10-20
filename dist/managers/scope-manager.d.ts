/**
 * Scope Manager for ServiceNow Artifact Deployment
 *
 * Centralized management of deployment scopes, providing intelligent
 * scope selection and management capabilities.
 */
import { ScopeType, ScopeConfiguration, GlobalScopeDeploymentResult } from '../strategies/global-scope-strategy.js';
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
export declare class ScopeManager {
    private strategy;
    private client;
    private logger;
    private options;
    private scopeCache;
    constructor(options?: ScopeManagerOptions);
    /**
     * Make intelligent scope decision based on context
     */
    makeScopeDecision(context: DeploymentContext): Promise<ScopeDecision>;
    /**
     * Deploy artifact using intelligent scope management
     */
    deployWithScopeManagement(context: DeploymentContext): Promise<GlobalScopeDeploymentResult>;
    /**
     * Migrate existing artifacts to optimal scope
     */
    migrateArtifactsToOptimalScope(artifacts: any[]): Promise<any>;
    /**
     * Get scope recommendations for a project
     */
    getProjectScopeRecommendations(projectArtifacts: any[]): Promise<any>;
    /**
     * Validate scope configuration
     */
    validateScopeConfiguration(config: ScopeConfiguration): Promise<any>;
    /**
     * Clear scope cache
     */
    clearScopeCache(): void;
    /**
     * Get scope statistics
     */
    getScopeStatistics(): any;
    /**
     * Private helper methods
     */
    private generateCacheKey;
    private applyUserPreferences;
    private makeFinalDecision;
    private shouldMigrateArtifact;
    private migrateArtifact;
    private validatePermissions;
}
//# sourceMappingURL=scope-manager.d.ts.map