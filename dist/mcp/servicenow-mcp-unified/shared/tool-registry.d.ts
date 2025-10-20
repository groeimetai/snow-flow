/**
 * Tool Registry with Auto-Discovery
 *
 * Automatically discovers and registers tools from the tools/ directory.
 * Supports dynamic loading, validation, and hot-reload during development.
 */
import { MCPToolDefinition, RegisteredTool, ToolDiscoveryResult, ToolRegistryConfig } from './types';
export declare class ToolRegistry {
    private tools;
    private config;
    private discoveryInProgress;
    constructor(config?: Partial<ToolRegistryConfig>);
    /**
     * Initialize tool registry with auto-discovery
     */
    initialize(): Promise<ToolDiscoveryResult>;
    /**
     * Discover all domain directories
     */
    private discoverDomains;
    /**
     * Discover tools in a specific domain
     */
    private discoverDomainTools;
    /**
     * Load and register a tool from a file
     */
    private loadAndRegisterTool;
    /**
     * Validate tool definition structure
     */
    private validateToolDefinition;
    /**
     * Get all registered tool definitions (for MCP server)
     */
    getToolDefinitions(): MCPToolDefinition[];
    /**
     * Get registered tool by name
     */
    getTool(name: string): RegisteredTool | undefined;
    /**
     * Execute a tool by name
     */
    executeTool(name: string, args: Record<string, any>, context: any): Promise<any>;
    /**
     * Get tools by domain
     */
    getToolsByDomain(domain: string): RegisteredTool[];
    /**
     * Get all domains
     */
    getDomains(): string[];
    /**
     * Get registry statistics
     */
    getStatistics(): {
        totalTools: number;
        totalDomains: number;
        toolsByDomain: Record<string, number>;
    };
    /**
     * Export tool definitions to JSON file
     */
    private exportToolDefinitions;
    /**
     * Reload tools from disk (for development hot-reload)
     */
    reload(): Promise<ToolDiscoveryResult>;
    /**
     * Clear all registered tools
     */
    clear(): void;
}
export declare const toolRegistry: ToolRegistry;
//# sourceMappingURL=tool-registry.d.ts.map