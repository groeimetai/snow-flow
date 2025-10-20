/**
 * ServiceNow Queen Agent
 * Central coordination point for the ServiceNow hive-mind
 */
import { ServiceNowTask } from './types';
export interface QueenConfig {
    memoryPath?: string;
    maxConcurrentAgents?: number;
    learningRate?: number;
    debugMode?: boolean;
    autoPermissions?: boolean;
}
export declare class ServiceNowQueen {
    private memory;
    private neuralLearning;
    private agentFactory;
    private mcpBridge;
    private activeTasks;
    private config;
    private logger;
    constructor(config?: QueenConfig);
    /**
     * Main entry point: Execute ServiceNow objective with STRATEGIC ORCHESTRATION
     *
     * This is where the Queen Agent demonstrates true helicopter-view thinking:
     * - Deep problem analysis beyond surface requirements
     * - Strategic risk assessment and mitigation planning
     * - Holistic solution architecture considering all stakeholders
     * - Proactive bottleneck identification and resolution
     * - Comprehensive orchestration of specialized agents
     */
    executeObjective(objective: string): Promise<any>;
    private spawnOptimalSwarm;
    private coordinateExecution;
    private shouldExecuteInParallel;
    private executeAgentsInParallel;
    private executeAgentsSequentially;
    private facilitateAgentCoordination;
    private executeFinalDeployment;
    private createDeploymentPlan;
    private extractWidgetConfig;
    private extractScriptConfig;
    private generateArtifactName;
    private generateArtifactTitle;
    private generateWidgetTemplate;
    private generateWidgetCss;
    private generateClientScript;
    private generateServerScript;
    private generateDemoData;
    private generateScriptCode;
    private executeDeploymentPlan;
    private getServerForTool;
    private handleWidgetDependencies;
    private attemptRecovery;
    private learnFromExecution;
    private handleExecutionFailure;
    private cleanupTask;
    private generateTaskId;
    getActiveTaskCount(): number;
    getTaskStatus(taskId: string): ServiceNowTask | null;
    /**
     * Get gap _analysis results for a task
     */
    getGapAnalysisResults(taskId: string): any | null;
    /**
     * Get all manual guides from gap _analysis for a task
     */
    getManualConfigurationGuides(taskId: string): any;
    getHiveMindStatus(): any;
    exportMemory(): string;
    importMemory(memoryData: string): void;
    clearMemory(): void;
    getLearningInsights(): any;
    shutdown(): Promise<void>;
    /**
     * STRATEGIC ORCHESTRATION METHODS
     * These methods implement the Queen Agent's strategic thinking capabilities
     */
    /**
     * Perform deep problem analysis to understand what user ACTUALLY needs
     */
    private performDeepProblemAnalysis;
    /**
     * Perform comprehensive risk assessment
     */
    private performRiskAssessment;
    /**
     * Extract the core business problem from user request
     */
    private getTableForType;
    private extractSysIdFromObjective;
    private extractCoreProblem;
    /**
     * Assess objective complexity
     */
    private assessObjectiveComplexity;
    /**
     * Assess business impact
     */
    private assessBusinessImpact;
    /**
     * Identify stakeholders affected by the change
     */
    private identifyStakeholders;
    /**
     * Identify hidden requirements not explicitly stated
     */
    private identifyHiddenRequirements;
    /**
     * Define clear success criteria
     */
    private defineSuccessCriteria;
    /**
     * Identify technical risks
     */
    private identifyTechnicalRisks;
    /**
     * Identify business risks
     */
    private identifyBusinessRisks;
    /**
     * Identify operational risks
     */
    private identifyOperationalRisks;
    /**
     * Identify compliance risks
     */
    private identifyComplianceRisks;
    /**
     * Calculate overall risk level
     */
    private calculateOverallRisk;
    /**
     * Develop mitigation strategies for critical risks
     */
    private developMitigationStrategies;
    /**
     * Design solution architecture based on strategic analysis
     */
    private designSolutionArchitecture;
    /**
     * Generate implementation steps based on approach
     */
    private generateImplementationSteps;
    /**
     * Define quality gates based on analysis
     */
    private defineQualityGates;
    /**
     * Define monitoring strategy
     */
    private defineMonitoringStrategy;
}
//# sourceMappingURL=servicenow-queen.d.ts.map