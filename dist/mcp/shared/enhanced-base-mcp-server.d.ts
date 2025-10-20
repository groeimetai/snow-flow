/**
 * Enhanced Base MCP Server with Logging, Token Tracking, and ServiceNow Audit Logging
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServiceNowClientWithTracking } from '../../utils/servicenow-client-with-tracking.js';
import { MCPLogger } from './mcp-logger.js';
import { ServiceNowOAuth } from '../../utils/snow-oauth.js';
import { ServiceNowAuditLogger } from '../../utils/servicenow-audit-logger.js';
export interface MCPToolResult {
    content: Array<{
        type: string;
        text: string;
    }>;
    [key: string]: unknown;
}
export declare abstract class EnhancedBaseMCPServer {
    protected server: Server;
    protected client: ServiceNowClientWithTracking;
    protected logger: MCPLogger;
    protected auditLogger: ServiceNowAuditLogger;
    protected oauth: ServiceNowOAuth;
    protected isAuthenticated: boolean;
    protected serverName: string;
    constructor(name: string, version?: string);
    /**
     * Execute tool with enhanced tracking and audit logging
     */
    protected executeTool(toolName: string, handler: () => Promise<MCPToolResult>, params?: any): Promise<MCPToolResult>;
    /**
     * Validate ServiceNow connection with progress
     */
    protected validateConnection(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Create standardized response with tracking
     */
    protected createResponse(message: string, data?: any): MCPToolResult;
    /**
     * Query table with progress tracking and audit logging
     */
    protected queryTable(table: string, query: string, limit?: number): Promise<any>;
    /**
     * Create record with tracking and audit logging
     */
    protected createRecord(table: string, data: any): Promise<any>;
    /**
     * Update record with tracking and audit logging
     */
    protected updateRecord(table: string, sysId: string, data: any): Promise<any>;
    /**
     * Get record with tracking and audit logging
     */
    protected getRecord(table: string, sysId: string): Promise<any>;
    /**
     * Get client for direct use
     */
    getClient(): ServiceNowClientWithTracking;
    /**
     * Get logger for direct use
     */
    getLogger(): MCPLogger;
    /**
     * Get audit logger for direct use
     */
    getAuditLogger(): ServiceNowAuditLogger;
    /**
     * Cleanup resources and flush audit logs
     */
    cleanup(): Promise<void>;
}
//# sourceMappingURL=enhanced-base-mcp-server.d.ts.map