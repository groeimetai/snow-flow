/**
 * MCP Persistent Server Guard
 * Ultimate protection against any MCP server shutdown
 * Overrides all possible shutdown mechanisms
 */
export declare class MCPPersistentGuard {
    private static instance;
    private logger;
    private isActive;
    private originalProcessKill;
    private originalProcessExit;
    private protectedProcesses;
    constructor();
    static getInstance(): MCPPersistentGuard;
    /**
     * Protect MCP processes from being killed
     */
    private installProcessProtection;
    /**
     * Warn about process exit attempts
     */
    private installExitProtection;
    /**
     * Check if PID belongs to MCP server
     */
    private isMCPProcess;
    /**
     * Monitor for shutdown attempts
     */
    private startShutdownMonitoring;
    /**
     * Register a process for protection
     */
    protectProcess(pid: number, name: string): void;
    /**
     * Remove protection (emergency use only)
     */
    removeProtection(pid: number): void;
    /**
     * Get protection status
     */
    getProtectionStatus(): {
        isActive: boolean;
        protectedProcessCount: number;
        protectedProcesses: Array<{
            pid: number;
            name: string;
        }>;
    };
}
//# sourceMappingURL=mcp-persistent-guard.d.ts.map