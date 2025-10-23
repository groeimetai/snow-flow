/**
 * Claude Agent SDK Integration Layer
 * Bridges Snow-Flow architecture with @anthropic-ai/claude-agent-sdk@0.1.1
 *
 * Purpose:
 * - Replace custom RealAgentSpawner with SDK's native agent spawning
 * - Integrate SDK's query() with our Memory System
 * - Provide hooks for agent coordination
 * - Simplify agent execution while keeping our intelligence
 */
import { MemorySystem } from '../memory/memory-system.js';
import { EventEmitter } from 'events';
/**
 * Agent specializations for ServiceNow development
 */
export type AgentType = 'workspace-specialist' | 'ui-builder-expert' | 'widget-creator' | 'script-writer' | 'integration-specialist' | 'tester' | 'security-specialist' | 'deployment-specialist' | 'researcher' | 'app-architect' | 'page-designer';
export interface SnowFlowAgentConfig {
    type: AgentType;
    objective: string;
    context?: Record<string, any>;
    mcpTools?: string[];
    memory?: MemorySystem;
    maxTurns?: number;
    model?: 'sonnet' | 'opus' | 'haiku';
}
export interface AgentExecutionResult {
    success: boolean;
    agentId: string;
    agentType: AgentType;
    artifacts: string[];
    output: string;
    tokensUsed: {
        input: number;
        output: number;
        total: number;
    };
    duration: number;
    error?: Error;
}
/**
 * Snow-Flow SDK Integration
 * Replaces 2800+ lines of custom agent code with SDK-native approach
 */
export declare class ClaudeAgentSDKIntegration extends EventEmitter {
    private memory;
    private logger;
    private activeQueries;
    constructor(memory: MemorySystem);
    /**
     * Spawn agent using Claude Agent SDK (replaces RealAgentSpawner)
     *
     * Before: 701 lines in RealAgentSpawner
     * After: Single query() call with proper instructions
     */
    spawnAgent(config: SnowFlowAgentConfig): Promise<AgentExecutionResult>;
    /**
     * Spawn multiple agents in parallel
     * Leverages our ParallelAgentEngine intelligence + SDK execution
     */
    spawnParallelAgents(configs: SnowFlowAgentConfig[]): Promise<AgentExecutionResult[]>;
    /**
     * Build agent instructions with Snow-Flow intelligence
     * Maps agent types to clear, actionable instructions
     */
    private buildAgentInstructions;
    /**
     * Type-specific instructions for different agent types
     */
    private getTypeSpecificInstructions;
    /**
     * Build MCP server configuration for SDK
     * Connects to our 448-tool unified server
     */
    private buildMCPServerConfig;
    /**
     * Build hooks for agent coordination
     * Integrates with our Memory System and progress tracking
     */
    private buildHooks;
    /**
     * Process agent execution stream
     * Extracts artifacts, tokens, and output
     */
    private processAgentExecution;
    /**
     * Control running agent (interrupt, change model, etc.)
     */
    controlAgent(agentId: string, action: 'interrupt' | 'pause'): Promise<void>;
    /**
     * Get agent status
     */
    getAgentStatus(agentId: string): 'active' | 'completed' | 'not-found';
    /**
     * Utility methods
     */
    private generateAgentId;
    private mapModelName;
    /**
     * Cleanup
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=claude-agent-sdk-integration.d.ts.map