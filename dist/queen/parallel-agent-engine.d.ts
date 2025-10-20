/**
 * Intelligent Parallel Agent Engine
 * Automatically detects parallelizable work and spawns optimized agent teams
 * Integrates with Queen Agent for enhanced multi-agent coordination
 */
import { EventEmitter } from 'eventemitter3';
import { TodoItem } from '../types/todo.types';
import { Agent, AgentType, ServiceNowTask } from './types';
import { QueenMemorySystem } from './queen-memory';
export interface ParallelizationOpportunity {
    id: string;
    type: 'independent_tasks' | 'specialized_breakdown' | 'load_distribution' | 'capability_split';
    todos: string[];
    suggestedAgents: AgentType[];
    estimatedSpeedup: number;
    confidence: number;
    dependencies: string[];
    blockers: string[];
}
export interface AgentWorkload {
    agentId: string;
    agentType: AgentType;
    assignedTodos: string[];
    estimatedDuration: number;
    utilization: number;
    capabilities: string[];
    specializations: string[];
}
export interface ParallelExecutionPlan {
    planId: string;
    opportunities: ParallelizationOpportunity[];
    agentTeam: AgentWorkload[];
    executionStrategy: 'wave_based' | 'concurrent' | 'pipeline' | 'hybrid';
    estimatedCompletion: number;
    maxParallelism: number;
    failureRecovery: 'retry' | 'reassign' | 'fallback';
}
export interface CapabilityMap {
    [todoPattern: string]: {
        primaryCapability: string;
        requiredAgentTypes: AgentType[];
        parallelizable: boolean;
        estimatedDuration: number;
        dependencies: string[];
    };
}
export declare class ParallelAgentEngine extends EventEmitter {
    private memory;
    private capabilityMap;
    private activeExecutionPlans;
    private agentWorkloads;
    private parallelizationHistory;
    private logger;
    constructor(memory: QueenMemorySystem);
    /**
     * Main entry point: Analyze todos and detect parallelization opportunities
     */
    detectParallelizationOpportunities(todos: TodoItem[], objectiveType: ServiceNowTask['type'], currentAgents: Agent[]): Promise<ParallelizationOpportunity[]>;
    /**
     * Create optimal execution plan based on opportunities
     */
    createExecutionPlan(opportunities: ParallelizationOpportunity[], todos: TodoItem[], maxAgents?: number): Promise<ParallelExecutionPlan>;
    /**
     * Execute parallel plan and coordinate agents
     */
    executeParallelPlan(plan: ParallelExecutionPlan, spawnAgentCallback: (type: AgentType, specialization?: string) => Promise<Agent>): Promise<{
        spawnedAgents: Agent[];
        executionDetails: {
            totalAgentsSpawned: number;
            parallelWorkflows: number;
            estimatedSpeedup: string;
        };
    }>;
    /**
     * Detect independent tasks that can run in parallel
     */
    private detectIndependentTasks;
    /**
     * Detect opportunities to break down complex tasks into specialized agents
     */
    private detectSpecializedBreakdown;
    /**
     * Detect load distribution opportunities (same work type, multiple agents)
     */
    private detectLoadDistribution;
    /**
     * Detect capability split opportunities (different skills for different parts)
     */
    private detectCapabilitySplit;
    /**
     * Calculate optimal agent team for execution plan
     */
    private calculateOptimalTeam;
    /**
     * Determine execution strategy based on opportunities and team
     */
    private determineExecutionStrategy;
    /**
     * Estimate completion time for agent team
     */
    private estimateCompletionTime;
    /**
     * Set up coordination between parallel agents
     */
    private setupParallelCoordination;
    /**
     * Utility methods
     */
    private areTasksIndependent;
    private suggestAgentsForTodos;
    private inferTodoCapability;
    private capabilityToAgentType;
    private analyzeTodoCapabilities;
    private todoRequiresAgentType;
    private inferBestAgentType;
    private estimateTodoDuration;
    private getAgentCapabilities;
    private getAgentSpecializations;
    private determineAgentSpecialization;
    private createCoordinationCheckpoints;
    private storeOpportunities;
    private setupLearningSystem;
    private initializeCapabilityMap;
    private generateId;
}
//# sourceMappingURL=parallel-agent-engine.d.ts.map