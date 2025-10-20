#!/usr/bin/env node
/**
 * ServiceNow Development Assistant MCP Server
 * Natural language artifact management and development orchestration for ServiceNow
 */
export declare class ServiceNowDevelopmentAssistantMCP {
    private server;
    private client;
    private logger;
    private memoryPath;
    private config;
    private documentationSystem;
    private costOptimizationEngine;
    private complianceSystem;
    private selfHealingSystem;
    private memorySystem;
    private memoryIndex;
    constructor();
    private initializeSystems;
    private setupHandlers;
    private findArtifact;
    private editArtifact;
    private analyzeArtifact;
    private searchMemory;
    private comprehensiveSearch;
    private parseIntent;
    private extractIdentifier;
    private parseEditIntent;
    /**
     * 🔴 CRITICAL FIX SNOW-002: Search ServiceNow with retry logic for newly created artifacts
     * Addresses: "I created a flow but search says it doesn't exist"
     * Root Cause: ServiceNow search indexes take time to update after artifact creation
     */
    private searchServiceNowWithRetry;
    /**
     * 🔴 SNOW-002 FIX: Attempt to refresh ServiceNow caches
     */
    private attemptCacheRefresh;
    /**
     * 🔴 SNOW-002 FIX: Broad fallback search when all retries fail
     */
    private broadFallbackSearch;
    /**
     * 🔴 SNOW-002 FIX: Special search method for newly created artifacts
     * Use this immediately after creating an artifact to verify it's searchable
     */
    searchForRecentlyCreatedArtifact(artifactName: string, artifactType: string, expectedSysId?: string): Promise<any[]>;
    /**
     * Sleep utility for retry delays
     */
    private sleep;
    private searchServiceNow;
    private buildServiceNowQuery;
    private intelligentlyIndex;
    private decomposeArtifact;
    private decomposeWidget;
    private decomposeFlow;
    private extractContext;
    private mapRelationships;
    private createClaudeSummary;
    private identifyModificationPoints;
    private storeInMemory;
    private searchInMemory;
    private matchesIntent;
    private formatResults;
    private formatMemoryResults;
    private formatComprehensiveResults;
    private generateEditSuggestion;
    private findTargetArtifact;
    /**
     * Select the best matching artifact based on relevance scoring
     */
    private selectBestMatch;
    /**
     * Perform comprehensive flow _analysis and testing
     */
    private performFlowAnalysis;
    private calculateFlowPerformanceScore;
    private identifySecurityIssues;
    private findIntegrationPoints;
    private generateFlowTestRecommendations;
    private analyzeModification;
    private applyModification;
    private deployArtifact;
    private updateMemoryIndex;
    private getArtifactUrl;
    private getBySysId;
    private editBySysId;
    private syncDataConsistency;
    private refreshCache;
    private validateSysIds;
    private reindexArtifacts;
    private getArtifactTypeFromTable;
    private performFullSync;
    private validateLiveConnection;
    private batchDeploymentValidator;
    private deploymentRollbackManager;
    private calculateFlowComplexity;
    private validateArtifactSyntax;
    private validateArtifactDependencies;
    private detectArtifactConflicts;
    private generateDeploymentRecommendations;
    private monitorUpdateSetDeployment;
    private validateRollbackFeasibility;
    private createUpdateSetBackup;
    private performUpdateSetRollback;
    private groupUpdatesByState;
    private escalatePermissions;
    private analyzeRequirements;
    private smartUpdateSet;
    private orchestrateDevelopment;
    private resilientDeployment;
    private inferArtifactType;
    private inferDependencies;
    private inferPriority;
    private calculateDeploymentOrder;
    private recommendScope;
    private inferRequiredPermissions;
    private validateUpdateSetDependencies;
    private detectUpdateSetConflicts;
    private attemptArtifactDeployment;
    private applyFallbackStrategy;
    private generateBusinessRuleScript;
    private generateFlowTestData;
    private runFunctionalTests;
    private runEdgeCaseTests;
    private runPerformanceTests;
    private runIntegrationTests;
    private runCustomTestScenario;
    private analyzeArtifactRequirements;
    private generateTestRecommendations;
    private findFlowByNameOrSysId;
    /**
     * 🔴 SNOW-002 FIX: Verify artifact is searchable after creation
     * This method is called by other MCP servers after creating artifacts
     */
    private generateDocumentation;
    private getDocumentationSuggestions;
    private startContinuousDocumentation;
    private verifyArtifactSearchable;
    run(): Promise<void>;
}
//# sourceMappingURL=servicenow-development-assistant-mcp.d.ts.map