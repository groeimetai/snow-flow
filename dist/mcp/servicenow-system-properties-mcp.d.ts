/**
 * ServiceNow System Properties MCP Server
 *
 * Provides comprehensive system property management through official ServiceNow APIs
 * Uses the standard Table API on sys_properties table
 */
/**
 * ServiceNow System Properties MCP Server
 * Manages system properties through official ServiceNow REST APIs
 */
export declare class ServiceNowSystemPropertiesMCP {
    private server;
    private client;
    private oauth;
    private logger;
    private propertyCache;
    constructor();
    private setupHandlers;
    private setupTools;
    /**
     * Get a system property value
     */
    private getProperty;
    /**
     * Set or create a system property
     */
    private setProperty;
    /**
     * List system properties
     */
    private listProperties;
    /**
     * Delete a system property
     */
    private deleteProperty;
    /**
     * Search properties
     */
    private searchProperties;
    /**
     * Bulk get properties
     */
    private bulkGetProperties;
    /**
     * Bulk set properties
     */
    private bulkSetProperties;
    /**
     * Export properties
     */
    private exportProperties;
    /**
     * Import properties
     */
    private importProperties;
    /**
     * Validate property value
     */
    private validateProperty;
    /**
     * Get property categories
     */
    private getCategories;
    /**
     * Get property audit history
     */
    private getPropertyHistory;
    run(): Promise<void>;
}
//# sourceMappingURL=servicenow-system-properties-mcp.d.ts.map