/**
 * MCP On-Demand Manager
 * Starts MCP servers only when needed and stops them after inactivity
 */
import { ChildProcess } from 'child_process';
export declare class MCPOnDemandManager {
    private static instance;
    private servers;
    private inactivityTimeout;
    private cleanupInterval?;
    private constructor();
    static getInstance(): MCPOnDemandManager;
    /**
     * Get or start an MCP server on demand
     */
    getServer(serverName: string): Promise<ChildProcess>;
    /**
     * Start an MCP server
     */
    private startServer;
    /**
     * Wait for a server to finish starting
     */
    private waitForServer;
    /**
     * Stop a specific server
     */
    stopServer(serverName: string): Promise<void>;
    /**
     * Stop least recently used servers to free resources
     */
    private stopLeastRecentlyUsed;
    /**
     * Stop all inactive servers
     */
    private stopInactiveServers;
    /**
     * Start monitoring for inactive servers
     */
    private startInactivityMonitor;
    /**
     * Stop the inactivity monitor
     */
    stopInactivityMonitor(): void;
    /**
     * Get the script path for a server
     */
    private getScriptPath;
    /**
     * Get status of all servers
     */
    getStatus(): {
        total: number;
        running: number;
        stopped: number;
        servers: Array<{
            name: string;
            status: string;
            lastUsed: string;
            useCount: number;
            uptime?: string;
        }>;
    };
    /**
     * Stop all servers
     */
    stopAll(): Promise<void>;
}
//# sourceMappingURL=mcp-on-demand-manager.d.ts.map