export interface SnowAgent {
    id: string;
    name: string;
    type: AgentType;
    status: AgentStatus;
    capabilities: string[];
    metadata: Record<string, any>;
    createdAt: Date;
    lastActivity: Date;
}
export type AgentType = 'coordinator' | 'researcher' | 'coder' | 'analyst' | 'architect' | 'tester' | 'reviewer' | 'optimizer' | 'documenter' | 'monitor' | 'servicenow-specialist' | 'workflow-designer' | 'ui-builder' | 'security-auditor' | 'integration-specialist' | 'widget-creator' | 'widget-builder' | 'flow-builder' | 'script-writer' | 'security-agent' | 'app-architect' | 'css-specialist' | 'backend-specialist' | 'frontend-specialist' | 'ui-ux-specialist' | 'performance-specialist' | 'accessibility-specialist' | 'trigger-specialist' | 'action-specialist' | 'approval-specialist' | 'notification-specialist' | 'error-handler' | 'security-specialist' | 'api-specialist' | 'transform-specialist' | 'monitoring-specialist' | 'documentation-specialist';
export type AgentStatus = 'idle' | 'busy' | 'error' | 'terminated';
export interface Task {
    id: string;
    type: TaskType;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    assignedAgent?: string;
    dependencies: string[];
    result?: any;
    error?: Error;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
    metadata: Record<string, any>;
}
export type TaskType = 'research' | 'development' | '_analysis' | 'testing' | 'optimization' | 'documentation' | 'servicenow-config' | 'servicenow-script' | 'servicenow-workflow' | 'servicenow-ui';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export interface SwarmConfig {
    maxAgents: number;
    topology: SwarmTopology;
    strategy: SwarmStrategy;
    enableParallel: boolean;
    enableMonitoring: boolean;
    memoryNamespace: string;
}
export type SwarmTopology = 'hierarchical' | 'mesh' | 'ring' | 'star';
export type SwarmStrategy = 'balanced' | 'specialized' | 'adaptive' | 'auto';
export interface MemoryEntry {
    key: string;
    value: any;
    namespace: string;
    ttl?: number;
    createdAt: Date;
    updatedAt: Date;
    accessCount: number;
    metadata: Record<string, any>;
}
export interface OrchestratorEvents {
    'agent:spawned': (agent: SnowAgent) => void;
    'agent:terminated': (agentId: string) => void;
    'agent:status': (agentId: string, status: AgentStatus) => void;
    'task:created': (task: Task) => void;
    'task:assigned': (taskId: string, agentId: string) => void;
    'task:completed': (taskId: string, result: any) => void;
    'task:failed': (taskId: string, error: Error) => void;
    'swarm:initialized': (config: SwarmConfig) => void;
    'error': (error: Error) => void;
}
export interface BaseOrchestratorOptions {
    maxConcurrentTasks?: number;
    taskTimeout?: number;
    memoryNamespace?: string;
    enableLogging?: boolean;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
export interface ServiceNowConfig {
    instance: string;
    username?: string;
    password?: string;
    clientId?: string;
    clientSecret?: string;
    authMethod: 'basic' | 'oauth';
    apiVersion?: string;
}
export interface ServiceNowContext {
    config: ServiceNowConfig;
    currentApp?: string;
    updateSet?: string;
    scope?: string;
    tables?: string[];
}
export interface AgentMessage {
    from: string;
    to: string;
    type: MessageType;
    payload: any;
    timestamp: Date;
    correlationId?: string;
}
export type MessageType = 'task_assignment' | 'task_result' | 'coordination' | 'knowledge_share' | 'status_update' | 'error';
export interface WorkflowDefinition {
    id: string;
    name: string;
    description: string;
    steps: WorkflowStep[];
    triggers?: WorkflowTrigger[];
    variables?: Record<string, any>;
}
export interface WorkflowStep {
    id: string;
    name: string;
    type: string;
    config: Record<string, any>;
    dependencies: string[];
    outputs?: string[];
}
export interface WorkflowTrigger {
    type: 'manual' | 'schedule' | 'event' | 'webhook';
    config: Record<string, any>;
}
//# sourceMappingURL=snow-flow.types.d.ts.map