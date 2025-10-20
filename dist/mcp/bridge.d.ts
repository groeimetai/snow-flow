export interface MCPStartup {
    cmd: string;
    args?: string[];
    env?: Record<string, string>;
}
export declare function loadMCPTools(start: MCPStartup): Promise<{
    tools: any[];
    close: () => Promise<void>;
}>;
//# sourceMappingURL=bridge.d.ts.map