/**
 * Auto-Resolution Engine - Automatically fixes ServiceNow configuration gaps
 *
 * This engine attempts to automatically resolve ServiceNow configuration requirements
 * that fall outside the scope of standard MCP tools, including:
 * - System properties and configurations
 * - Database indexes and views
 * - Navigation and menu items
 * - Advanced authentication settings
 * - Performance and monitoring configurations
 */
import { ServiceNowRequirement, RequirementType } from './requirements-analyzer';
export interface ResolutionResult {
    requirement: ServiceNowRequirement;
    status: 'success' | 'partial' | 'failed' | 'manual_required';
    automationUsed?: string;
    manualSteps?: string[];
    errorMessage?: string;
    sysId?: string;
    timeElapsed?: number;
    fallbackStrategy?: string;
}
export interface ResolutionStrategy {
    requirementType: RequirementType;
    automationMethod: string;
    apiEndpoint?: string;
    parameters: Record<string, any>;
    requiredPermissions: string[];
    riskLevel: 'low' | 'medium' | 'high';
    fallbackInstructions: string[];
}
export interface BulkResolutionResult {
    successful: ResolutionResult[];
    failed: ResolutionResult[];
    manual: ResolutionResult[];
    totalTime: number;
    successRate: number;
    recommendations: string[];
}
/**
 * Resolution strategies for ServiceNow configurations beyond MCP tools
 */
export declare const AUTO_RESOLUTION_STRATEGIES: ResolutionStrategy[];
export declare class AutoResolutionEngine {
    private mcpTools;
    private logger;
    private autoPermissions;
    constructor(mcpTools: any, logger: any, autoPermissions?: boolean);
    /**
     * Attempt to automatically resolve a single requirement
     */
    resolveRequirement(requirement: ServiceNowRequirement): Promise<ResolutionResult>;
    /**
     * Resolve multiple requirements in optimized order
     */
    resolveBulk(requirements: ServiceNowRequirement[]): Promise<BulkResolutionResult>;
    /**
     * Get available resolution strategies for a requirement type
     */
    getResolutionStrategies(requirementType: RequirementType): ResolutionStrategy[];
    /**
     * Check if a requirement can be auto-resolved
     */
    canAutoResolve(requirement: ServiceNowRequirement): boolean;
    private findResolutionStrategy;
    private executeMcpResolution;
    private executeDirectResolution;
    private buildRequestData;
    private makeServiceNowAPICall;
    private createManualResult;
    private generateManualInstructions;
    private generateBulkRecommendations;
}
//# sourceMappingURL=auto-resolution-engine.d.ts.map