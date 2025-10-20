/**
 * Snow-Flow Error Handling & Recovery System
 * Implements comprehensive error recovery patterns from MCP Architecture
 */
import { EventEmitter } from 'events';
import { Logger } from './logger';
import { MemorySystem } from '../memory/memory-system';
export interface ErrorContext {
    operation: string;
    sessionId?: string;
    agentId?: string;
    artifactId?: string;
    attemptNumber?: number;
    fallbackStrategies?: string[];
    metadata?: Record<string, any>;
}
export interface RecoveryStrategy {
    name: string;
    condition: (error: Error, context: ErrorContext) => boolean;
    execute: (error: Error, context: ErrorContext) => Promise<RecoveryResult>;
    priority: number;
}
export interface RecoveryResult {
    success: boolean;
    strategyUsed?: string;
    result?: any;
    error?: Error;
    nextStrategies?: string[];
}
export interface ErrorMetrics {
    totalErrors: number;
    recoveredErrors: number;
    failedRecoveries: number;
    errorsByType: Record<string, number>;
    recoveryStrategiesUsed: Record<string, number>;
    averageRecoveryTime: number;
}
export declare class ErrorRecovery extends EventEmitter {
    private logger;
    private strategies;
    private errorHistory;
    private memory?;
    private maxRetries;
    private retryDelay;
    private exponentialBackoff;
    constructor(logger: Logger, memory?: MemorySystem);
    /**
     * Initialize default recovery strategies
     */
    private initializeDefaultStrategies;
    /**
     * Register a custom recovery strategy
     */
    registerStrategy(strategy: RecoveryStrategy): void;
    /**
     * Handle an error with automatic recovery
     */
    handleError(error: Error, context: ErrorContext): Promise<RecoveryResult>;
    /**
     * Handle critical errors that affect the entire system
     */
    handleCriticalError(error: Error, context: ErrorContext): Promise<void>;
    /**
     * Attempt to recover a failed swarm session
     */
    attemptSwarmRecovery(sessionId: string, error: Error): Promise<RecoveryResult>;
    /**
     * Get error metrics
     */
    getMetrics(): ErrorMetrics;
    /**
     * Clear error history
     */
    clearHistory(): void;
    /**
     * Private helper methods
     */
    private getApplicableStrategies;
    private isUnrecoverable;
    private isPermissionError;
    private isScopeError;
    private isDataConsistencyError;
    private canPartiallySucceed;
    private calculateRetryDelay;
    private requestPermissionEscalation;
    private extractPartialSuccess;
    private generateManualSteps;
    private executeEmergencyStrategy;
    private resumeFromCheckpoint;
    private recordError;
    private recordRecovery;
    private recordFailedRecovery;
    private delay;
}
export declare const FALLBACK_STRATEGIES: {
    widget_deployment: string[];
    flow_creation: string[];
    script_execution: string[];
    integration_failure: string[];
};
//# sourceMappingURL=error-recovery.d.ts.map