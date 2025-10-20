/**
 * ServiceNow Queen Neural Learning System
 * Pattern recognition and adaptive learning from deployment history
 */
import { TaskAnalysis, AgentType, ServiceNowTask } from './types';
import { QueenMemorySystem } from './queen-memory';
export declare class NeuralLearning {
    private memory;
    private learningWeights;
    constructor(memory: QueenMemorySystem);
    private initializeLearningWeights;
    analyzeTask(objective: string): TaskAnalysis;
    private classifyTask;
    private estimateComplexity;
    private evaluateComplexityFactor;
    private countKeywords;
    private suggestAgents;
    private identifyDependencies;
    learnFromSuccess(task: ServiceNowTask, duration: number, agentsUsed: AgentType[]): void;
    learnFromFailure(task: ServiceNowTask, error: string, agentsUsed: AgentType[]): void;
    private calculateNewSuccessRate;
    private inferMcpSequence;
    private adjustWeightsFromSuccess;
    private adjustWeightsFromFailure;
    getLearningInsights(): any;
    private calculateOverallConfidence;
}
//# sourceMappingURL=neural-learning.d.ts.map