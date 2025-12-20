/**
 * Enhanced Base MCP Server with Logging, Token Tracking, and ServiceNow Audit Logging
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServiceNowClientWithTracking } from '../../utils/servicenow-client-with-tracking.js';
import { MCPLogger } from './mcp-logger.js';
import { ServiceNowOAuth } from '../../utils/snow-oauth.js';
import { mcpAuth } from '../../utils/mcp-auth-middleware.js';
import { ServiceNowAuditLogger, getAuditLogger } from '../../utils/servicenow-audit-logger.js';

export interface MCPToolResult {
  content: Array<{
    type: string;
    text: string;
  }>;
  [key: string]: unknown; // Add index signature for MCP SDK compatibility
}

export abstract class EnhancedBaseMCPServer {
  protected server: Server;
  protected client: ServiceNowClientWithTracking;
  protected logger: MCPLogger;
  protected auditLogger: ServiceNowAuditLogger;
  protected oauth: ServiceNowOAuth;
  protected isAuthenticated: boolean = false;
  protected serverName: string;

  constructor(name: string, version: string = '1.0.0') {
    this.serverName = name;
    
    // Create enhanced logger
    this.logger = new MCPLogger(name);
    
    // Initialize ServiceNow audit logger
    this.auditLogger = getAuditLogger(this.logger, name);
    
    // Log startup
    this.logger.info(`🚀 Starting ${name} MCP Server v${version}`);
    
    // Create enhanced client with tracking
    this.client = new ServiceNowClientWithTracking(this.logger);
    
    // Connect audit logger to ServiceNow client
    this.auditLogger.setServiceNowClient(this.client.getBaseClient());
    
    // Initialize OAuth
    this.oauth = new ServiceNowOAuth();
    
    // Create server with capabilities
    this.server = new Server(
      {
        name,
        version,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Log server initialization
    this.auditLogger.logOperation('server_initialization', 'INFO', {
      message: `${name} MCP Server v${version} initialized`,
      metadata: { version, capabilities: ['tools'] }
    });
    
    // Report initialization
    this.logger.info(`✅ ${name} initialized and ready with audit logging`);
  }

  /**
   * Execute tool with enhanced tracking and audit logging
   */
  protected async executeTool(toolName: string, handler: () => Promise<MCPToolResult>, params?: any): Promise<MCPToolResult> {
    const startTime = Date.now();
    
    // Reset tokens at start of each operation to avoid accumulation
    this.logger.resetTokens();
    
    // Start operation tracking
    this.logger.operationStart(toolName);
    
    try {
      // Ensure authentication
      await mcpAuth.ensureAuthenticated();
      this.isAuthenticated = true;
      
      // Log authentication success
      await this.auditLogger.logAuthOperation('token_refresh', true);
      
      // Execute the tool handler
      const result = await handler();
      
      const duration = Date.now() - startTime;
      const tokenUsage = this.logger.getTokenUsage();
      
      // Log successful tool execution
      await this.auditLogger.logOperation('tool_execution', 'INFO', {
        message: `Successfully executed ${toolName}`,
        duration_ms: duration,
        metadata: {
          tool_name: toolName,
          parameters: params ? JSON.stringify(params) : undefined,
          token_usage: tokenUsage
        },
        success: true
      });
      
      // Log completion
      this.logger.operationComplete(toolName);
      
      // Send token usage summary if in Claude
      if (process.send) {
        process.send({
          type: 'token_usage',
          data: {
            tool: toolName,
            tokens: tokenUsage
          }
        });
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Log failed tool execution
      await this.auditLogger.logOperation('tool_execution', 'ERROR', {
        message: `Failed to execute ${toolName}: ${errorMessage}`,
        duration_ms: duration,
        metadata: {
          tool_name: toolName,
          parameters: params ? JSON.stringify(params) : undefined,
          error_details: error instanceof Error ? { message: error.message, stack: error.stack } : error
        },
        success: false
      });
      
      this.logger.error(`Tool execution failed: ${toolName}`, error);
      
      // Return error as tool result
      return {
        content: [{
          type: 'text',
          text: `❌ Error executing ${toolName}: ${errorMessage}`
        }]
      };
    }
  }

  /**
   * Validate ServiceNow connection with progress
   */
  protected async validateConnection(): Promise<{ success: boolean; error?: string }> {
    this.logger.progress('Validating ServiceNow connection...');
    
    try {
      // Check credentials
      const credentials = await this.oauth.loadCredentials();
      if (!credentials) {
        return {
          success: false,
          error: 'No ServiceNow credentials found. Run "snow-flow auth login"'
        };
      }
      
      // Check token
      if (!credentials.accessToken) {
        return {
          success: false,
          error: 'OAuth authentication required. Run "snow-flow auth login"'
        };
      }
      
      // Test connection
      this.logger.progress('Testing ServiceNow API connection...');
      const connectionTest = await this.client.testConnection();
      
      if (!connectionTest.success) {
        return {
          success: false,
          error: `ServiceNow connection failed: ${connectionTest.error}`
        };
      }
      
      this.logger.info('✅ ServiceNow connection validated');
      return { success: true };
      
    } catch (error) {
      this.logger.error('Connection validation failed', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Create standardized response with tracking
   */
  protected createResponse(message: string, data?: any): MCPToolResult {
    // Log the response
    this.logger.debug('Tool response', { message, hasData: !!data });
    
    // Format response
    const response: MCPToolResult = {
      content: [{
        type: 'text',
        text: message
      }]
    };
    
    // Add data if provided
    if (data) {
      response.content[0].text += '\n\n' + JSON.stringify(data, null, 2);
    }
    
    return response;
  }

  /**
   * Query table with progress tracking and audit logging
   */
  protected async queryTable(table: string, query: string, limit: number = 10): Promise<any> {
    const startTime = Date.now();
    this.logger.progress(`Querying ${table} table (limit: ${limit})...`);
    
    try {
      const result = await this.client.searchRecords(table, query, limit);
      
      const recordCount = result?.data?.result?.length || 0;
      const duration = Date.now() - startTime;
      
      // Log API call
      await this.auditLogger.logAPICall('searchRecords', table, 'query', recordCount, duration, true);
      
      this.logger.info(`Query completed: ${recordCount} records found`);
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logAPICall('searchRecords', table, 'query', 0, duration, false);
      throw error;
    }
  }

  /**
   * Create record with tracking and audit logging
   */
  protected async createRecord(table: string, data: any): Promise<any> {
    const startTime = Date.now();
    this.logger.progress(`Creating ${table} record...`);
    
    try {
      const result = await this.client.createRecord(table, data);
      const duration = Date.now() - startTime;
      const success = !!result?.success;
      const sysId = result?.data?.result?.sys_id;
      
      // Log API call with audit
      await this.auditLogger.logAPICall('createRecord', table, 'create', 1, duration, success);
      
      if (success) {
        this.logger.info(`✅ Created ${table} record: ${sysId}`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logAPICall('createRecord', table, 'create', 0, duration, false);
      throw error;
    }
  }

  /**
   * Update record with tracking and audit logging
   */
  protected async updateRecord(table: string, sysId: string, data: any): Promise<any> {
    const startTime = Date.now();
    this.logger.progress(`Updating ${table} record ${sysId}...`);
    
    try {
      const result = await this.client.updateRecord(table, sysId, data);
      const duration = Date.now() - startTime;
      const success = !!result?.success;
      
      // Log API call with audit
      await this.auditLogger.logAPICall('updateRecord', table, 'update', 1, duration, success);
      
      if (success) {
        this.logger.info(`✅ Updated ${table} record: ${sysId}`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logAPICall('updateRecord', table, 'update', 0, duration, false);
      throw error;
    }
  }

  /**
   * Get record with tracking and audit logging
   */
  protected async getRecord(table: string, sysId: string): Promise<any> {
    const startTime = Date.now();
    this.logger.progress(`Getting ${table} record ${sysId}...`);
    
    try {
      const result = await this.client.getRecord(table, sysId);
      const duration = Date.now() - startTime;
      const success = !!result?.success;
      
      // Log API call with audit
      await this.auditLogger.logAPICall('getRecord', table, 'read', success ? 1 : 0, duration, success);
      
      if (success) {
        this.logger.info(`✅ Retrieved ${table} record: ${sysId}`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      await this.auditLogger.logAPICall('getRecord', table, 'read', 0, duration, false);
      throw error;
    }
  }

  /**
   * Get client for direct use
   */
  public getClient(): ServiceNowClientWithTracking {
    return this.client;
  }

  /**
   * Get logger for direct use
   */
  public getLogger(): MCPLogger {
    return this.logger;
  }

  /**
   * Get audit logger for direct use
   */
  public getAuditLogger(): ServiceNowAuditLogger {
    return this.auditLogger;
  }

  /**
   * Cleanup resources and flush audit logs
   */
  public async cleanup(): Promise<void> {
    this.logger.info(`🧹 Cleaning up ${this.serverName} MCP Server`);
    
    try {
      // Flush pending audit logs
      await this.auditLogger.flush();
      
      // Log server shutdown
      await this.auditLogger.logOperation('server_shutdown', 'INFO', {
        message: `${this.serverName} MCP Server shutting down`,
        metadata: { 
          uptime_ms: Date.now() - this.logger['startTime'],
          final_token_usage: this.logger.getTokenUsage()
        }
      });
      
      // Stop progress indicators
      this.logger.stopProgress();
      
      this.logger.info(`✅ ${this.serverName} cleanup completed`);
    } catch (error) {
      this.logger.error('Error during cleanup', error);
    }
  }
}