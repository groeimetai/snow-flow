/**
 * Dynamic Agent Discovery Methods
 * To be integrated into snow-flow-mcp.ts
 */
export declare const agentDiscoveryMethods: {
    handleAgentDiscover(args: any): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    getBaseAgentTypes(): string[];
    generateAgentName(type: string): string;
    discoverAgentForCapability(capability: string): any;
    createAgentBatches(agents: any[], dependencies: {
        [key: string]: string[];
    }): string[][];
    findCriticalPath(batches: string[][]): string[];
    storeAgentDiscovery(taskAnalysis: any, agents: any[]): void;
};
//# sourceMappingURL=agent-discovery-methods.d.ts.map