/**
 * ServiceNow Agent Factory
 * Dynamic agent spawning based on task analysis
 */
import { Agent, AgentType, ServiceNowTask, AgentMessage } from './types';
import { QueenMemorySystem } from './queen-memory';
interface AgentBlueprint {
    type: AgentType;
    capabilities: string[];
    mcpTools: string[];
    personality: string;
    coordination: 'independent' | 'collaborative' | 'dependent';
}
export declare class AgentFactory {
    private memory;
    private activeAgents;
    private agentBlueprints;
    private messageQueue;
    constructor(memory: QueenMemorySystem);
    private initializeBlueprints;
    spawnAgent(type: AgentType, taskId?: string): Agent;
    spawnAgentSwarm(agentTypes: AgentType[], taskId: string): Agent[];
    private setupAgentCoordination;
    getOptimalAgentSequence(taskType: ServiceNowTask['type'], complexity: number): AgentType[];
    executeAgentTask(agentId: string, instruction: string): Promise<any>;
    private executeWithMcpTools;
    private generateExecutionPlan;
    sendAgentMessage(from: string, to: string, type: AgentMessage['type'], content: any): void;
    getAgentMessages(agentId: string): AgentMessage[];
    markMessagesProcessed(agentId: string): void;
    getAgentStatus(agentId: string): Agent | null;
    terminateAgent(agentId: string): void;
    getActiveAgents(): Agent[];
    cleanupCompletedAgents(): number;
    private generateAgentId;
    getAgentBlueprint(type: AgentType): AgentBlueprint | null;
    getStatistics(): any;
    createDynamicAgent(type: AgentType, taskId?: string): Promise<Agent | null>;
    private createDynamicBlueprint;
    private inferCapabilitiesFromType;
    private inferMCPToolsFromType;
    executeWithSpecializedAgent(type: AgentType, instruction: string, context?: any): Promise<any>;
}
export {};
//# sourceMappingURL=agent-factory.d.ts.map