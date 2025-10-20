/**
 * 🚀 BUG-006 FIX: Multi-Pass Requirements Analyzer
 *
 * Advanced requirements _analysis with multiple passes to ensure
 * comprehensive coverage and no missed dependencies.
 */
import { ServiceNowRequirement, ObjectiveAnalysis } from './requirements-analyzer.js';
export interface MultiPassAnalysisResult extends ObjectiveAnalysis {
    analysisPassesData: {
        pass1_initial: PassAnalysisResult;
        pass2_dependencies: PassAnalysisResult;
        pass3_context: PassAnalysisResult;
        pass4_validation: PassAnalysisResult;
    };
    completenessScore: number;
    confidenceLevel: 'low' | 'medium' | 'high' | 'very_high';
    missingRequirementsDetected: ServiceNowRequirement[];
    implicitDependencies: string[];
    crossDomainImpacts: string[];
}
export interface PassAnalysisResult {
    passNumber: number;
    passName: string;
    requirementsFound: number;
    newRequirementsAdded: number;
    analysisMethod: string;
    keyFindings: string[];
    confidence: number;
    processingTime: number;
}
export declare class MultiPassRequirementsAnalyzer {
    private logger;
    private readonly CONTEXT_PATTERNS;
    private readonly DEPENDENCY_MATRIX;
    private readonly CROSS_DOMAIN_IMPACTS;
    constructor();
    /**
     * 🔍 Run comprehensive multi-pass analysis
     */
    analyzeRequirements(objective: string): Promise<MultiPassAnalysisResult>;
    /**
     * 🎯 PASS 1: Initial Pattern Matching Analysis
     */
    private pass1_InitialAnalysis;
    /**
     * 🔗 PASS 2: Dependency Analysis
     */
    private pass2_DependencyAnalysis;
    /**
     * 🌐 PASS 3: Context & Implication Analysis
     */
    private pass3_ContextAnalysis;
    /**
     * ✅ PASS 4: Validation & Completeness Check
     */
    private pass4_ValidationAnalysis;
    private createRequirement;
    private getCategoryForType;
    private detectComplexPatterns;
    private analyzePrerequisiteChains;
    private analyzeCoRequirements;
    private analyzeScopeImplications;
    private analyzeComplianceImplications;
    private performGapAnalysis;
    private validateRequirementCompleteness;
    private performQualityCheck;
    private deduplicateRequirements;
    private calculateCompletenessScore;
    private determineConfidenceLevel;
    private analyzeCrossDomainImpacts;
    private extractImplicitDependencies;
    private calculateComplexity;
    private calculateRiskAssessment;
    private extractCategories;
    private identifyCriticalPath;
    private estimateDuration;
}
export default MultiPassRequirementsAnalyzer;
//# sourceMappingURL=multi-pass-requirements-analyzer.d.ts.map