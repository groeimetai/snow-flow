/**
 * Widget Deployment Service
 * Direct ServiceNow API implementation for widget deployment
 * No more MCP failures!
 */
export interface WidgetConfig {
    name: string;
    title: string;
    template: string;
    css?: string;
    script?: string;
    client_script?: string;
    demo_data?: string;
    option_schema?: string;
    category?: string;
    description?: string;
}
export interface DeploymentResult {
    success: boolean;
    sys_id?: string;
    portalUrl?: string;
    apiEndpoint?: string;
    message: string;
    error?: string;
    verificationStatus?: 'verified' | 'unverified' | 'failed';
}
export declare class WidgetDeploymentService {
    private static instance;
    private logger;
    private client;
    private constructor();
    static getInstance(): WidgetDeploymentService;
    /**
     * Initialize ServiceNow client
     */
    private getClient;
    /**
     * Deploy widget to ServiceNow using direct API
     */
    deployWidget(config: WidgetConfig): Promise<DeploymentResult>;
    /**
     * Prepare widget data for ServiceNow API
     */
    private prepareWidgetData;
    /**
     * Find existing widget by name
     */
    private findExistingWidget;
    /**
     * Create new widget
     */
    private createWidget;
    /**
     * Update existing widget
     */
    private updateWidget;
    /**
     * Verify widget deployment with retry logic for eventual consistency
     * ServiceNow has database replication lag of 1-3 seconds
     */
    private verifyDeployment;
    /**
     * Get widget details
     */
    private getWidgetDetails;
    /**
     * Build portal URL for widget
     */
    private buildPortalUrl;
    /**
     * Build API endpoint for widget
     */
    private buildApiEndpoint;
    /**
     * Deploy widget with Update Set tracking
     */
    deployWidgetWithUpdateSet(config: WidgetConfig, updateSetId?: string): Promise<DeploymentResult>;
    /**
     * Switch to update set
     */
    private switchToUpdateSet;
    /**
     * Log artifact to update set
     */
    private logToUpdateSet;
    /**
     * Batch deploy multiple widgets
     */
    batchDeployWidgets(widgets: WidgetConfig[]): Promise<DeploymentResult[]>;
    /**
     * Test widget deployment
     */
    testDeployment(config: WidgetConfig): Promise<{
        canConnect: boolean;
        hasPermissions: boolean;
        testResult: string;
    }>;
    /**
     * Test ServiceNow connection
     */
    private testConnection;
    /**
     * Test write permissions
     */
    private testPermissions;
}
export declare const widgetDeployment: WidgetDeploymentService;
//# sourceMappingURL=widget-deployment-service.d.ts.map