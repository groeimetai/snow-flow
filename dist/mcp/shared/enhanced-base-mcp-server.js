"use strict";
/**
 * Enhanced Base MCP Server with Logging, Token Tracking, and ServiceNow Audit Logging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedBaseMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const servicenow_client_with_tracking_js_1 = require("../../utils/servicenow-client-with-tracking.js");
const mcp_logger_js_1 = require("./mcp-logger.js");
const snow_oauth_js_1 = require("../../utils/snow-oauth.js");
const mcp_auth_middleware_js_1 = require("../../utils/mcp-auth-middleware.js");
const servicenow_audit_logger_js_1 = require("../../utils/servicenow-audit-logger.js");
class EnhancedBaseMCPServer {
    constructor(name, version = '1.0.0') {
        this.isAuthenticated = false;
        this.serverName = name;
        // Create enhanced logger
        this.logger = new mcp_logger_js_1.MCPLogger(name);
        // Initialize ServiceNow audit logger
        this.auditLogger = (0, servicenow_audit_logger_js_1.getAuditLogger)(this.logger, name);
        // Log startup
        this.logger.info(`🚀 Starting ${name} MCP Server v${version}`);
        // Create enhanced client with tracking
        this.client = new servicenow_client_with_tracking_js_1.ServiceNowClientWithTracking(this.logger);
        // Connect audit logger to ServiceNow client
        this.auditLogger.setServiceNowClient(this.client.getBaseClient());
        // Initialize OAuth
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        // Create server with capabilities
        this.server = new index_js_1.Server({
            name,
            version,
        }, {
            capabilities: {
                tools: {},
            },
        });
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
    async executeTool(toolName, handler, params) {
        const startTime = Date.now();
        // Reset tokens at start of each operation to avoid accumulation
        this.logger.resetTokens();
        // Start operation tracking
        this.logger.operationStart(toolName);
        try {
            // Ensure authentication
            await mcp_auth_middleware_js_1.mcpAuth.ensureAuthenticated();
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
        }
        catch (error) {
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
    async validateConnection() {
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
        }
        catch (error) {
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
    createResponse(message, data) {
        // Log the response
        this.logger.debug('Tool response', { message, hasData: !!data });
        // Format response
        const response = {
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
    async queryTable(table, query, limit = 10) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            await this.auditLogger.logAPICall('searchRecords', table, 'query', 0, duration, false);
            throw error;
        }
    }
    /**
     * Create record with tracking and audit logging
     */
    async createRecord(table, data) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            await this.auditLogger.logAPICall('createRecord', table, 'create', 0, duration, false);
            throw error;
        }
    }
    /**
     * Update record with tracking and audit logging
     */
    async updateRecord(table, sysId, data) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            await this.auditLogger.logAPICall('updateRecord', table, 'update', 0, duration, false);
            throw error;
        }
    }
    /**
     * Get record with tracking and audit logging
     */
    async getRecord(table, sysId) {
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
        }
        catch (error) {
            const duration = Date.now() - startTime;
            await this.auditLogger.logAPICall('getRecord', table, 'read', 0, duration, false);
            throw error;
        }
    }
    /**
     * Get client for direct use
     */
    getClient() {
        return this.client;
    }
    /**
     * Get logger for direct use
     */
    getLogger() {
        return this.logger;
    }
    /**
     * Get audit logger for direct use
     */
    getAuditLogger() {
        return this.auditLogger;
    }
    /**
     * Cleanup resources and flush audit logs
     */
    async cleanup() {
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
        }
        catch (error) {
            this.logger.error('Error during cleanup', error);
        }
    }
}
exports.EnhancedBaseMCPServer = EnhancedBaseMCPServer;
//# sourceMappingURL=enhanced-base-mcp-server.js.map