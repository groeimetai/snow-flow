/**
 * Task Analysis Engine - AI-powered _analysis of unknown requirements
 */
import { TaskPriority } from '../types/snow-flow.types.js';
export interface TaskAnalysis {
    taskType: TaskType;
    complexity: 'low' | 'medium' | 'high';
    requiredSkills: SkillSet[];
    estimatedDuration: number;
    hasServiceNowComponents: boolean;
    requiresDataProcessing: boolean;
    requiresIntegration: boolean;
    requiresUserInterface: boolean;
    requiresAutomation: boolean;
    requiresReporting: boolean;
    requiresSecurity: boolean;
    canParallelize: boolean;
    hasStrictDependencies: boolean;
    riskLevel: 'low' | 'medium' | 'high';
    recommendations: string[];
    recommendedPattern?: string;
    successRate: number;
    priority: TaskPriority;
    keyEntities: string[];
    businessImpact: 'low' | 'medium' | 'high';
}
export interface SkillSet {
    type: string;
    importance: 'primary' | 'secondary' | 'optional';
    complexity: 'low' | 'medium' | 'high';
    estimatedTime: number;
}
export interface TeamComposition {
    coordinatorRole: string;
    primarySpecialists: string[];
    secondarySpecialists: string[];
    estimatedTeamSize: number;
    recommendedStructure: 'flat' | 'hierarchical' | 'matrix';
}
export type TaskType = 'data_integration' | 'workflow_automation' | 'ui_development' | 'reporting_analytics' | 'security_compliance' | 'system_integration' | 'custom_development' | 'process_optimization' | 'incident_management' | 'catalog_management' | 'user_provisioning' | 'notification_system' | 'approval_workflow' | 'dashboard_creation' | 'api_development' | 'migration_task' | 'configuration_management' | 'testing_validation' | 'documentation' | 'monitoring_alerting' | 'unknown';
interface TaskAnalysisRequest {
    description: string;
    context?: any;
    priority?: TaskPriority;
    constraints?: string[];
    expectedOutput?: string;
}
export declare class TaskAnalyzer {
    private logger;
    private knowledgeBase;
    private patternLibrary;
    constructor();
    /**
     * Analyze task type and requirements from natural language
     */
    analyzeTaskType(request: TaskAnalysisRequest): Promise<TaskAnalysis>;
    /**
     * Identify required skills based on task analysis
     */
    identifyRequiredSkills(_analysis: TaskAnalysis): Promise<SkillSet[]>;
    /**
     * Suggest optimal team composition
     */
    suggestTeamComposition(skills: SkillSet[]): Promise<TeamComposition>;
    /**
     * Identify task type from description
     */
    private identifyTaskType;
    /**
     * Assess task complexity
     */
    private assessComplexity;
    /**
     * Identify required components
     */
    private identifyRequiredComponents;
    /**
     * Extract key entities from description
     */
    private extractKeyEntities;
    /**
     * Determine if task can be parallelized
     */
    private canTaskParallelize;
    /**
     * Determine if task has strict dependencies
     */
    private hasStrictDependencies;
    /**
     * Calculate risk level
     */
    private calculateRiskLevel;
    /**
     * Generate recommendations
     */
    private generateRecommendations;
    /**
     * Estimate task duration in milliseconds
     */
    private estimateTaskDuration;
    /**
     * Estimate success rate based on task characteristics
     */
    private estimateSuccessRate;
    /**
     * Assess business impact
     */
    private assessBusinessImpact;
    /**
     * Initialize knowledge base with patterns and learnings
     */
    private initializeKnowledgeBase;
    /**
     * Initialize pattern library
     */
    private initializePatternLibrary;
}
export {};
//# sourceMappingURL=task-analyzer.d.ts.map