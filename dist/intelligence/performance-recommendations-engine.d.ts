/**
 * 🚀 PERFORMANCE FIX: Enhanced AI-Powered Performance Recommendations Engine
 *
 * Provides intelligent database index suggestions, real-time performance optimizations,
 * predictive analytics, and AI-powered recommendations for ServiceNow artifacts.
 *
 * Enhanced features from beta testing feedback:
 * - Real-time performance trend analysis
 * - AI-powered pattern recognition
 * - Predictive performance modeling
 * - Automated optimization suggestions
 */
import { MemorySystem } from '../memory/memory-system.js';
export interface DatabaseIndexRecommendation {
    table: string;
    fields: string[];
    indexType: 'composite' | 'single' | 'unique' | 'partial';
    reason: string;
    estimatedImprovement: number;
    priority: 'critical' | 'high' | 'medium' | 'low';
    createStatement: string;
    impactAnalysis: {
        queryImpact: string[];
        storageImpact: string;
        maintenanceImpact: string;
    };
}
export interface PerformanceRecommendation {
    category: 'database' | 'flow' | 'widget' | 'api' | 'cache';
    type: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    recommendation: string;
    code_example?: string;
    estimated_time_savings: string;
}
export interface TableUsagePattern {
    table: string;
    commonQueries: string[];
    frequentFields: string[];
    joinPatterns: {
        with_table: string;
        on_fields: string[];
    }[];
    slowQueries: string[];
    recordVolume: 'low' | 'medium' | 'high';
    updateFrequency: 'low' | 'medium' | 'high';
}
export interface AIRecommendation {
    id: string;
    type: 'optimization' | 'architecture' | 'scaling' | 'monitoring' | 'security';
    confidence: number;
    impact: 'critical' | 'high' | 'medium' | 'low';
    category: string;
    title: string;
    description: string;
    rationale: string;
    implementation: {
        steps: string[];
        estimatedTime: string;
        complexity: 'low' | 'medium' | 'high';
        prerequisites: string[];
        risks: string[];
    };
    metrics: {
        expectedImprovement: number;
        estimatedCostSavings?: string;
        affectedComponents: string[];
        kpiImpact: Record<string, number>;
    };
    priority: number;
    validUntil: Date;
    source: 'pattern__analysis' | 'ml_prediction' | 'historical_data' | 'real_time_monitoring';
}
export interface PerformancePattern {
    pattern: string;
    frequency: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
    contexts: string[];
    solutions: AIRecommendation[];
    firstSeen: Date;
    lastSeen: Date;
    occurrences: number;
}
export interface PredictiveInsight {
    type: 'degradation_warning' | 'capacity_planning' | 'bottleneck_prediction' | 'optimization_opportunity';
    component: string;
    prediction: string;
    probability: number;
    timeHorizon: number;
    evidencePoints: string[];
    recommendedActions: AIRecommendation[];
    modelConfidence: number;
    createdAt: Date;
}
export interface SystemBaseline {
    component: string;
    metrics: {
        [metricName: string]: {
            baseline: number;
            threshold: number;
            trend: 'improving' | 'stable' | 'degrading';
            variance: number;
        };
    };
    lastUpdated: Date;
    sampleCount: number;
}
export interface PerformanceScore {
    overall: number;
    components: {
        database: number;
        api: number;
        memory: number;
        cache: number;
        network: number;
    };
    trends: {
        daily: number;
        weekly: number;
        monthly: number;
    };
    comparison: {
        industryAverage?: number;
        bestPractice?: number;
    };
    calculatedAt: Date;
}
export declare class PerformanceRecommendationsEngine {
    private logger;
    private memory;
    private performancePatterns;
    private systemBaselines;
    private aiRecommendations;
    private predictiveInsights;
    private learningEnabled;
    private readonly SERVICENOW_TABLE_PATTERNS;
    private readonly CRITICAL_INDEXES;
    constructor(memory?: MemorySystem);
    /**
     * 🧠 Initialize AI-powered capabilities and load historical patterns
     */
    private initializeAICapabilities;
    /**
     * 🧠 Generate AI-powered performance recommendations based on real-time data
     */
    generateAIRecommendations(systemMetrics: any, performanceData: any, options?: {
        includePreventive?: boolean;
        includePredictive?: boolean;
        confidenceThreshold?: number;
    }): Promise<AIRecommendation[]>;
    /**
     * 🔮 Generate predictive insights based on historical trends
     */
    generatePredictiveInsights(timeHorizonHours?: number): Promise<PredictiveInsight[]>;
    /**
     * 📊 Calculate comprehensive performance score
     */
    calculatePerformanceScore(systemMetrics: any, performanceData: any): Promise<PerformanceScore>;
    /**
     * 🎯 Learn from performance patterns and update AI models
     */
    learnFromPerformanceData(performanceData: any, systemMetrics: any, outcomes: {
        successful: boolean;
        improvementPercent?: number;
    }[]): Promise<void>;
    /**
     * 🔍 Analyze flow definition and provide performance recommendations
     */
    analyzeFlowPerformance(flowDefinition: any): Promise<{
        databaseIndexes: DatabaseIndexRecommendation[];
        performanceRecommendations: PerformanceRecommendation[];
        summary: {
            criticalIssues: number;
            estimatedImprovementPercent: number;
            recommendedActions: string[];
        };
    }>;
    /**
     * 🎯 Get specific index recommendations for a ServiceNow table
     */
    private getIndexRecommendationsForTable;
    /**
     * 📊 Analyze flow activities for performance bottlenecks
     */
    private analyzeFlowActivities;
    /**
     * 🔧 Generate general performance recommendations
     */
    private generateGeneralPerformanceRecommendations;
    /**
     * 📋 Extract tables used in flow definition
     */
    private extractTablesFromFlow;
    /**
     * 📊 Generate comprehensive performance report
     */
    /**
     * 🧠 Private AI helper methods
     */
    private loadHistoricalPatterns;
    private loadSystemBaselines;
    private loadAIRecommendations;
    private generatePatternBasedRecommendations;
    private generatePredictiveRecommendations;
    private generateAnomalyRecommendations;
    private generateMLRecommendations;
    private calculateDatabaseScore;
    private calculateAPIScore;
    private calculateMemoryScore;
    private calculateCacheScore;
    private calculateNetworkScore;
    private calculatePerformanceTrends;
    private matchesPattern;
    private createRecommendationsFromPattern;
    private extractPerformancePatterns;
    private updatePatternSolutions;
    private updateSystemBaselines;
    private generateRecommendationsFromPatterns;
    private persistLearningData;
    private predictMemoryExhaustion;
    private predictDatabaseBottlenecks;
    private predictAPIPerformanceDegradation;
    private predictCacheEffectivenessIssues;
    /**
     * 📊 Generate comprehensive performance report
     */
    generatePerformanceReport(analysisResults: {
        databaseIndexes: DatabaseIndexRecommendation[];
        performanceRecommendations: PerformanceRecommendation[];
        summary: any;
    }): string;
}
export default PerformanceRecommendationsEngine;
//# sourceMappingURL=performance-recommendations-engine.d.ts.map