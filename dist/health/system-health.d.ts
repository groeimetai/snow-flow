/**
 * Snow-Flow System Health Monitoring
 * Comprehensive health checks for all components
 */
import { EventEmitter } from 'events';
import { MemorySystem } from '../memory/memory-system';
export interface HealthCheckResult {
    component: string;
    status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
    message: string;
    details?: Record<string, any>;
    timestamp: Date;
    responseTime?: number;
    error?: string;
}
export interface SystemHealthStatus {
    healthy: boolean;
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: Date;
    components: {
        memory: HealthCheckResult;
        mcp: HealthCheckResult;
        servicenow: HealthCheckResult;
        queen: HealthCheckResult;
        system: HealthCheckResult;
        performance: HealthCheckResult;
    };
    metrics: {
        uptime: number;
        totalChecks: number;
        failedChecks: number;
        avgResponseTime: number;
        systemResources: SystemResources;
    };
}
export interface SystemResources {
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    diskUsage: number;
    diskTotal: number;
    loadAverage: number[];
    processCount: number;
}
export interface HealthThresholds {
    responseTime: number;
    memoryUsage: number;
    cpuUsage: number;
    queueSize: number;
    errorRate: number;
}
interface HealthConfig {
    memory: MemorySystem;
    mcpManager?: any;
    config: {
        checks: {
            memory: boolean;
            mcp: boolean;
            servicenow: boolean;
            queen: boolean;
        };
        thresholds: HealthThresholds;
    };
}
export declare class SystemHealth extends EventEmitter {
    private memory;
    private mcpManager?;
    private logger;
    private config;
    private serviceNowClient?;
    private checkInterval?;
    private checkHistory;
    private startTime;
    private totalChecks;
    private failedChecks;
    private lastCPUInfo;
    private cpuCheckInterval?;
    constructor(options: HealthConfig);
    /**
     * Initialize health monitoring
     */
    initialize(): Promise<void>;
    /**
     * Start periodic health monitoring
     */
    startMonitoring(intervalMs?: number): Promise<void>;
    /**
     * Stop health monitoring
     */
    stopMonitoring(): Promise<void>;
    /**
     * Perform comprehensive health check
     */
    performHealthCheck(): Promise<SystemHealthStatus>;
    /**
     * Get full health status
     */
    getFullStatus(): Promise<SystemHealthStatus>;
    /**
     * Get health history
     */
    getHealthHistory(limit?: number): Promise<HealthCheckResult[]>;
    /**
     * Check if system is healthy
     */
    isHealthy(): Promise<boolean>;
    /**
     * Private health check methods
     */
    private checkMemory;
    private checkMCP;
    private checkServiceNow;
    private checkQueen;
    private checkSystem;
    private checkPerformance;
    private createSkippedResult;
    private getSystemResources;
    private createHealthTables;
    private storeHealthResult;
    private checkAlerts;
    private calculateAverageResponseTime;
    /**
     * Calculate real CPU usage with averaging
     */
    private calculateCPUUsage;
    /**
     * Get real disk usage statistics
     */
    private getDiskUsage;
    /**
     * Get disk usage for Unix-based systems (macOS, Linux)
     */
    private getUnixDiskUsage;
    /**
     * Get disk usage for Windows systems
     */
    private getWindowsDiskUsage;
    /**
     * Get process-specific memory usage
     */
    private getProcessMemoryUsage;
    /**
     * Check network connectivity
     */
    private checkNetworkConnectivity;
    /**
     * Get additional SQLite database statistics
     */
    private getExtendedDatabaseStats;
    /**
     * Enhanced system check with more detailed metrics
     */
    private getEnhancedSystemMetrics;
}
export {};
//# sourceMappingURL=system-health.d.ts.map