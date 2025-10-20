/**
 * 🤖 Self-Healing System for Autonomous Error Recovery
 *
 * Advanced autonomous system that detects, diagnoses, and automatically
 * recovers from errors without manual intervention, ensuring maximum
 * system availability and reliability.
 */
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { MemorySystem } from '../memory/memory-system.js';
export interface HealingProfile {
    id: string;
    systemName: string;
    assessmentDate: string;
    healthScore: number;
    incidents: HealthIncident[];
    healingActions: HealingAction[];
    patterns: ErrorPattern[];
    predictions: HealthPrediction[];
    recoveryStrategies: RecoveryStrategy[];
    systemMetrics: SystemMetrics;
    recommendations: HealingRecommendation[];
    metadata: HealingMetadata;
}
export interface HealthIncident {
    id: string;
    type: 'error' | 'performance' | 'availability' | 'security' | 'data-integrity';
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    detectedAt: string;
    status: 'active' | 'healing' | 'resolved' | 'escalated';
    rootCause?: RootCause;
    impact: IncidentImpact;
    healingAttempts: number;
    resolvedAt?: string;
    resolutionMethod?: string;
}
export interface RootCause {
    id: string;
    category: 'code' | 'configuration' | 'resource' | 'external' | 'data' | 'network';
    description: string;
    confidence: number;
    evidence: string[];
    relatedIncidents: string[];
    preventable: boolean;
}
export interface IncidentImpact {
    users: number;
    services: string[];
    availability: number;
    performance: number;
    dataLoss: boolean;
    financialImpact?: number;
    duration: number;
}
export interface HealingAction {
    id: string;
    incidentId: string;
    type: 'restart' | 'rollback' | 'patch' | 'scale' | 'reroute' | 'cleanup' | 'restore';
    title: string;
    description: string;
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'rolled-back';
    automated: boolean;
    executionSteps: HealingStep[];
    startTime?: string;
    endTime?: string;
    result?: HealingResult;
    rollbackPlan?: string;
}
export interface HealingStep {
    order: number;
    action: string;
    target: string;
    parameters: Record<string, any>;
    status: 'pending' | 'executing' | 'completed' | 'failed' | 'skipped';
    output?: string;
    error?: string;
    duration?: number;
}
export interface HealingResult {
    success: boolean;
    message: string;
    metricsAfter: {
        availability: number;
        performance: number;
        errorRate: number;
    };
    sideEffects: string[];
    verificationPassed: boolean;
}
export interface ErrorPattern {
    id: string;
    name: string;
    description: string;
    signature: PatternSignature;
    occurrences: number;
    lastSeen: string;
    avgResolutionTime: number;
    successRate: number;
    recommendedActions: string[];
    autoHealable: boolean;
}
export interface PatternSignature {
    errorTypes: string[];
    keywords: string[];
    frequency: 'sporadic' | 'recurring' | 'persistent';
    timePattern?: string;
    correlations: string[];
}
export interface HealthPrediction {
    id: string;
    type: 'failure' | 'degradation' | 'capacity' | 'security';
    component: string;
    probability: number;
    timeframe: string;
    impact: 'critical' | 'high' | 'medium' | 'low';
    preventiveActions: PreventiveAction[];
    confidence: number;
    basedOn: string[];
}
export interface PreventiveAction {
    action: string;
    priority: 'immediate' | 'high' | 'medium' | 'low';
    estimatedPrevention: number;
    cost: 'minimal' | 'moderate' | 'significant';
    automatable: boolean;
}
export interface RecoveryStrategy {
    id: string;
    name: string;
    description: string;
    applicableTo: string[];
    steps: RecoveryStep[];
    estimatedTime: number;
    successRate: number;
    requirements: string[];
    risks: string[];
}
export interface RecoveryStep {
    order: number;
    action: string;
    automated: boolean;
    timeout: number;
    verification: string;
    fallback?: string;
}
export interface SystemMetrics {
    availability: {
        current: number;
        target: number;
        trend: 'improving' | 'stable' | 'degrading';
    };
    performance: {
        responseTime: number;
        throughput: number;
        errorRate: number;
        trend: 'improving' | 'stable' | 'degrading';
    };
    reliability: {
        mtbf: number;
        mttr: number;
        failureRate: number;
    };
    capacity: {
        cpu: number;
        memory: number;
        storage: number;
        network: number;
    };
}
export interface HealingRecommendation {
    id: string;
    category: 'architecture' | 'monitoring' | 'redundancy' | 'automation' | 'capacity';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    benefit: string;
    effort: 'minimal' | 'moderate' | 'significant' | 'major';
    preventedIncidents: number;
    roi: number;
}
export interface HealingMetadata {
    monitoringEnabled: boolean;
    autoHealingEnabled: boolean;
    learningMode: boolean;
    retentionDays: number;
    integrations: string[];
    lastFullScan: string;
    nextScheduledScan: string;
}
export interface HealingRequest {
    scope?: 'full' | 'incremental' | 'specific-services';
    services?: string[];
    autoHeal?: boolean;
    predictive?: boolean;
    learning?: boolean;
}
export interface HealingResponse {
    success: boolean;
    profile: HealingProfile;
    incidentsDetected: number;
    incidentsHealed: number;
    predictionsGenerated: number;
    recommendations: string[];
    warnings: string[];
}
export declare class SelfHealingSystem {
    private logger;
    private client;
    private memory;
    private healingProfiles;
    private activeIncidents;
    private errorPatterns;
    private recoveryStrategies;
    private monitoringActive;
    private learningEngine;
    constructor(client: ServiceNowClient, memory: MemorySystem);
    /**
     * Perform system health assessment and healing
     */
    performHealthCheck(request?: HealingRequest): Promise<HealingResponse>;
    /**
     * Start autonomous self-healing
     */
    startAutonomousHealing(options?: {
        checkInterval?: number;
        healingThreshold?: number;
        maxRetries?: number;
        preventive?: boolean;
    }): Promise<void>;
    /**
     * Get real-time health dashboard
     */
    getHealthDashboard(): Promise<{
        systemHealth: string;
        healthScore: number;
        activeIncidents: HealthIncident[];
        recentHealing: HealingAction[];
        systemMetrics: SystemMetrics;
        predictions: HealthPrediction[];
        recommendations: HealingRecommendation[];
    }>;
    /**
     * Manually trigger healing action
     */
    executeHealingAction(actionId: string, options?: {
        verify?: boolean;
        monitor?: boolean;
        rollbackOnFailure?: boolean;
    }): Promise<{
        success: boolean;
        result: HealingResult;
        duration: number;
    }>;
    /**
     * Private helper methods
     */
    private initializeRecoveryStrategies;
    private detectHealthIncidents;
    private analyzeRootCause;
    private identifyErrorPatterns;
    private generateHealthPredictions;
    private createHealingActions;
    private executeAutoHealing;
    private executeHealingSteps;
    private generateRecoveryStrategies;
    private collectSystemMetrics;
    private generateHealingRecommendations;
    private calculateHealthScore;
    private handleCriticalIncidents;
    private executePreventiveActions;
    private healSelf;
    private startHealthMonitoring;
    private checkSystemHealth;
    private getLatestHealingProfile;
    private generateDashboard;
    private generateWarnings;
    private checkErrorLogs;
    private checkPerformanceMetrics;
    private checkAvailability;
    private determineSeverity;
    private getRelatedLogs;
    private getSystemStateAt;
    private categorizeRootCause;
    private calculateConfidence;
    private generateRootCauseDescription;
    private findRelatedIncidents;
    private groupIncidentsBySimilarity;
    private generatePatternName;
    private generatePatternDescription;
    private extractKeywords;
    private determineFrequency;
    private findCorrelations;
    private calculateAvgResolutionTime;
    private calculateSuccessRate;
    private getRecommendedActions;
    private isAutoHealable;
    private analyzeTrends;
    private predictCapacityIssues;
    private predictNextOccurrence;
    private findBestStrategy;
    private determineActionType;
    private captureMetrics;
    private stopService;
    private clearTempData;
    private startService;
    private generateCustomSteps;
    private getHealingAction;
    private verifyHealingSafety;
    private monitorHealingProgress;
    private rollbackHealing;
    private executePreventiveAction;
}
export default SelfHealingSystem;
//# sourceMappingURL=self-healing-system.d.ts.map