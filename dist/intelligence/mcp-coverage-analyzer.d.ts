/**
 * MCP Coverage Analyzer - Maps what ServiceNow MCP tools can handle
 *
 * This module analyzes what ServiceNow configurations and operations
 * our current MCP tools can handle versus what requires manual intervention
 * or additional automation.
 */
import { RequirementType, ServiceNowRequirement } from './requirements-analyzer';
export interface McpToolCapability {
    tool: string;
    requirementTypes: RequirementType[];
    description: string;
    limitations?: string[];
    scope: 'global' | 'scoped' | 'both';
    autoDeployable: boolean;
    requiresPermissions?: string[];
}
export interface CoverageAnalysis {
    covered: ServiceNowRequirement[];
    gaps: ServiceNowRequirement[];
    partialCoverage: Array<{
        requirement: ServiceNowRequirement;
        coveringTool: string;
        limitations: string[];
        manualSteps: string[];
    }>;
    coveragePercentage: number;
    recommendations: string[];
}
export interface AutomationCapability {
    canAutomate: boolean;
    automationTool?: string;
    requiredPermissions?: string[];
    riskLevel: 'low' | 'medium' | 'high';
    complexity: 'simple' | 'moderate' | 'complex';
    estimatedTime?: string;
    fallbackStrategy?: string;
}
/**
 * Comprehensive mapping of all ServiceNow MCP tool capabilities
 */
export declare const MCP_TOOL_CAPABILITIES: McpToolCapability[];
/**
 * Requirements that have NO current MCP coverage and require manual intervention
 */
export declare const UNCOVERED_REQUIREMENTS: RequirementType[];
export declare class McpCoverageAnalyzer {
    /**
     * Analyze coverage for a list of requirements
     */
    static analyzeCoverage(requirements: ServiceNowRequirement[]): CoverageAnalysis;
    /**
     * Analyze automation capabilities for a specific requirement
     */
    static analyzeAutomationCapability(requirement: ServiceNowRequirement): AutomationCapability;
    /**
     * Get all available tools for a requirement type
     */
    static getAvailableTools(requirementType: RequirementType): McpToolCapability[];
    /**
     * Check if a requirement type is completely uncovered
     */
    static isUncovered(requirementType: RequirementType): boolean;
    /**
     * Generate automation strategy for a list of requirements
     */
    static generateAutomationStrategy(requirements: ServiceNowRequirement[]): {
        automatable: ServiceNowRequirement[];
        manual: ServiceNowRequirement[];
        sequence: Array<{
            step: number;
            requirements: ServiceNowRequirement[];
            strategy: 'parallel' | 'sequential';
            estimatedTime: string;
        }>;
    };
    private static findToolCapability;
    private static generateManualSteps;
    private static generateRecommendations;
    private static categorizeGaps;
    private static assessRiskLevel;
    private static assessComplexity;
    private static estimateTime;
    private static getFallbackStrategy;
    private static planExecutionSequence;
    private static groupByExecutionOrder;
    private static calculateGroupTime;
}
//# sourceMappingURL=mcp-coverage-analyzer.d.ts.map