/**
 * Agent Context Provider for MCP Operations
 * Provides agent context awareness and tracking for all MCP tools
 */
import { AgentContext } from './mcp-memory-manager.js';
export interface MCPOperationContext {
    session_id: string;
    agent_id: string;
    agent_type: string;
    operation_name: string;
    mcp_server: string;
}
export interface OperationResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    duration_ms: number;
    memory_updates?: Record<string, any>;
}
export declare class AgentContextProvider {
    private memory;
    private logger;
    constructor();
    /**
     * Extract agent context from tool arguments or environment
     */
    extractAgentContext(args: any): AgentContext;
    /**
     * Execute an MCP operation with full agent context tracking
     */
    executeWithContext<T>(context: MCPOperationContext, operation: () => Promise<T>): Promise<OperationResult<T>>;
    /**
     * Report progress during long-running operations
     */
    reportProgress(context: AgentContext, progress: number, phase?: string): Promise<void>;
    /**
     * Notify other agents of handoff or completion
     */
    notifyHandoff(from_context: AgentContext, to_agent: string, artifact_info: {
        type: string;
        sys_id: string;
        next_steps: string[];
    }): Promise<void>;
    /**
     * Check for pending work from other agents
     */
    checkForHandoffs(context: AgentContext): Promise<any[]>;
    /**
     * Store artifact information with agent tracking
     */
    storeArtifact(context: AgentContext, artifact: {
        sys_id: string;
        type: string;
        name: string;
        description?: string;
        config?: any;
        update_set_id?: string;
    }): Promise<void>;
    /**
     * Request Queen intervention for critical issues
     */
    requestQueenIntervention(context: AgentContext, issue: {
        type: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        attempted_solutions?: string[];
    }): Promise<void>;
    /**
     * Get session artifacts created by all agents
     */
    getSessionArtifacts(session_id: string): Promise<any[]>;
    /**
     * Get current session context
     */
    getSessionContext(session_id: string): Promise<any>;
}
//# sourceMappingURL=agent-context-provider.d.ts.map