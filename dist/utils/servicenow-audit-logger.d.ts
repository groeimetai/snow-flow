/**
 * ServiceNow Audit Logger - Snow-Flow Activity Tracking
 *
 * Extends the existing MCPLogger to send comprehensive audit logs
 * to ServiceNow for all Snow-Flow activities with token usage tracking.
 *
 * Creates audit trail with source 'snow-flow' for compliance & debugging.
 */
import { MCPLogger } from '../mcp/shared/mcp-logger.js';
import { ServiceNowClient } from './servicenow-client.js';
export interface AuditLogEntry {
    source: 'snow-flow';
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
    message: string;
    operation: string;
    table?: string;
    sys_id?: string;
    user_id?: string;
    token_usage?: {
        input: number;
        output: number;
        total: number;
    };
    duration_ms?: number;
    metadata?: any;
    timestamp: string;
    session_id?: string;
    mcp_server: string;
}
export declare class ServiceNowAuditLogger {
    private mcpLogger;
    private serviceNowClient?;
    private sessionId;
    private mcpServerName;
    private isEnabled;
    private auditQueue;
    private batchTimer?;
    constructor(mcpLogger: MCPLogger, mcpServerName: string);
    /**
     * Initialize with ServiceNow client for audit log transmission
     */
    setServiceNowClient(client: ServiceNowClient): void;
    /**
     * Generate unique session ID for tracking related operations
     */
    private generateSessionId;
    /**
     * Log Snow-Flow operation with comprehensive audit trail
     */
    logOperation(operation: string, level?: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', details?: {
        message?: string;
        table?: string;
        sys_id?: string;
        duration_ms?: number;
        metadata?: any;
        success?: boolean;
    }): Promise<void>;
    /**
     * Log API call with token tracking
     */
    logAPICall(apiMethod: string, table: string, operation: string, recordCount?: number, duration_ms?: number, success?: boolean): Promise<void>;
    /**
     * Log widget operations with specific tracking
     */
    logWidgetOperation(operation: 'pull' | 'push' | 'validate' | 'deploy', widgetSysId: string, widgetName?: string, duration_ms?: number, success?: boolean, errorDetails?: any): Promise<void>;
    /**
     * Log artifact sync operations
     */
    logArtifactSync(action: 'pull' | 'push' | 'cleanup', table: string, sys_id: string, artifactName?: string, fileCount?: number, duration_ms?: number, success?: boolean): Promise<void>;
    /**
     * Log script execution with ES5 validation
     */
    logScriptExecution(scriptType: 'background' | 'business_rule' | 'client_script', duration_ms?: number, success?: boolean, errorDetails?: any, outputLines?: number): Promise<void>;
    /**
     * Log authentication and token operations
     */
    logAuthOperation(operation: 'login' | 'token_refresh' | 'scope_elevation', success?: boolean, details?: any): Promise<void>;
    /**
     * Schedule batch sending to ServiceNow to avoid API flooding
     */
    private scheduleBatchSend;
    /**
     * Send audit log batch to ServiceNow
     */
    private sendAuditBatch;
    /**
     * Flush all pending audit logs immediately
     */
    flush(): Promise<void>;
    /**
     * Create audit logger wrapper for existing MCP server
     */
    static wrap(mcpLogger: MCPLogger, mcpServerName: string): ServiceNowAuditLogger;
    /**
     * Get audit statistics
     */
    getAuditStats(): {
        session_id: string;
        pending_logs: number;
        is_enabled: boolean;
        has_servicenow_client: boolean;
    };
}
export declare function getAuditLogger(mcpLogger: MCPLogger, mcpServerName: string): ServiceNowAuditLogger;
/**
 * Initialize all audit loggers with ServiceNow client
 */
export declare function initializeAuditLogging(serviceNowClient: ServiceNowClient): void;
//# sourceMappingURL=servicenow-audit-logger.d.ts.map