/**
 * Universal Agent Spawner - OpenCode Compatible
 * Uses Vercel AI SDK instead of Claude Agent SDK for true multi-model support
 *
 * Purpose:
 * - Replace Claude Agent SDK with provider-agnostic Vercel AI SDK
 * - Support ANY LLM via LiteLLM proxy
 * - Integrate MCP tools manually (no auto-discovery)
 * - Provide same interface as ClaudeAgentSDKIntegration for backward compatibility
 */
import { MemorySystem } from '../memory/memory-system.js';
import { EventEmitter } from 'events';
import type { AgentType } from '../queen/types.js';
export interface SnowFlowAgentConfig {
    type: AgentType;
    objective: string;
    context?: Record<string, any>;
    mcpTools?: string[];
    memory?: MemorySystem;
    maxTurns?: number;
    model?: string;
    provider?: string;
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
    providerUsed?: string;
    modelUsed?: string;
    cost?: number;
}
export interface LLMConfig {
    provider: string;
    model: string;
    baseURL?: string;
    apiKey?: string;
    apiKeyEnv?: string;
}
/**
 * Universal Agent Spawner - Vercel AI SDK Based
 * TRUE BYOLLM support - works with ANY LLM provider via LiteLLM
 */
export declare class UniversalAgentSpawner extends EventEmitter {
    private memory;
    private logger;
    private llmConfig?;
    private activeAgents;
    private mcpToolManager;
    private mcpInitialized;
    constructor(memory: MemorySystem, llmConfig?: LLMConfig);
    /**
     * Initialize MCP servers (call this once before spawning agents)
     */
    initialize(): Promise<void>;
    /**
     * Spawn agent using Vercel AI SDK (replaces Claude Agent SDK)
     *
     * Before: Claude Agent SDK query() - Claude models only
     * After: Vercel AI SDK generateText() - ANY model via LiteLLM
     */
    spawnAgent(config: SnowFlowAgentConfig): Promise<AgentExecutionResult>;
    /**
     * Build agent instructions with Snow-Flow context
     */
    private buildAgentInstructions;
    /**
     * Get agent-specific capabilities
     */
    private getAgentCapabilities;
    /**
     * Build MCP tools for Vercel AI SDK
     */
    private buildMCPTools;
    /**
     * Process agent execution result
     */
    private processAgentExecution;
    /**
     * Extract ServiceNow sys_ids from agent output
     */
    private extractArtifacts;
    /**
     * Calculate cost for token usage
     */
    private calculateCost;
    /**
     * Utility methods
     */
    private generateAgentId;
    /**
     * Get active agent status
     */
    getActiveAgents(): string[];
    /**
     * Interrupt agent (for graceful shutdown)
     */
    interruptAgent(agentId: string): Promise<boolean>;
    /**
     * Cleanup
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=universal-agent-spawner.d.ts.map