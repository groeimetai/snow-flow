/**
 * Global Scope Strategy for ServiceNow Flow Creation
 *
 * This strategy implements a global scope approach for ServiceNow artifacts,
 * replacing the current application-scoped approach with a more flexible
 * global scope deployment model.
 */
export declare enum ScopeType {
    GLOBAL = "global",
    APPLICATION = "application",
    AUTO = "auto"
}
export interface ScopeConfiguration {
    type: ScopeType;
    applicationId?: string;
    applicationName?: string;
    globalDomain?: string;
    fallbackToGlobal?: boolean;
    permissions?: string[];
}
export interface GlobalScopeDeploymentResult {
    success: boolean;
    scope: ScopeType;
    domain: string;
    artifactId: string;
    permissions: string[];
    message: string;
    warnings?: string[];
    fallbackApplied?: boolean;
}
export interface ScopeValidationResult {
    isValid: boolean;
    hasPermissions: boolean;
    canCreateGlobal: boolean;
    canCreateScoped: boolean;
    recommendedScope: ScopeType;
    issues: string[];
    warnings: string[];
}
export declare class GlobalScopeStrategy {
    private client;
    private oauth;
    private logger;
    private defaultConfiguration;
    constructor();
    /**
     * Analyze and determine the optimal scope for deployment
     */
    analyzeScopeRequirements(artifactType: string, artifactData: any): Promise<ScopeConfiguration>;
    /**
     * Validate scope permissions and capabilities
     */
    validateScopePermissions(scopeConfig: ScopeConfiguration): Promise<ScopeValidationResult>;
    /**
     * Deploy artifact using global scope strategy
     */
    deployWithGlobalScope(artifactType: string, artifactData: any, scopeConfig?: ScopeConfiguration): Promise<GlobalScopeDeploymentResult>;
    /**
     * Deploy artifact to global scope
     */
    private deployToGlobalScope;
    /**
     * Deploy artifact to application scope (fallback)
     */
    private deployToApplicationScope;
    /**
     * Deploy flow to global scope
     */
    private deployFlowToGlobalScope;
    /**
     * Deploy widget to global scope
     */
    private deployWidgetToGlobalScope;
    /**
     * Deploy script include to global scope
     */
    private deployScriptIncludeToGlobalScope;
    /**
     * Deploy business rule to global scope
     */
    private deployBusinessRuleToGlobalScope;
    /**
     * Deploy table to global scope
     */
    private deployTableToGlobalScope;
    /**
     * Check global scope permissions
     */
    private checkGlobalScopePermissions;
    /**
     * Check application scope permissions
     */
    private checkApplicationScopePermissions;
    /**
     * Assess artifact complexity for scope decision
     */
    private assessArtifactComplexity;
    /**
     * Analyze artifact dependencies
     */
    private analyzeDependencies;
    /**
     * Check required permissions for artifact type
     */
    private checkRequiredPermissions;
    /**
     * Create temporary application for scoped deployment
     */
    private createTemporaryApplication;
    /**
     * Get system class name for artifact type
     */
    private getSystemClassName;
    /**
     * Get table name for artifact type
     */
    private getTableName;
    /**
     * Get migration strategy for existing scoped artifacts
     */
    getMigrationStrategy(existingArtifacts: any[]): Promise<any>;
}
//# sourceMappingURL=global-scope-strategy.d.ts.map