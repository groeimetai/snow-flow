#!/usr/bin/env node
/**
 * ServiceNow API Client
 * Handles all ServiceNow API operations with OAuth authentication
 */
import { ServiceNowCredentials } from './snow-oauth';
export interface ServiceNowWidget {
    sys_id?: string;
    name: string;
    id: string;
    title: string;
    description: string;
    template: string;
    css: string;
    client_script: string;
    script: string;
    option_schema?: string;
    demo_data?: string;
    has_preview?: boolean;
    category: string;
}
export interface ServiceNowWorkflow {
    sys_id?: string;
    name: string;
    description: string;
    active: boolean;
    workflow_version: string;
    table?: string;
    condition?: string;
}
export interface ServiceNowApplication {
    sys_id?: string;
    name: string;
    scope: string;
    version: string;
    short_description: string;
    description: string;
    vendor: string;
    vendor_prefix: string;
    template?: string;
    logo?: string;
    active: boolean;
}
export interface ServiceNowAPIResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    result?: T[];
    details?: any;
}
export declare class ServiceNowClient {
    private client;
    private oauth;
    private credentials;
    private actionTypeCache;
    private logger;
    private deploymentTimeout;
    constructor();
    /**
     * Public getter for credentials
     */
    get credentialsInstance(): ServiceNowCredentials | null;
    private tokenRefreshPromise;
    private lastTokenRefresh;
    /**
     * 🔴 SNOW-003 FIX: Handle token refresh with locking to prevent concurrent refreshes
     * This prevents cascade failures caused by multiple simultaneous token refresh attempts
     */
    private handleTokenRefreshWithLock;
    /**
     * 🔴 SNOW-003 FIX: Token refresh with timeout to prevent hanging requests
     */
    private performTokenRefreshWithTimeout;
    /**
     * Ensure we have valid authentication with improved error handling
     */
    private ensureAuthenticated;
    /**
     * Proactively refresh token if it's about to expire
     * Useful for long-running operations
     */
    refreshTokenIfNeeded(): Promise<boolean>;
    /**
     * Get base URL for ServiceNow instance
     */
    private getBaseUrl;
    /**
     * Sanitize a flow name for use as internal_name
     */
    private sanitizeInternalName;
    /**
     * Validate deployment permissions and diagnose authentication issues
     */
    validateDeploymentPermissions(): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Extract HTTP status from error message
     */
    private extractHttpStatus;
    /**
     * Generate authentication recommendations based on test results
     */
    private generateAuthRecommendations;
    /**
     * Test connection to ServiceNow
     */
    testConnection(): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a new ServiceNow widget
     */
    createWidget(widget: ServiceNowWidget): Promise<ServiceNowAPIResponse<ServiceNowWidget>>;
    /**
     * Update an existing ServiceNow widget
     */
    updateWidget(sysId: string, widget: Partial<ServiceNowWidget>): Promise<ServiceNowAPIResponse<ServiceNowWidget>>;
    /**
     * Get widget by ID
     */
    getWidget(widgetId: string): Promise<ServiceNowAPIResponse<ServiceNowWidget>>;
    /**
     * Create a new ServiceNow workflow
     */
    createWorkflow(workflow: ServiceNowWorkflow): Promise<ServiceNowAPIResponse<ServiceNowWorkflow>>;
    /**
     * Create a new ServiceNow application
     */
    createApplication(application: ServiceNowApplication): Promise<ServiceNowAPIResponse<ServiceNowApplication>>;
    /**
     * Execute a ServiceNow script
     */
    executeScript(script: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Get all widgets
     */
    getWidgets(): Promise<ServiceNowAPIResponse<ServiceNowWidget[]>>;
    /**
     * Get all workflows
     */
    getWorkflows(): Promise<ServiceNowAPIResponse<ServiceNowWorkflow[]>>;
    /**
     * Get all applications
     */
    getApplications(): Promise<ServiceNowAPIResponse<ServiceNowApplication[]>>;
    /**
     * Get default flow structure from ServiceNow
     */
    private getFlowDefaults;
    /**
     * Get instance info
     */
    getInstanceInfo(): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Get a specific record by sys_id
     */
    getRecord(table: string, sys_id: string): Promise<any>;
    /**
     * Get multiple records from a table
     */
    getRecords(table: string, params?: any): Promise<ServiceNowAPIResponse<any[]>>;
    /**
     * Search records with specific fields
     */
    searchRecordsWithFields(table: string, query: string, fields: string[], limit?: number): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Search records in a table using encoded query
     */
    searchRecords(table: string, query: string, limit?: number): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Search records with offset for pagination/streaming
     */
    searchRecordsWithOffset(table: string, query: string, limit?: number, offset?: number): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a record in any ServiceNow table
     */
    createRecord(table: string, data: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Update a record in any ServiceNow table
     */
    updateRecord(table: string, sysId: string, data: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Delete a record from any ServiceNow table
     */
    deleteRecord(table: string, sysId: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Search for available flow actions in ServiceNow
     */
    searchFlowActions(searchTerm: string): Promise<any>;
    /**
     * Get flow action details
     */
    getFlowActionDetails(actionTypeId: string): Promise<any>;
    /**
     * Validate flow definition before deployment
     */
    private validateFlowBeforeDeployment;
    /**
     * Verify deployment was successful and artifact has content
     */
    private verifyDeployment;
    /**
     * Check if a flow has actual content (not empty)
     */
    checkFlowContent(sysId: string): Promise<{
        hasContent: boolean;
        details: any;
    }>;
    /**
     * Create a ServiceNow flow using the enhanced flow structure builder
     * Generates proper sys_ids, logic chains, and all required records
     */
    createFlowWithStructureBuilder(flowDefinition: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a simple Flow Designer flow (original method)
     * Focusing on basic flow creation with simple actions
     */
    createFlow(flow: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Activate a flow to ensure it's published and ready
     */
    activateFlow(flowSysId: string): Promise<void>;
    /**
     * Generate flow snapshot to prevent "Your flow cannot be found" error
     * This uses the Flow Designer API to generate a proper snapshot
     */
    generateFlowSnapshot(flowSysId: string): Promise<void>;
    /**
     * Create a Subflow in ServiceNow
     */
    createSubflow(subflow: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a Flow Action (reusable component)
     */
    createFlowAction(action: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a flow action using discovered ServiceNow action types (private method)
     */
    private createFlowActionPrivate;
    /**
     * Build action inputs based on action details
     */
    private buildActionInputs;
    /**
     * Build simple action configuration
     */
    private buildActionConfiguration;
    /**
     * Create a flow trigger instance
     */
    private createFlowTrigger;
    /**
     * Create flow variables for inputs and outputs
     */
    private createFlowVariables;
    /**
     * Create a flow action instance using simplified approach
     */
    private createFlowActionInstance;
    /**
     * Create a flow operation (activity) for a Flow Designer flow
     */
    private createFlowOperation;
    /**
     * Create a Script Include
     */
    createScriptInclude(scriptInclude: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a Business Rule
     */
    createBusinessRule(businessRule: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a Table
     */
    createTable(table: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a Table Field
     */
    createTableField(field: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a new Update Set
     */
    createUpdateSet(updateSet: any): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Set current Update Set for the session
     */
    setCurrentUpdateSet(updateSetId: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Get current Update Set
     */
    getCurrentUpdateSet(): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Get Update Set by ID
     */
    getUpdateSet(updateSetId: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * List Update Sets
     */
    listUpdateSets(options: any): Promise<ServiceNowAPIResponse<any[]>>;
    /**
     * Complete an Update Set
     */
    completeUpdateSet(updateSetId: string, notes?: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Activate an Update Set by setting it as current
     */
    activateUpdateSet(updateSetId: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Preview Update Set changes
     */
    previewUpdateSet(updateSetId: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Export Update Set as XML
     */
    /**
     * Ensure we have an active Update Set for tracking changes
     */
    ensureUpdateSet(): Promise<ServiceNowAPIResponse<any>>;
    exportUpdateSet(updateSetId: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Debug flow structure - check what's missing for Flow Designer
     */
    debugFlow(flowId: string): Promise<ServiceNowAPIResponse<any>>;
    /**
     * Create a flow logic entry (visual representation in Flow Designer)
     */
    private createFlowLogic;
    /**
     * Create a connection between flow logic elements
     */
    private createFlowConnection;
    /**
     * Generic GET method for ServiceNow API calls
     */
    get(endpoint: string, params?: any): Promise<any>;
    /**
     * Generic POST method for ServiceNow API calls
     */
    post(endpoint: string, data?: any): Promise<any>;
    /**
     * Generic PUT method for ServiceNow API calls
     */
    put(endpoint: string, data?: any): Promise<any>;
    /**
     * Generic PATCH method for ServiceNow API calls
     */
    patch(endpoint: string, data?: any): Promise<any>;
    /**
     * Generic DELETE method for ServiceNow API calls
     */
    delete(endpoint: string): Promise<any>;
    /**
     * TEMPORARY FIX: makeRequest method to handle phantom calls
     * This method provides compatibility for code that expects makeRequest
     */
    makeRequest(config: any): Promise<any>;
}
//# sourceMappingURL=servicenow-client.d.ts.map