/**
 * ServiceNow Queen Memory System - JSON-based implementation
 * Simple JSON file storage for the hive-mind - no more SQLite permission issues!
 */
import { DeploymentPattern, ServiceNowArtifact } from './types';
export declare class QueenMemorySystem {
    private memoryDir;
    private memory;
    private storage;
    private saveDebounceTimer?;
    private readonly SAVE_DELAY;
    constructor(dbPath?: string);
    private getFilePath;
    private loadStorage;
    private convertStorageToMemory;
    private scheduleSave;
    private saveAll;
    private saveJSON;
    storePattern(pattern: DeploymentPattern): void;
    getBestPattern(taskType: string): DeploymentPattern | null;
    storeArtifact(artifact: ServiceNowArtifact): void;
    findSimilarArtifacts(type: string, namePattern: string): ServiceNowArtifact[];
    storeLearning(key: string, value: any, confidence?: number): void;
    getLearning(key: string): any | null;
    recordTaskCompletion(taskId: string, objective: string, type: string, agentsUsed: string[], success: boolean, duration: number): void;
    getSuccessRate(taskType: string): number;
    exportMemory(): string;
    importMemory(memoryData: string): void;
    clearMemory(): void;
    storeInContext(key: string, value: any): void;
    getFromContext(key: string): any;
    store(key: string, value: any): void;
    get(key: string): any;
    getDbPath(): string;
    close(): void;
    /**
     * Find similar patterns for a given task type
     */
    findSimilarPatterns(taskType: string): DeploymentPattern[];
    /**
     * Store a decision made by the Queen
     */
    storeDecision(taskId: string, decision: any): void;
    /**
     * Find the best pattern for a task type
     */
    findBestPattern(taskType: string): DeploymentPattern | null;
    /**
     * Get memory statistics
     */
    getStats(): any;
    /**
     * Store progress information
     */
    storeProgress(agentId: string, progress: any): void;
    /**
     * Get progress information
     */
    getProgress(agentId: string): any;
    /**
     * Store failure pattern for learning
     */
    storeFailurePattern(pattern: any): void;
}
//# sourceMappingURL=queen-memory.d.ts.map