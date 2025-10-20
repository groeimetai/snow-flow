/**
 * MCP Singleton Lock Utility
 * Prevents duplicate MCP server instances across all start mechanisms
 */
export declare class MCPSingletonLock {
    private lockDir;
    private lockFile;
    private acquired;
    constructor();
    /**
     * Acquire singleton lock to prevent duplicate MCP server instances
     */
    acquire(): boolean;
    /**
     * Release the singleton lock
     */
    release(): void;
    /**
     * Release the singleton lock without blocking (for graceful shutdown)
     */
    releaseAsync(): Promise<void>;
    /**
     * Check if lock is currently held by this process
     */
    isAcquired(): boolean;
    /**
     * Setup cleanup handlers to release lock on process exit
     */
    private setupCleanupHandlers;
    /**
     * Force release any existing lock (for cleanup scripts)
     */
    static forceRelease(): boolean;
}
/**
 * Get the global MCP singleton lock instance
 */
export declare function getMCPSingletonLock(): MCPSingletonLock;
//# sourceMappingURL=mcp-singleton-lock.d.ts.map