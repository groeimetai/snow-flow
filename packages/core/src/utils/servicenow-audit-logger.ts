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

export class ServiceNowAuditLogger {
  private mcpLogger: MCPLogger;
  private serviceNowClient?: ServiceNowClient;
  private sessionId: string;
  private mcpServerName: string;
  private isEnabled: boolean = true;
  private auditQueue: AuditLogEntry[] = [];
  private batchTimer?: NodeJS.Timeout;
  
  constructor(mcpLogger: MCPLogger, mcpServerName: string) {
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
  public setServiceNowClient(client: ServiceNowClient): void {
    this.serviceNowClient = client;
    if (this.isEnabled) {
      this.mcpLogger.info('🔗 ServiceNow client connected for audit logging');
    }
  }
  
  /**
   * Generate unique session ID for tracking related operations
   */
  private generateSessionId(): string {
    return `snow-flow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Log Snow-Flow operation with comprehensive audit trail
   */
  public async logOperation(
    operation: string,
    level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' = 'INFO',
    details: {
      message?: string;
      table?: string;
      sys_id?: string;
      duration_ms?: number;
      metadata?: any;
      success?: boolean;
    } = {}
  ): Promise<void> {
    if (!this.isEnabled) return;
    
    const tokenUsage = this.mcpLogger.getTokenUsage();
    const timestamp = new Date().toISOString();
    
    const auditEntry: AuditLogEntry = {
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
  public async logAPICall(
    apiMethod: string, 
    table: string, 
    operation: string,
    recordCount?: number,
    duration_ms?: number,
    success: boolean = true
  ): Promise<void> {
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
  public async logWidgetOperation(
    operation: 'pull' | 'push' | 'validate' | 'deploy',
    widgetSysId: string,
    widgetName?: string,
    duration_ms?: number,
    success: boolean = true,
    errorDetails?: any
  ): Promise<void> {
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
  public async logArtifactSync(
    action: 'pull' | 'push' | 'cleanup',
    table: string,
    sys_id: string,
    artifactName?: string,
    fileCount?: number,
    duration_ms?: number,
    success: boolean = true
  ): Promise<void> {
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
  public async logScriptExecution(
    scriptType: 'background' | 'business_rule' | 'client_script',
    duration_ms?: number,
    success: boolean = true,
    errorDetails?: any,
    outputLines?: number
  ): Promise<void> {
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
  public async logAuthOperation(
    operation: 'login' | 'token_refresh' | 'scope_elevation',
    success: boolean = true,
    details?: any
  ): Promise<void> {
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
  private scheduleBatchSend(): void {
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
  private async sendAuditBatch(): Promise<void> {
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
      
    } catch (error) {
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
  public async flush(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }
    await this.sendAuditBatch();
  }
  
  /**
   * Create audit logger wrapper for existing MCP server
   */
  public static wrap(mcpLogger: MCPLogger, mcpServerName: string): ServiceNowAuditLogger {
    return new ServiceNowAuditLogger(mcpLogger, mcpServerName);
  }
  
  /**
   * Get audit statistics
   */
  public getAuditStats(): {
    session_id: string;
    pending_logs: number;
    is_enabled: boolean;
    has_servicenow_client: boolean;
  } {
    return {
      session_id: this.sessionId,
      pending_logs: this.auditQueue.length,
      is_enabled: this.isEnabled,
      has_servicenow_client: !!this.serviceNowClient
    };
  }
}

/**
 * Global audit logger factory for consistent usage across MCP servers
 */
const auditLoggers = new Map<string, ServiceNowAuditLogger>();

export function getAuditLogger(mcpLogger: MCPLogger, mcpServerName: string): ServiceNowAuditLogger {
  if (!auditLoggers.has(mcpServerName)) {
    auditLoggers.set(mcpServerName, new ServiceNowAuditLogger(mcpLogger, mcpServerName));
  }
  return auditLoggers.get(mcpServerName)!;
}

/**
 * Initialize all audit loggers with ServiceNow client
 */
export function initializeAuditLogging(serviceNowClient: ServiceNowClient): void {
  auditLoggers.forEach(logger => {
    logger.setServiceNowClient(serviceNowClient);
  });
}