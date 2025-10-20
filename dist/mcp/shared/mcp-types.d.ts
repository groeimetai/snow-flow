/**
 * MCP Types
 * Common types for MCP server implementations
 */
export interface MCPServerConfig {
    name: string;
    description?: string;
    version?: string;
}
export interface MCPTool {
    name: string;
    description: string;
    inputSchema: any;
}
export interface MCPResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface MCPRequest {
    tool: string;
    params: any;
}
export interface MCPLogger {
    info(message: string, meta?: any): void;
    warn(message: string, meta?: any): void;
    error(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
}
export interface MCPMemoryManager {
    store(key: string, value: any): Promise<void>;
    retrieve(key: string): Promise<any>;
    delete(key: string): Promise<boolean>;
    list(): Promise<string[]>;
}
export interface MCPToolResult {
    content: Array<{
        type: string;
        text: string;
    }>;
}
export interface MCPToolResult {
    success?: boolean;
    content: Array<{
        type: string;
        text: string;
    }>;
    [key: string]: any;
}
//# sourceMappingURL=mcp-types.d.ts.map