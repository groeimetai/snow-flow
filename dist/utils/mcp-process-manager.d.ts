/**
 * MCP Process Manager - SAFE VERSION
 * Emergency fix for memory crash issues
 * Implements graceful shutdown and memory-safe cleanup
 */
export declare class MCPProcessManager {
    private static instance;
    private readonly MAX_MCP_SERVERS;
    private readonly MAX_MEMORY_MB;
    private readonly CLEANUP_ENABLED;
    private readonly CLEANUP_INTERVAL;
    private cleanupTimer?;
    private isCleaningUp;
    private constructor();
    static getInstance(): MCPProcessManager;
    /**
     * Check if we can spawn a new MCP server
     */
    canSpawnServer(): boolean;
    /**
     * Get current MCP system status - SAFER VERSION
     */
    getSystemStatus(): {
        processCount: number;
        memoryUsageMB: number;
        processes: Array<{
            pid: number;
            memory: number;
            name: string;
        }>;
    };
    /**
     * Gracefully shutdown a process with timeout
     */
    private gracefulKill;
    /**
     * Kill duplicate MCP servers - SAFER VERSION
     */
    killDuplicates(): Promise<void>;
    /**
     * Emergency cleanup - only for critical situations
     */
    emergencyCleanup(): Promise<void>;
    /**
     * Safe cleanup - only when absolutely necessary
     */
    cleanup(): Promise<void>;
    /**
     * Start periodic cleanup - MUCH SAFER
     */
    private startPeriodicCleanup;
    /**
     * Stop periodic cleanup
     */
    stopPeriodicCleanup(): void;
    /**
     * Kill all MCP servers - USE WITH CAUTION
     */
    killAll(): Promise<void>;
    /**
     * Get resource usage summary
     */
    getResourceSummary(): string;
    /**
     * Get health status
     */
    getHealthStatus(): 'healthy' | 'warning' | 'critical';
}
export declare const mcpProcessManager: MCPProcessManager;
//# sourceMappingURL=mcp-process-manager.d.ts.map