/**
 * Snow-Flow Performance Monitoring System
 * Real-time metrics collection and analysis
 */
import { EventEmitter } from 'events';
import { MemorySystem } from '../memory/memory-system';
export interface PerformanceMetric {
    id: string;
    operation: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    success: boolean;
    metadata: Record<string, any>;
    sessionId?: string;
    agentId?: string;
    resourceUsage?: ResourceUsage;
    error?: string;
}
export interface ResourceUsage {
    cpuUsage: number;
    memoryUsage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    arrayBuffers: number;
}
export interface AggregateMetrics {
    operation: string;
    count: number;
    successCount: number;
    failureCount: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    percentile95: number;
    percentile99: number;
    errorRate: number;
    throughput: number;
}
export interface SessionMetrics {
    sessionId: string;
    startTime: Date;
    endTime?: Date;
    duration?: number;
    operationCount: number;
    successCount: number;
    failureCount: number;
    agentCount: number;
    artifactCount: number;
    averageOperationTime: number;
    resourceUsage: ResourceUsage[];
}
export interface PerformanceReport {
    timestamp: Date;
    period: string;
    summary: {
        totalOperations: number;
        successRate: number;
        averageResponseTime: number;
        peakConcurrency: number;
        errorRate: number;
    };
    operationMetrics: AggregateMetrics[];
    sessionMetrics: SessionMetrics[];
    bottlenecks: Bottleneck[];
    recommendations: string[];
}
export interface Bottleneck {
    operation: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    impact: string;
    occurrences: number;
    averageDelay: number;
    recommendation: string;
}
interface TrackerConfig {
    memory: MemorySystem;
    config: {
        sampleRate: number;
        metricsRetention: number;
        aggregationInterval: number;
    };
}
export declare class PerformanceTracker extends EventEmitter {
    private memory;
    private logger;
    private config;
    private activeOperations;
    private metricsBuffer;
    private aggregationTimer?;
    private initialized;
    constructor(options: TrackerConfig);
    /**
     * Initialize the performance tracker
     */
    initialize(): Promise<void>;
    /**
     * Start tracking an operation
     */
    startOperation(operation: string, metadata?: Record<string, any>): Promise<string>;
    /**
     * End tracking an operation
     */
    endOperation(operationId: string, result: {
        success: boolean;
        error?: string;
        metadata?: any;
    }): Promise<void>;
    /**
     * Track a complete operation (convenience method)
     */
    trackOperation<T>(operation: string, metadata: Record<string, any>, fn: () => Promise<T>): Promise<T>;
    /**
     * Get metrics for a specific session
     */
    getSessionMetrics(sessionId: string): Promise<SessionMetrics>;
    /**
     * Get aggregate metrics for an operation
     */
    getAggregateMetrics(operation: string, timeframe?: number): Promise<AggregateMetrics>;
    /**
     * Generate performance report
     */
    generateReport(period?: 'hour' | 'day' | 'week' | 'month'): Promise<PerformanceReport>;
    /**
     * Identify performance bottlenecks
     */
    identifyBottlenecks(metrics: PerformanceMetric[]): Promise<Bottleneck[]>;
    /**
     * Shutdown the tracker
     */
    shutdown(): Promise<void>;
    /**
     * Private helper methods
     */
    private createPerformanceTables;
    private startAggregation;
    private startResourceMonitoring;
    private captureResourceUsage;
    private calculateResourceDelta;
    private flushMetrics;
    private aggregateMetrics;
    private cleanupOldMetrics;
    private checkPerformanceThresholds;
    private generateMetricId;
    private calculatePercentile;
    private calculateVariance;
    private calculatePeakConcurrency;
    private countSessionArtifacts;
    private groupBy;
    private getTimeframe;
    private severityScore;
    private generateRecommendations;
}
export {};
//# sourceMappingURL=performance-tracker.d.ts.map