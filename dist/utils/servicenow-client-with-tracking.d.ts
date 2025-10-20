/**
 * ServiceNow Client Wrapper with Token & Progress Tracking
 */
import { ServiceNowClient } from './servicenow-client.js';
import { MCPLogger } from '../mcp/shared/mcp-logger.js';
export declare class ServiceNowClientWithTracking extends ServiceNowClient {
    private mcpLogger;
    constructor(logger?: MCPLogger);
    /**
     * Get the base ServiceNow client for audit logger integration
     */
    getBaseClient(): ServiceNowClient;
    /**
     * Override makeRequest to add tracking
     */
    makeRequest(config: any): Promise<any>;
    /**
     * Override searchRecordsWithFields to add tracking
     */
    searchRecordsWithFields(table: string, query: string, fields: string[], limit?: number): Promise<any>;
    /**
     * Override searchRecords to add tracking
     */
    searchRecords(table: string, query: string, limit?: number): Promise<any>;
    /**
     * Override createRecord to add tracking
     */
    createRecord(table: string, data: any): Promise<any>;
    /**
     * Override updateRecord to add tracking
     */
    updateRecord(table: string, sysId: string, data: any): Promise<any>;
    /**
     * Override getRecord to add tracking
     */
    getRecord(table: string, sysId: string, fields?: string[]): Promise<any>;
    /**
     * Extract table name from URL
     */
    private extractTableFromUrl;
    /**
     * Get logger for external use
     */
    getLogger(): MCPLogger;
}
//# sourceMappingURL=servicenow-client-with-tracking.d.ts.map