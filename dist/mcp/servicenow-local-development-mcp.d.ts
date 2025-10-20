#!/usr/bin/env node
/**
 * ServiceNow Local Development MCP Server
 *
 * Bridges ServiceNow artifacts with Claude Code's native file tools
 * by creating temporary local files that can be edited with full
 * Claude Code capabilities, then synced back to ServiceNow.
 *
 * THIS IS THE KEY TO POWERFUL SERVICENOW DEVELOPMENT!
 */
import { EnhancedBaseMCPServer } from './shared/enhanced-base-mcp-server.js';
export declare class ServiceNowLocalDevelopmentMCP extends EnhancedBaseMCPServer {
    private syncManager;
    constructor();
    private setupSyncManager;
    private setupHandlers;
    private pullArtifact;
    private pushArtifact;
    private getSyncStatus;
    private listSupportedArtifacts;
    private validateArtifactCoherence;
    private syncCleanup;
    private convertToES5;
    private debugWidgetFetch;
}
//# sourceMappingURL=servicenow-local-development-mcp.d.ts.map