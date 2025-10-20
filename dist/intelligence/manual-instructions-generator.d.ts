/**
 * Manual Instructions Generator - Creates detailed manual setup guides
 *
 * This module generates comprehensive, step-by-step instructions for ServiceNow
 * configurations that cannot be automated through MCP tools or direct API calls.
 *
 * Features:
 * - Role-specific instructions (admin, developer, end-user)
 * - Environment-aware guidance (dev, test, prod)
 * - Risk assessment and warnings
 * - Prerequisites and dependencies
 * - Verification steps and testing guidance
 */
import { ServiceNowRequirement, RequirementType } from './requirements-analyzer';
import { ResolutionResult } from './auto-resolution-engine';
export interface ManualInstruction {
    step: number;
    title: string;
    description: string;
    navigation: string[];
    actions: string[];
    screenshots?: string[];
    warnings?: string[];
    verificationSteps?: string[];
    estimatedTime?: string;
}
export interface ManualGuide {
    requirement: ServiceNowRequirement;
    title: string;
    overview: string;
    prerequisites: string[];
    totalEstimatedTime: string;
    riskLevel: 'low' | 'medium' | 'high';
    requiredRoles: string[];
    environment: 'development' | 'testing' | 'production' | 'any';
    instructions: ManualInstruction[];
    verificationGuide: string[];
    troubleshooting: Array<{
        issue: string;
        solution: string;
    }>;
    relatedDocuments: string[];
}
export interface BulkManualGuide {
    title: string;
    overview: string;
    executionOrder: Array<{
        phase: string;
        requirements: ServiceNowRequirement[];
        parallelExecution: boolean;
        estimatedTime: string;
    }>;
    guides: ManualGuide[];
    overallRisks: string[];
    coordinationNotes: string[];
}
/**
 * Manual instruction templates for ServiceNow configurations
 */
export declare const MANUAL_INSTRUCTION_TEMPLATES: Partial<Record<RequirementType, Partial<ManualGuide>>>;
export declare class ManualInstructionsGenerator {
    /**
     * Generate detailed manual instructions for a single requirement
     */
    static generateInstructions(requirement: ServiceNowRequirement): ManualGuide;
    /**
     * Generate bulk manual guide for multiple requirements
     */
    static generateBulkInstructions(requirements: ServiceNowRequirement[]): BulkManualGuide;
    /**
     * Generate instructions from failed automation results
     */
    static generateFromFailedResults(results: ResolutionResult[]): ManualGuide[];
    /**
     * Generate environment-specific instructions
     */
    static generateForEnvironment(requirement: ServiceNowRequirement, environment: 'development' | 'testing' | 'production'): ManualGuide;
    private static generateGenericInstructions;
    private static generateGenericVerification;
    private static calculateTotalTime;
    private static customizeInstructions;
    private static generateBulkOverview;
    private static planExecutionOrder;
    private static identifyOverallRisks;
    private static generateCoordinationNotes;
    private static generateRelatedDocuments;
}
//# sourceMappingURL=manual-instructions-generator.d.ts.map