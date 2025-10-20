/**
 * Snow-Flow Main Integration Layer
 * Coordinates all subsystems: Agents, Memory, MCPs, and ServiceNow
 */
import { EventEmitter } from 'events';
import { ISnowFlowConfig } from './config/snow-flow-config';
import { QueenOrchestrator } from './sdk/queen-orchestrator.js';
import { MemorySystem } from './memory/memory-system';
export interface SwarmSession {
    id: string;
    objective: string;
    startedAt: Date;
    status: 'initializing' | 'active' | 'completing' | 'completed' | 'failed';
    queenAgentId: string;
    activeAgents: Map<string, AgentInfo>;
    completedTasks: number;
    totalTasks: number;
    errors: Error[];
}
export interface AgentInfo {
    id: string;
    type: string;
    status: 'spawned' | 'active' | 'blocked' | 'completed' | 'failed';
    assignedTasks: string[];
    progress: number;
    lastActivity: Date;
}
export declare class SnowFlowSystem extends EventEmitter {
    private config;
    private queen?;
    private memory?;
    private performanceTracker?;
    private systemHealth?;
    private errorRecovery;
    private logger;
    private sessions;
    private initialized;
    constructor(config?: Partial<ISnowFlowConfig>);
    /**
     * Initialize the entire Snow-Flow system
     */
    initialize(): Promise<void>;
    /**
     * Initialize Memory System with SQLite
     */
    private initializeMemory;
    /**
     * Initialize Queen Orchestrator (SDK-based)
     * NOTE: MCP servers are now automatically managed by Claude Agent SDK
     */
    private initializeQueen;
    /**
     * Initialize Performance Tracking
     */
    private initializePerformanceTracking;
    /**
     * Initialize System Health Monitoring
     */
    private initializeHealthMonitoring;
    /**
     * Execute a swarm objective
     */
    executeSwarm(objective: string, options?: SwarmOptions): Promise<SwarmResult>;
    /**
     * Get system status
     */
    getStatus(): Promise<SystemStatus>;
    /**
     * Shutdown the system gracefully
     */
    shutdown(): Promise<void>;
    /**
     * Get session information
     */
    getSession(sessionId: string): SwarmSession | undefined;
    /**
     * List all sessions
     */
    listSessions(filter?: {
        status?: string;
    }): SwarmSession[];
    /**
     * Get memory system instance
     */
    getMemory(): MemorySystem | undefined;
    /**
     * Get Queen Orchestrator instance
     */
    getQueenOrchestrator(): QueenOrchestrator | undefined;
    /**
     * Private helper methods
     */
    private generateSessionId;
    private updateAgentInfo;
    private gracefullyCompleteSession;
    private calculateSuccessRate;
    private calculateAverageExecutionTime;
}
export interface SwarmOptions {
    strategy?: 'research' | 'development' | '_analysis' | 'testing' | 'optimization' | 'maintenance';
    mode?: 'centralized' | 'distributed' | 'hierarchical' | 'mesh' | 'hybrid';
    maxAgents?: number;
    parallel?: boolean;
    monitor?: boolean;
    autoPermissions?: boolean;
    smartDiscovery?: boolean;
    liveTesting?: boolean;
    autoDeploy?: boolean;
    autoRollback?: boolean;
    sharedMemory?: boolean;
    progressMonitoring?: boolean;
}
export interface SwarmResult {
    sessionId: string;
    success: boolean;
    artifacts: any[];
    summary: string;
    metrics: any;
}
export interface SystemStatus {
    initialized: boolean;
    status: string;
    components: Record<string, any>;
    activeSessions?: number;
    metrics?: any;
}
export declare const snowFlowSystem: SnowFlowSystem;
//# sourceMappingURL=snow-flow-system.d.ts.map