#!/usr/bin/env node
/**
 * ServiceNow MCP Server
 * Provides Claude Code with direct access to ServiceNow APIs via MCP protocol
 */
interface ServiceNowMCPConfig {
    name: string;
    version: string;
    oauth?: {
        instance: string;
        clientId: string;
        clientSecret: string;
    };
}
declare class ServiceNowMCPServer {
    private server;
    private snowClient;
    private oauth;
    private config;
    private isAuthenticated;
    constructor(config: ServiceNowMCPConfig);
    private checkAuthentication;
    private setupRequestHandlers;
    private setupToolHandlers;
    private handleAuthStatus;
    private handleCreateWidget;
    private handleUpdateWidget;
    private handleGetWidget;
    private handleListWidgets;
    private handleCreateWorkflow;
    private handleExecuteScript;
    private handleTestConnection;
    private handleGetInstanceInfo;
    run(): Promise<void>;
}
export { ServiceNowMCPServer };
//# sourceMappingURL=servicenow-mcp-server.d.ts.map