/**
 * HTTP Transport Wrapper for MCP Servers
 * Converts stdio-based MCP servers to HTTP endpoints for containerization
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
export interface MCPServerConfig {
    name: string;
    port: number;
    version: string;
    healthCheckPath?: string;
    metricsPath?: string;
}
export declare class HttpTransportWrapper {
    private app;
    private mcpServer;
    private logger;
    private config;
    private serviceDiscovery;
    private resourceManager;
    private isReady;
    constructor(mcpServer: Server, config: MCPServerConfig);
    private setupMiddleware;
    private setupRoutes;
    private handleMCPRequest;
    private handleToolCall;
    private handleError;
    private generateMetrics;
    start(): Promise<void>;
}
//# sourceMappingURL=http-transport-wrapper.d.ts.map