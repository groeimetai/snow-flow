/**
 * MCP Execution Bridge
 *
 * Bridges the gap between agent recommendations and actual MCP tool execution
 * Enables Queen Agent and specialized agents to directly execute ServiceNow operations
 */
import { EventEmitter } from 'eventemitter3';
import { QueenMemorySystem } from './queen-memory.js';
export interface AgentRecommendation {
    agentId: string;
    agentType: string;
    action: string;
    tool: string;
    server: string;
    params: any;
    reasoning: string;
    confidence: number;
    dependencies?: string[];
}
export interface MCPExecutionResult {
    success: boolean;
    recommendation: AgentRecommendation;
    toolResult?: any;
    error?: string;
    executionTime: number;
    retries?: number;
    fallbackUsed?: boolean;
}
export interface MCPServerConfig {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
}
/**
 * Maps agent recommendations to MCP tool calls and executes them
 */
export declare class MCPExecutionBridge extends EventEmitter {
    private mcpClients;
    private mcpProcesses;
    private sessionAuth;
    private memory;
    private logger;
    private serverConfigs;
    private toolServerMap;
    constructor(memory?: QueenMemorySystem);
    /**
     * Execute an agent recommendation by calling the appropriate MCP tool
     */
    executeAgentRecommendation(agent: {
        id: string;
        type: string;
    }, recommendation: AgentRecommendation): Promise<MCPExecutionResult>;
    /**
     * Map agent recommendation to specific MCP tool
     */
    private mapRecommendationToTool;
    /**
     * Intelligent tool mapping based on action description
     */
    private intelligentToolMapping;
    /**
     * Ensure MCP client is connected and ready
     */
    private ensureMCPClient;
    /**
     * Execute tool with authentication
     */
    private executeToolWithAuth;
    /**
     * Store execution result in shared memory
     */
    private storeExecutionResult;
    /**
     * Store execution failure for learning
     */
    private storeExecutionFailure;
    /**
     * Try fallback strategies when primary execution fails
     */
    private tryFallbackStrategies;
    /**
     * Try using an alternative tool
     */
    private tryAlternativeTool;
    /**
     * Try with simplified parameters
     */
    private trySimplifiedParams;
    /**
     * Generate manual steps as fallback
     */
    private tryManualSteps;
    /**
     * Helper methods
     */
    private getAgentExecutionCount;
    private classifyError;
    private adaptParamsForTool;
    private simplifyParams;
    private generateManualSteps;
    /**
     * Cleanup resources
     */
    cleanup(): Promise<void>;
    /**
     * Disconnect from MCP resources
     */
    disconnect(): Promise<void>;
    /**
     * Public shutdown method for cleanup
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=mcp-execution-bridge.d.ts.map