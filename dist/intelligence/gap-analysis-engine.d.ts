/**
 * Intelligent Gap Analysis Engine - The core orchestrator
 *
 * This is the main engine that orchestrates all components to analyze objectives,
 * detect missing ServiceNow configurations beyond MCP tools, and attempt automated
 * resolution with fallback to detailed manual instructions.
 *
 * This fulfills the user's vision: "alle mogelijke soorten handelingen die nodig
 * zouden zijn om een objective te bereiken die vallen buiten de standaard mcps"
 *
 * Usage:
 *   const engine = new GapAnalysisEngine(mcpTools, logger, autoPermissions);
 *   const result = await engine.analyzeAndResolve("create incident widget with charts");
 */
import { ServiceNowRequirement } from './requirements-analyzer';
import { CoverageAnalysis } from './mcp-coverage-analyzer';
import { BulkResolutionResult } from './auto-resolution-engine';
import { BulkManualGuide } from './manual-instructions-generator';
export interface GapAnalysisResult {
    objective: string;
    analysisId: string;
    timestamp: number;
    requirements: ServiceNowRequirement[];
    totalRequirements: number;
    mcpCoverage: CoverageAnalysis;
    automationResults: BulkResolutionResult;
    manualGuides: BulkManualGuide | null;
    summary: {
        totalTime: number;
        automationRate: number;
        successfulAutomation: number;
        requiresManualWork: number;
        completionPercentage: number;
    };
    nextSteps: {
        automated: string[];
        manual: string[];
        recommendations: string[];
        risks: string[];
    };
    executionPlan: {
        phase: string;
        description: string;
        estimatedTime: string;
        status: 'completed' | 'pending' | 'manual_required';
        actions: string[];
    }[];
}
export interface GapAnalysisOptions {
    autoPermissions?: boolean;
    environment?: 'development' | 'testing' | 'production';
    enableAutomation?: boolean;
    includeManualGuides?: boolean;
    riskTolerance?: 'low' | 'medium' | 'high';
    dryRun?: boolean;
}
export declare class GapAnalysisEngine {
    private mcpTools;
    private logger;
    private autoResolutionEngine;
    constructor(mcpTools: any, logger: any, autoPermissions?: boolean);
    /**
     * Main entry point - analyze objective and resolve all gaps
     */
    analyzeAndResolve(objective: string, options?: GapAnalysisOptions): Promise<GapAnalysisResult>;
    /**
     * Quick _analysis without resolution - useful for planning
     */
    analyzeOnly(objective: string): Promise<{
        requirements: ServiceNowRequirement[];
        coverage: CoverageAnalysis;
        canAutomate: number;
        requiresManual: number;
        estimatedTime: string;
    }>;
    /**
     * Get detailed _analysis for a specific requirement type
     */
    analyzeRequirementType(requirementType: string): {
        mcpTools: string[];
        automationStrategies: string[];
        manualSteps: string[];
        riskLevel: string;
    };
    private createEmptyResult;
    private buildGapAnalysisResult;
    private generateNextSteps;
    private generateExecutionPlan;
    private estimateTotalTime;
}
/**
 * Convenience function for quick gap analysis
 */
export declare function analyzeGaps(objective: string, mcpTools: any, logger: any, options?: GapAnalysisOptions): Promise<GapAnalysisResult>;
/**
 * Quick _analysis without resolution
 */
export declare function quickAnalyze(objective: string): {
    requirements: ServiceNowRequirement[];
    coverage: CoverageAnalysis;
    estimatedComplexity: 'simple' | 'moderate' | 'complex';
};
//# sourceMappingURL=gap-analysis-engine.d.ts.map