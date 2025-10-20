/**
 * Queen Orchestrator - Intelligence Layer
 * Replaces 1380-line QueenAgent with focused 400-line orchestrator
 *
 * Responsibilities:
 * - Objective analysis (KEEP from old QueenAgent)
 * - Parallelization strategy (KEEP - use ParallelAgentEngine)
 * - Progress monitoring (KEEP)
 * - Agent spawning (REPLACE - use ClaudeAgentSDKIntegration)
 *
 * What's Gone:
 * - Agent spawning logic (SDK handles this)
 * - Message passing (Memory handles this)
 * - Agent lifecycle management (SDK handles this)
 */
import { EventEmitter } from 'events';
import { type AgentExecutionResult } from './claude-agent-sdk-integration.js';
import { MemorySystem } from '../memory/memory-system.js';
import type { TodoItem } from '../types/todo.types.js';
export interface QueenObjective {
    id: string;
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    constraints?: string[];
    metadata?: Record<string, any>;
}
export interface OrchestrationResult {
    objectiveId: string;
    success: boolean;
    agentsSpawned: number;
    artifactsCreated: string[];
    totalDuration: number;
    agentResults: AgentExecutionResult[];
    todos: TodoItem[];
}
/**
 * Queen Orchestrator - Intelligence-Focused Architecture
 *
 * Before: 1380 lines managing everything
 * After: ~400 lines of pure intelligence
 */
export declare class QueenOrchestrator extends EventEmitter {
    private sdkIntegration;
    private parallelEngine;
    private memory;
    private logger;
    private activeObjectives;
    constructor(memory: MemorySystem);
    /**
     * Main orchestration entry point
     * Analyzes objective → Plans execution → Spawns agents → Monitors progress
     */
    orchestrate(objective: string | QueenObjective): Promise<OrchestrationResult>;
    /**
     * INTELLIGENCE: Analyze objective to determine requirements
     * Kept from old QueenAgent - this is our domain expertise
     */
    private analyzeObjective;
    /**
     * INTELLIGENCE: Generate todos based on objective analysis
     * Kept from old QueenAgent - domain expertise
     */
    private generateTodos;
    /**
     * EXECUTION: Execute strategy using SDK
     * SIMPLIFIED: Just spawn agents - SDK handles execution
     */
    private executeStrategy;
    /**
     * INTELLIGENCE: Extract and deduplicate artifacts
     */
    private extractArtifacts;
    /**
     * INTELLIGENCE: Monitor progress (simplified)
     */
    monitorProgress(objectiveId: string): Promise<{
        overall: number;
        agentsActive: number;
        artifactsCreated: number;
    }>;
    /**
     * Setup event handlers for SDK integration
     */
    private setupEventHandlers;
    /**
     * Utility methods
     */
    private generateId;
    /**
     * Cleanup
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=queen-orchestrator.d.ts.map