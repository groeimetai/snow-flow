/**
 * Intelligent Agent Detection System
 * Dynamically determines which agents to spawn based on task analysis
 *
 * NOTE: This system now integrates with the Snow-Flow MCP task_categorize tool
 * for dynamic AI-based categorization instead of static patterns.
 */
export interface AgentCapability {
    type: string;
    confidence: number;
    requiredFor: string[];
    description: string;
}
export interface TaskAnalysis {
    primaryAgent: string;
    supportingAgents: string[];
    complexity: 'simple' | 'medium' | 'complex';
    estimatedAgentCount: number;
    requiresUpdateSet: boolean;
    requiresApplication: boolean;
    taskType: string;
    serviceNowArtifacts: string[];
    confidence?: number;
    neuralConfidence?: number;
    intentAnalysis?: {
        primary: string;
        secondary: string[];
        actionVerbs: string[];
        targetObjects: string[];
        quantifiers: number[];
    };
    approach?: {
        recommendedStrategy: string;
        executionMode: string;
        parallelOpportunities: string[];
        riskFactors: string[];
        optimizationHints: string[];
    };
}
export declare class AgentDetector {
    private static mcpClient;
    /**
     * Set the MCP client for dynamic categorization
     */
    static setMCPClient(client: any): void;
    /**
     * Analyze task using MCP dynamic categorization or fallback to static patterns
     */
    static analyzeTaskDynamic(objective: string, userMaxAgents?: number): Promise<TaskAnalysis>;
    /**
     * Discover dynamic agents using MCP agent_discover
     */
    private static discoverDynamicAgents;
    /**
     * Extract required capabilities from intent analysis
     */
    private static extractCapabilitiesFromIntent;
    private static readonly AGENT_PATTERNS;
    private static readonly SERVICENOW_ARTIFACTS;
    static analyzeTask(objective: string, userMaxAgents?: number): TaskAnalysis;
    private static detectAgentCapabilities;
    private static determinePrimaryAgent;
    private static determineSupportingAgents;
    private static assessComplexity;
    private static detectServiceNowArtifacts;
    private static requiresUpdateSet;
    private static requiresApplication;
    private static determineTaskType;
    static generateAgentPrompt(agentType: string, objective: string, _analysis: TaskAnalysis): string;
}
//# sourceMappingURL=agent-detector.d.ts.map