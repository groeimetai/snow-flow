"use strict";
/**
 * ServiceNow Client Wrapper with Token & Progress Tracking
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceNowClientWithTracking = void 0;
const servicenow_client_js_1 = require("./servicenow-client.js");
const mcp_logger_js_1 = require("../mcp/shared/mcp-logger.js");
class ServiceNowClientWithTracking extends servicenow_client_js_1.ServiceNowClient {
    constructor(logger) {
        super();
        this.mcpLogger = logger || new mcp_logger_js_1.MCPLogger('ServiceNow-API');
    }
    /**
     * Get the base ServiceNow client for audit logger integration
     */
    getBaseClient() {
        return this;
    }
    /**
     * Override makeRequest to add tracking
     */
    async makeRequest(config) {
        const operation = `${config.method || 'GET'} ${config.url || config.endpoint}`;
        const table = this.extractTableFromUrl(config.url || config.endpoint);
        // Log API call start
        this.mcpLogger.trackAPICall(operation, table);
        this.mcpLogger.progress(`Calling ServiceNow API: ${operation}`);
        try {
            // Call parent method
            const result = await super.makeRequest(config);
            // Estimate tokens based on response size
            if (result.data) {
                const responseSize = JSON.stringify(result.data).length;
                const estimatedTokens = Math.ceil(responseSize / 4); // Rough estimate: 4 chars per token
                this.mcpLogger.addTokens(50, estimatedTokens); // 50 for request, response based on size
            }
            return result;
        }
        catch (error) {
            this.mcpLogger.error(`API call failed: ${operation}`, error);
            throw error;
        }
    }
    /**
     * Override searchRecordsWithFields to add tracking
     */
    async searchRecordsWithFields(table, query, fields, limit = 10) {
        this.mcpLogger.progress(`Searching ${table} with specific fields: ${fields.join(', ')}`);
        try {
            const result = await super.searchRecordsWithFields(table, query, fields, limit);
            // Estimate tokens based on fields requested
            const fieldCount = fields.length;
            const estimatedTokens = Math.min(fieldCount * 100, 1000); // Rough estimate
            this.mcpLogger.addTokens(estimatedTokens, 0);
            if (result?.data?.result?.length > 0) {
                this.mcpLogger.info(`Found ${result.data.result.length} records with ${fieldCount} fields`);
            }
            return result;
        }
        catch (error) {
            this.mcpLogger.error('Search with fields failed', error);
            throw error;
        }
    }
    /**
     * Override searchRecords to add tracking
     */
    async searchRecords(table, query, limit = 10) {
        this.mcpLogger.operationStart(`Search ${table}`, { query, limit });
        try {
            const result = await super.searchRecords(table, query, limit);
            // Track record count
            const recordCount = result?.data?.result?.length || 0;
            this.mcpLogger.info(`Found ${recordCount} ${table} records`);
            // Estimate tokens
            if (result?.data?.result) {
                const dataSize = JSON.stringify(result.data.result).length;
                const estimatedTokens = Math.ceil(dataSize / 4);
                this.mcpLogger.addTokens(100, estimatedTokens);
            }
            this.mcpLogger.operationComplete(`Search ${table}`, { count: recordCount });
            return result;
        }
        catch (error) {
            this.mcpLogger.error(`Search failed for ${table}`, error);
            throw error;
        }
    }
    /**
     * Override createRecord to add tracking
     */
    async createRecord(table, data) {
        this.mcpLogger.operationStart(`Create ${table} record`, { fields: Object.keys(data).length });
        try {
            const result = await super.createRecord(table, data);
            // Estimate tokens
            const requestSize = JSON.stringify(data).length;
            const responseSize = JSON.stringify(result).length;
            this.mcpLogger.addTokens(Math.ceil(requestSize / 4), Math.ceil(responseSize / 4));
            this.mcpLogger.operationComplete(`Create ${table} record`, {
                sys_id: result?.data?.result?.sys_id
            });
            return result;
        }
        catch (error) {
            this.mcpLogger.error(`Failed to create ${table} record`, error);
            throw error;
        }
    }
    /**
     * Override updateRecord to add tracking
     */
    async updateRecord(table, sysId, data) {
        this.mcpLogger.operationStart(`Update ${table} record`, { sys_id: sysId });
        try {
            const result = await super.updateRecord(table, sysId, data);
            // Estimate tokens
            const requestSize = JSON.stringify(data).length;
            const responseSize = JSON.stringify(result).length;
            this.mcpLogger.addTokens(Math.ceil(requestSize / 4), Math.ceil(responseSize / 4));
            this.mcpLogger.operationComplete(`Update ${table} record`);
            return result;
        }
        catch (error) {
            this.mcpLogger.error(`Failed to update ${table} record`, error);
            throw error;
        }
    }
    /**
     * Override getRecord to add tracking
     */
    async getRecord(table, sysId, fields) {
        this.mcpLogger.progress(`Fetching ${table} record: ${sysId}`);
        try {
            const result = await super.getRecord(table, sysId);
            // Estimate tokens
            if (result?.data?.result) {
                const responseSize = JSON.stringify(result.data.result).length;
                this.mcpLogger.addTokens(50, Math.ceil(responseSize / 4));
            }
            return result;
        }
        catch (error) {
            this.mcpLogger.error(`Failed to get ${table} record`, error);
            throw error;
        }
    }
    /**
     * Extract table name from URL
     */
    extractTableFromUrl(url) {
        const match = url.match(/\/table\/([^/?]+)/);
        return match ? match[1] : undefined;
    }
    /**
     * Get logger for external use
     */
    getLogger() {
        return this.mcpLogger;
    }
}
exports.ServiceNowClientWithTracking = ServiceNowClientWithTracking;
//# sourceMappingURL=servicenow-client-with-tracking.js.map