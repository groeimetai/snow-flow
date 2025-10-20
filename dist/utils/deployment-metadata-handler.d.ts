#!/usr/bin/env node
/**
 * Deployment Metadata Handler
 *
 * Solves Issue #3: Metadata Response Failures
 * Ensures all deployments return proper sys_id and API endpoints
 */
export interface DeploymentMetadata {
    sys_id: string;
    name: string;
    type: string;
    table: string;
    api_endpoint: string;
    ui_url: string;
    created_on?: string;
    created_by?: string;
    update_set_id?: string;
    verification_status?: 'verified' | 'unverified' | 'failed';
}
export interface DeploymentResult {
    success: boolean;
    metadata?: DeploymentMetadata;
    error?: string;
    verification?: {
        exists: boolean;
        accessible: boolean;
        functional: boolean;
    };
}
export declare class DeploymentMetadataHandler {
    private client;
    private oauth;
    private logger;
    private metadataCache;
    constructor();
    /**
     * Extract metadata from deployment response
     */
    extractMetadata(deploymentType: string, deploymentResponse: any, additionalInfo?: any): Promise<DeploymentResult>;
    /**
     * Extract flow metadata
     */
    private extractFlowMetadata;
    /**
     * Extract widget metadata
     */
    private extractWidgetMetadata;
    /**
     * Extract script include metadata
     */
    private extractScriptMetadata;
    /**
     * Extract business rule metadata
     */
    private extractBusinessRuleMetadata;
    /**
     * Extract generic metadata
     */
    private extractGenericMetadata;
    /**
     * Find flow from update set
     */
    private findFlowFromUpdateSet;
    /**
     * Find flow by name
     */
    private findFlowByName;
    /**
     * Find widget by name
     */
    private findWidgetByName;
    /**
     * Find script include by name
     */
    private findScriptIncludeByName;
    /**
     * Find business rule by name
     */
    private findBusinessRuleByName;
    /**
     * Get flow details
     */
    private getFlowDetails;
    /**
     * Verify deployment exists and is accessible
     */
    private verifyDeployment;
    /**
     * Get table name for deployment type
     */
    private getTableForType;
    /**
     * Get cached metadata
     */
    getCachedMetadata(sysId: string): DeploymentMetadata | null;
    /**
     * Clear metadata cache
     */
    clearCache(): void;
}
/**
 * Get or create handler instance
 */
export declare function getMetadataHandler(): DeploymentMetadataHandler;
/**
 * Helper to ensure deployment returns metadata
 */
export declare function ensureDeploymentMetadata(deploymentType: string, deploymentResponse: any, additionalInfo?: any): Promise<DeploymentResult>;
export default DeploymentMetadataHandler;
//# sourceMappingURL=deployment-metadata-handler.d.ts.map