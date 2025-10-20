"use strict";
/**
 * ServiceNow Audit Logger - Snow-Flow Activity Tracking
 *
 * Extends the existing MCPLogger to send comprehensive audit logs
 * to ServiceNow for all Snow-Flow activities with token usage tracking.
 *
 * Creates audit trail with source 'snow-flow' for compliance & debugging.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowAuditLogger = void 0;
exports.getAuditLogger = getAuditLogger;
exports.initializeAuditLogging = initializeAuditLogging;
class ServiceNowAuditLogger {
    constructor(mcpLogger, mcpServerName) {
        this.isEnabled = true;
        this.auditQueue = [];
        this.mcpLogger = mcpLogger;
        this.mcpServerName = mcpServerName;
        this.sessionId = this.generateSessionId();
        // Enable audit logging if not explicitly disabled
        this.isEnabled = process.env.SNOW_FLOW_AUDIT_LOGGING !== 'false';
        if (this.isEnabled) {
            this.mcpLogger.info('🔍 ServiceNow Audit Logger initialized', {
                source: 'snow-flow',
                session_id: this.sessionId,
                mcp_server: this.mcpServerName
            });
        }
    }
    /**
     * Initialize with ServiceNow client for audit log transmission
     */
    setServiceNowClient(client) {
        this.serviceNowClient = client;
        if (this.isEnabled) {
            this.mcpLogger.info('🔗 ServiceNow client connected for audit logging');
        }
    }
    /**
     * Generate unique session ID for tracking related operations
     */
    generateSessionId() {
        return `snow-flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Log Snow-Flow operation with comprehensive audit trail
     */
    async logOperation(operation, level = 'INFO', details = {}) {
        if (!this.isEnabled)
            return;
        const tokenUsage = this.mcpLogger.getTokenUsage();
        const timestamp = new Date().toISOString();
        const auditEntry = {
            source: 'snow-flow',
            level,
            message: details.message || `Snow-Flow ${operation}`,
            operation,
            table: details.table,
            sys_id: details.sys_id,
            token_usage: tokenUsage.total > 0 ? tokenUsage : undefined,
            duration_ms: details.duration_ms,
            metadata: {
                ...details.metadata,
                success: details.success,
                mcp_server: this.mcpServerName,
                session_id: this.sessionId
            },
            timestamp,
            session_id: this.sessionId,
            mcp_server: this.mcpServerName
        };
        // Log to console immediately via MCPLogger
        this.mcpLogger.info(`🔍 [AUDIT] ${operation}`, auditEntry);
        // Queue for ServiceNow transmission
        this.auditQueue.push(auditEntry);
        // Batch send to avoid overwhelming ServiceNow
        this.scheduleBatchSend();
    }
    /**
     * Log API call with token tracking
     */
    async logAPICall(apiMethod, table, operation, recordCount, duration_ms, success = true) {
        await this.logOperation('api_call', success ? 'INFO' : 'ERROR', {
            message: `API ${apiMethod} on ${table} (${recordCount || 0} records)`,
            table,
            duration_ms,
            metadata: {
                api_method: apiMethod,
                record_count: recordCount,
                operation
            },
            success
        });
    }
    /**
     * Log widget operations with specific tracking
     */
    async logWidgetOperation(operation, widgetSysId, widgetName, duration_ms, success = true, errorDetails) {
        await this.logOperation('widget_operation', success ? 'INFO' : 'ERROR', {
            message: `Widget ${operation}: ${widgetName || widgetSysId}`,
            table: 'sp_widget',
            sys_id: widgetSysId,
            duration_ms,
            metadata: {
                widget_name: widgetName,
                operation_type: operation,
                error_details: errorDetails
            },
            success
        });
    }
    /**
     * Log artifact sync operations
     */
    async logArtifactSync(action, table, sys_id, artifactName, fileCount, duration_ms, success = true) {
        await this.logOperation('artifact_sync', success ? 'INFO' : 'ERROR', {
            message: `Artifact ${action}: ${artifactName || sys_id} (${fileCount || 0} files)`,
            table,
            sys_id,
            duration_ms,
            metadata: {
                action,
                artifact_name: artifactName,
                file_count: fileCount
            },
            success
        });
    }
    /**
     * Log script execution with ES5 validation
     */
    async logScriptExecution(scriptType, duration_ms, success = true, errorDetails, outputLines) {
        await this.logOperation('script_execution', success ? 'INFO' : 'ERROR', {
            message: `Script execution: ${scriptType}`,
            duration_ms,
            metadata: {
                script_type: scriptType,
                output_lines: outputLines,
                error_details: errorDetails,
                es5_validated: true // Snow-Flow always uses ES5
            },
            success
        });
    }
    /**
     * Log authentication and token operations
     */
    async logAuthOperation(operation, success = true, details) {
        await this.logOperation('authentication', success ? 'INFO' : 'WARN', {
            message: `Auth ${operation}`,
            metadata: {
                operation,
                ...details
            },
            success
        });
    }
    /**
     * Schedule batch sending to ServiceNow to avoid API flooding
     */
    scheduleBatchSend() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }
        // Send batches every 10 seconds or when queue reaches 20 entries
        const shouldSendImmediately = this.auditQueue.length >= 20;
        const delay = shouldSendImmediately ? 0 : 10000;
        this.batchTimer = setTimeout(() => {
            this.sendAuditBatch();
        }, delay);
    }
    /**
     * Send audit log batch to ServiceNow
     */
    async sendAuditBatch() {
        if (this.auditQueue.length === 0 || !this.serviceNowClient) {
            return;
        }
        const batch = [...this.auditQueue];
        this.auditQueue = []; // Clear queue
        try {
            // Send to ServiceNow sys_log table with source 'snow-flow'
            for (const entry of batch) {
                await this.serviceNowClient.createRecord('sys_log', {
                    source: 'snow-flow',
                    level: entry.level,
                    message: entry.message,
                    sys_created_on: entry.timestamp,
                    // Custom fields for Snow-Flow specific data
                    u_operation: entry.operation,
                    u_table: entry.table,
                    u_sys_id: entry.sys_id,
                    u_session_id: entry.session_id,
                    u_mcp_server: entry.mcp_server,
                    u_token_usage: entry.token_usage ? JSON.stringify(entry.token_usage) : null,
                    u_duration_ms: entry.duration_ms,
                    u_metadata: entry.metadata ? JSON.stringify(entry.metadata) : null
                });
            }
            this.mcpLogger.info(`📨 Sent ${batch.length} audit log entries to ServiceNow`);
        }
        catch (error) {
            // If ServiceNow logging fails, log locally but don't fail the operation
            this.mcpLogger.warn('Failed to send audit logs to ServiceNow', {
                error: error instanceof Error ? error.message : String(error),
                batch_size: batch.length
            });
            // Re-queue failed entries (with max retry limit)
            const retriedEntries = batch.map(entry => ({
                ...entry,
                metadata: {
                    ...entry.metadata,
                    retry_count: (entry.metadata?.retry_count || 0) + 1
                }
            })).filter(entry => (entry.metadata?.retry_count || 0) < 3);
            this.auditQueue.unshift(...retriedEntries);
        }
    }
    /**
     * Flush all pending audit logs immediately
     */
    async flush() {
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = undefined;
        }
        await this.sendAuditBatch();
    }
    /**
     * Create audit logger wrapper for existing MCP server
     */
    static wrap(mcpLogger, mcpServerName) {
        return new ServiceNowAuditLogger(mcpLogger, mcpServerName);
    }
    /**
     * Get audit statistics
     */
    getAuditStats() {
        return {
            session_id: this.sessionId,
            pending_logs: this.auditQueue.length,
            is_enabled: this.isEnabled,
            has_servicenow_client: !!this.serviceNowClient
        };
    }
}
exports.ServiceNowAuditLogger = ServiceNowAuditLogger;
/**
 * Global audit logger factory for consistent usage across MCP servers
 */
const auditLoggers = new Map();
function getAuditLogger(mcpLogger, mcpServerName) {
    if (!auditLoggers.has(mcpServerName)) {
        auditLoggers.set(mcpServerName, new ServiceNowAuditLogger(mcpLogger, mcpServerName));
    }
    return auditLoggers.get(mcpServerName);
}
/**
 * Initialize all audit loggers with ServiceNow client
 */
function initializeAuditLogging(serviceNowClient) {
    auditLoggers.forEach(logger => {
        logger.setServiceNowClient(serviceNowClient);
    });
}
//# sourceMappingURL=servicenow-audit-logger.js.map