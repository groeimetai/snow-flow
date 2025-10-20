#!/usr/bin/env node
/**
 * MCP Tool Registry Mapper
 *
 * Solves Issue #2: Tool Registry Mapping Failures
 * Provides robust tool name resolution between different MCP providers
 */
export interface ToolMapping {
    canonicalName: string;
    aliases: string[];
    provider: string;
    actualTool: string;
    description?: string;
}
export declare class MCPToolRegistry {
    private toolMappings;
    private logger;
    constructor();
    /**
     * Initialize default tool mappings
     */
    private initializeDefaultMappings;
    /**
     * Register a tool mapping
     */
    registerTool(mapping: ToolMapping): void;
    /**
     * Resolve a tool name to its actual MCP tool
     */
    resolveTool(toolName: string): string | null;
    /**
     * Get all tools for a provider
     */
    getProviderTools(provider: string): ToolMapping[];
    /**
     * Search tools by keyword
     */
    searchTools(keyword: string): ToolMapping[];
    /**
     * Check if a tool exists
     */
    toolExists(toolName: string): boolean;
    /**
     * Get tool info
     */
    getToolInfo(toolName: string): ToolMapping | null;
    /**
     * Export all mappings for documentation
     */
    exportMappings(): Record<string, ToolMapping>;
}
/**
 * Get or create registry instance
 */
export declare function getToolRegistry(): MCPToolRegistry;
/**
 * Helper function to resolve tool names
 */
export declare function resolveToolName(toolName: string): string;
/**
 * Helper to check if tool exists
 */
export declare function isValidTool(toolName: string): boolean;
/**
 * Helper to get tool suggestions
 */
export declare function suggestTools(partial: string): ToolMapping[];
export default MCPToolRegistry;
//# sourceMappingURL=mcp-tool-registry.d.ts.map