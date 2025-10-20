/**
 * ServiceNow Queen Agent Types
 * Simple, elegant type definitions for the hive-mind
 */
export interface ServiceNowTask {
    id: string;
    objective: string;
    type: 'widget' | 'portal_page' | 'flow' | 'script' | 'application' | 'integration' | 'workspace' | 'unknown';
    artifacts: string[];
    status: 'analyzing' | 'planning' | 'executing' | 'completed' | 'failed';
    result?: any;
    error?: string;
}
export interface Agent {
    id: string;
    type: AgentType;
    status: 'idle' | 'working' | 'completed' | 'failed' | 'active';
    task?: string;
    capabilities: string[];
    mcpTools: string[];
    objectiveId?: string;
    specialization?: string;
    startTime?: number;
}
export type AgentType = 'widget-creator' | 'flow-builder' | 'script-writer' | 'app-architect' | 'integration-specialist' | 'catalog-manager' | 'researcher' | 'tester' | 'ui-ux-specialist' | 'approval-specialist' | 'security-specialist' | 'css-specialist' | 'backend-specialist' | 'frontend-specialist' | 'performance-specialist' | 'page-designer' | 'workspace-specialist' | 'ui-builder-expert' | 'deployment-specialist';
export interface DeploymentPattern {
    taskType: string;
    successRate: number;
    agentSequence: AgentType[];
    mcpSequence: string[];
    avgDuration: number;
    lastUsed: Date;
    decision?: string;
    outcome?: string;
    useCount?: number;
}
export interface QueenMemory {
    patterns: DeploymentPattern[];
    artifacts: Map<string, any>;
    agentHistory: Map<string, Agent[]>;
    learnings: Map<string, string>;
}
export interface TaskAnalysis {
    type: ServiceNowTask['type'];
    requiredAgents: AgentType[];
    estimatedComplexity: number;
    complexity?: string;
    suggestedPattern?: DeploymentPattern;
    dependencies: string[];
}
export interface AgentMessage {
    from: string;
    to: string;
    type: 'task' | 'result' | 'error' | 'query' | 'coordination' | 'task_assignment';
    content: any;
    timestamp: Date;
}
export interface ServiceNowArtifact {
    type: 'widget' | 'portal_page' | 'flow' | 'script' | 'table' | 'catalog_item';
    name: string;
    sys_id?: string;
    config: any;
    dependencies: string[];
}
//# sourceMappingURL=types.d.ts.map