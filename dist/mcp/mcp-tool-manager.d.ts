/**
 * MCP Tool Manager - OpenCode Compatible
 * Manages connections to MCP servers and converts tools to Vercel AI SDK format
 *
 * Purpose:
 * - Connect to local MCP servers (stdio transport)
 * - Discover available tools from all connected servers
 * - Convert MCP tool schemas to Vercel AI SDK CoreTool format
 * - Execute tool calls via MCP protocol
 */
import type { Tool } from '@ai-sdk/provider-utils';
export interface MCPServerConfig {
    name: string;
    command: string;
    args?: string[];
    env?: Record<string, string>;
    enabled?: boolean;
}
export interface MCPToolInfo {
    name: string;
    description: string;
    schema: any;
    serverName: string;
}
/**
 * MCP Tool Manager
 * Connects to MCP servers and manages tool integration
 */
export declare class MCPToolManager {
    private logger;
    private servers;
    private tools;
    private connected;
    constructor();
    /**
     * Connect to all configured MCP servers
     */
    connectToServers(configs: MCPServerConfig[]): Promise<void>;
    /**
     * Connect to a single MCP server via stdio transport
     */
    private connectToServer;
    /**
     * Discover tools from all connected servers
     */
    private discoverTools;
    /**
     * Get all tools in Vercel AI SDK format
     */
    getToolsForAI(): Record<string, Tool>;
    /**
     * Execute a tool via MCP
     */
    private executeTool;
    /**
     * Get tool information
     */
    getToolInfo(toolName: string): MCPToolInfo | undefined;
    /**
     * Get all tool names
     */
    getToolNames(): string[];
    /**
     * Get tools grouped by server
     */
    getToolsByServer(): Map<string, string[]>;
    /**
     * Check if connected
     */
    isConnected(): boolean;
    /**
     * Shutdown all MCP connections
     */
    shutdown(): Promise<void>;
}
/**
 * Get default Snow-Flow MCP server configurations
 */
export declare function getDefaultMCPServerConfigs(): MCPServerConfig[];
//# sourceMappingURL=mcp-tool-manager.d.ts.map