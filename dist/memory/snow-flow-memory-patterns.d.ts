/**
 * Snow-Flow Memory Patterns
 * Common memory patterns and utilities for Snow-Flow
 */
export interface MemoryPattern {
    pattern: string;
    namespace: string;
    type: string;
}
export declare const MEMORY_PATTERNS: {
    readonly AGENT: "agent/*";
    readonly TASK: "task/*";
    readonly SESSION: "session/*";
    readonly ARTIFACT: "artifact/*";
    readonly CONFIG: "config/*";
    readonly TEMP: "temp/*";
};
export declare const MEMORY_NAMESPACES: {
    readonly QUEEN: "queen";
    readonly AGENTS: "agents";
    readonly TASKS: "tasks";
    readonly SESSIONS: "sessions";
    readonly ARTIFACTS: "artifacts";
    readonly CONFIG: "config";
    readonly TEMP: "temp";
};
export declare function createMemoryKey(namespace: string, type: string, id: string): string;
export declare function parseMemoryKey(key: string): {
    namespace: string;
    type: string;
    id: string;
} | null;
export declare function matchesPattern(key: string, pattern: string): boolean;
export declare class SnowFlowMemoryOrganizer {
    static organize(data: any): any;
}
export declare const SNOW_FLOW_AGENT_CAPABILITIES: {
    RESEARCHER: string;
    CODER: string;
    ANALYST: string;
};
export interface HierarchicalMemoryEntry {
    key: string;
    value: any;
    namespace: string;
}
export interface MemorySearchOptions {
    pattern?: string;
    limit?: number;
    namespace?: string;
}
//# sourceMappingURL=snow-flow-memory-patterns.d.ts.map