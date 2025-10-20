/**
 * 💰 Cost Optimization Engine for AI-Driven Cost Management
 *
 * Revolutionary autonomous system that monitors, analyzes, and optimizes
 * AI usage costs in real-time, implementing cost-saving strategies
 * without manual intervention.
 */
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { MemorySystem } from '../memory/memory-system.js';
export interface CostProfile {
    id: string;
    period: string;
    startDate: string;
    endDate: string;
    totalCost: number;
    breakdown: CostBreakdown;
    trends: CostTrend[];
    optimizations: CostOptimization[];
    forecast: CostForecast;
    savings: SavingsReport;
    alerts: CostAlert[];
    metadata: CostMetadata;
}
export interface CostBreakdown {
    byService: ServiceCost[];
    byOperation: OperationCost[];
    byAgent: AgentCost[];
    byTimeframe: TimeframeCost[];
    byModel: ModelCost[];
}
export interface ServiceCost {
    service: string;
    cost: number;
    usage: {
        requests: number;
        tokens: number;
        computeTime: number;
    };
    percentageOfTotal: number;
    trend: 'increasing' | 'stable' | 'decreasing';
}
export interface OperationCost {
    operation: string;
    cost: number;
    frequency: number;
    averageCostPerOperation: number;
    optimization: string;
}
export interface AgentCost {
    agentId: string;
    agentType: string;
    cost: number;
    efficiency: number;
    recommendations: string[];
}
export interface TimeframeCost {
    timeframe: string;
    cost: number;
    peakHours: string[];
    lowUsageHours: string[];
}
export interface ModelCost {
    model: string;
    cost: number;
    tokens: number;
    requests: number;
    costPerToken: number;
    alternativeModels: ModelAlternative[];
}
export interface ModelAlternative {
    model: string;
    potentialSavings: number;
    performanceImpact: 'minimal' | 'moderate' | 'significant';
    recommendation: string;
}
export interface CostTrend {
    date: string;
    cost: number;
    change: number;
    changePercentage: number;
    anomaly: boolean;
    reason?: string;
}
export interface CostOptimization {
    id: string;
    type: 'model_switching' | 'caching' | 'batching' | 'scheduling' | 'token_reduction' | 'service_consolidation';
    title: string;
    description: string;
    potentialSavings: number;
    implementation: OptimizationImplementation;
    impact: OptimizationImpact;
    status: 'suggested' | 'testing' | 'implemented' | 'rejected';
    automationLevel: 'full' | 'semi' | 'manual';
}
export interface OptimizationImplementation {
    steps: ImplementationStep[];
    estimatedTime: number;
    requirements: string[];
    risks: string[];
    rollbackPlan: string;
}
export interface ImplementationStep {
    order: number;
    action: string;
    automated: boolean;
    script?: string;
    validation: string;
}
export interface OptimizationImpact {
    costReduction: number;
    performanceChange: number;
    reliabilityChange: number;
    userExperience: 'improved' | 'unchanged' | 'degraded';
    confidence: number;
}
export interface CostForecast {
    period: string;
    predictedCost: number;
    confidenceInterval: {
        low: number;
        high: number;
    };
    assumptions: string[];
    risks: ForecastRisk[];
    recommendations: string[];
}
export interface ForecastRisk {
    risk: string;
    probability: 'low' | 'medium' | 'high';
    impact: number;
    mitigation: string;
}
export interface SavingsReport {
    totalSaved: number;
    savingsByOptimization: SavingsByType[];
    comparisonToPrevious: number;
    projectedAnnualSavings: number;
    implementedOptimizations: number;
}
export interface SavingsByType {
    type: string;
    amount: number;
    percentage: number;
    examples: string[];
}
export interface CostAlert {
    id: string;
    type: 'threshold' | 'anomaly' | 'trend' | 'forecast';
    severity: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
    value: number;
    threshold?: number;
    action: string;
    autoResolved: boolean;
}
export interface CostMetadata {
    currency: string;
    billingCycle: string;
    lastUpdated: string;
    dataQuality: number;
    coveragePercentage: number;
    missingData: string[];
}
export interface CostOptimizationRequest {
    scope: 'all' | 'service' | 'agent' | 'operation';
    targetReduction?: number;
    constraints?: OptimizationConstraints;
    autoImplement?: boolean;
    testingEnabled?: boolean;
}
export interface OptimizationConstraints {
    maintainPerformance?: boolean;
    maxPerformanceDegradation?: number;
    preserveReliability?: boolean;
    excludeServices?: string[];
    priorityOperations?: string[];
}
export interface CostOptimizationResult {
    success: boolean;
    profile: CostProfile;
    implementedOptimizations: CostOptimization[];
    projectedSavings: number;
    actualSavings?: number;
    recommendations: string[];
    nextSteps: string[];
}
export declare class CostOptimizationEngine {
    private logger;
    private client;
    private memory;
    private costProfiles;
    private activeOptimizations;
    private costThresholds;
    private monitoringEnabled;
    private costModel;
    constructor(client: ServiceNowClient, memory: MemorySystem);
    /**
     * Analyze costs and generate optimization recommendations
     */
    analyzeCosts(request?: CostOptimizationRequest): Promise<CostOptimizationResult>;
    /**
     * Start autonomous cost monitoring and optimization
     */
    startAutonomousOptimization(options?: {
        targetSavings?: number;
        checkInterval?: number;
        autoImplementThreshold?: number;
    }): Promise<void>;
    /**
     * Get real-time cost dashboard
     */
    getCostDashboard(): Promise<{
        currentMonthCost: number;
        projectedMonthCost: number;
        savingsThisMonth: number;
        topCostDrivers: ServiceCost[];
        activeOptimizations: CostOptimization[];
        recentAlerts: CostAlert[];
        recommendations: string[];
    }>;
    /**
     * Implement specific optimization
     */
    implementOptimization(optimizationId: string, options?: {
        testFirst?: boolean;
        rollbackOnFailure?: boolean;
    }): Promise<{
        success: boolean;
        actualSavings?: number;
        performanceImpact?: number;
        rollbackRequired: boolean;
    }>;
    /**
     * Private helper methods
     */
    private collectCostData;
    private analyzeCostBreakdown;
    private analyzeServiceCosts;
    private analyzeModelCosts;
    private generateOptimizations;
    private generateCostForecast;
    private autoImplementOptimizations;
    private meetsConstraints;
    private executeOptimization;
    private testOptimization;
    private monitorOptimizationImpact;
    private rollbackOptimization;
    private generateRecommendations;
    private generateNextSteps;
    private getLatestCostProfile;
    private generateDashboard;
    private notifyOptimizationResults;
    private processAlerts;
    private initializeCostTracking;
    private startContinuousMonitoring;
    private checkCostThresholds;
    private getCurrentCosts;
    private createCostAlert;
    private collectTokenUsage;
    private collectOperationCosts;
    private collectComputeUsage;
    private analyzeOperationCosts;
    private analyzeAgentCosts;
    private analyzeTimeframeCosts;
    private analyzeCostTrends;
    private generateCostAlerts;
    private calculateSavings;
}
export default CostOptimizationEngine;
//# sourceMappingURL=cost-optimization-engine.d.ts.map