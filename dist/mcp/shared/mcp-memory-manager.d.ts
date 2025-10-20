/**
 * MCP Memory Manager
 * Shared memory integration for all MCP servers to coordinate with agents
 */
export interface AgentContext {
    session_id: string;
    agent_id: string;
    agent_type: string;
    required_scopes?: string[];
}
export interface ArtifactRecord {
    sys_id: string;
    artifact_type: string;
    name: string;
    description?: string;
    created_by_agent: string;
    session_id: string;
    deployment_status: string;
    update_set_id?: string;
    dependencies?: string;
    metadata?: string;
}
export interface AgentCoordination {
    session_id: string;
    agent_id: string;
    agent_type: string;
    status: 'spawned' | 'active' | 'blocked' | 'completed';
    assigned_tasks?: string;
    progress_percentage: number;
    last_activity: Date;
    current_tool?: string;
    error_state?: string;
}
export interface SharedContext {
    session_id: string;
    context_key: string;
    context_value: string;
    created_by_agent: string;
    expires_at?: Date;
    access_permissions?: string;
}
export interface AgentMessage {
    id: string;
    session_id: string;
    from_agent: string;
    to_agent: string;
    message_type: 'handoff' | 'dependency_ready' | 'error' | 'status_update';
    content: string;
    artifact_reference?: string;
    timestamp: Date;
    processed: boolean;
}
export interface PerformanceMetric {
    session_id: string;
    agent_id: string;
    operation_name: string;
    duration_ms: number;
    success: boolean;
    error_message?: string;
    timestamp: Date;
}
export declare class MCPMemoryManager {
    private db;
    private logger;
    private static instance;
    private constructor();
    static getInstance(): MCPMemoryManager;
    private initializeDatabase;
    getSessionContext(session_id: string): Promise<any>;
    getActiveAgents(session_id: string): Promise<AgentCoordination[]>;
    storeArtifact(artifact: ArtifactRecord): Promise<void>;
    updateSharedContext(context: SharedContext): Promise<void>;
    updateAgentCoordination(coordination: Partial<AgentCoordination> & {
        agent_id: string;
        session_id: string;
    }): Promise<void>;
    sendAgentMessage(message: Omit<AgentMessage, 'id' | 'timestamp' | 'processed'>): Promise<void>;
    checkForMessages(agent_id: string, session_id: string): Promise<AgentMessage[]>;
    trackPerformance(metric: Omit<PerformanceMetric, 'timestamp'>): Promise<void>;
    recordDeployment(session_id: string, artifact_sys_id: string, deployment_type: string, success: boolean, agent_id: string, error_details?: string): Promise<void>;
    getArtifact(sys_id: string): Promise<ArtifactRecord | null>;
    getSessionArtifacts(session_id: string): Promise<ArtifactRecord[]>;
    clearSession(session_id: string): Promise<void>;
    query(sql: string, params?: any[]): Promise<any[]>;
    close(): void;
}
//# sourceMappingURL=mcp-memory-manager.d.ts.map