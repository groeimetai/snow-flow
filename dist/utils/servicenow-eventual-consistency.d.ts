/**
 * ServiceNow Eventual Consistency Handler
 *
 * ServiceNow uses a distributed database architecture with eventual consistency:
 * - Write operations go to primary database (immediate)
 * - Read operations may use read replicas (1-3 second lag)
 * - This causes race conditions in deployment verification
 */
import { ServiceNowClient } from './servicenow-client.js';
export interface RetryConfig {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
}
export interface VerificationResult {
    success: boolean;
    attempts: number;
    finalAttemptError?: any;
    isLikelyTimingIssue: boolean;
}
export declare class ServiceNowEventualConsistency {
    private logger;
    constructor(loggerName?: string);
    /**
     * Retry a ServiceNow operation with exponential backoff
     * Designed specifically for post-deployment verification
     */
    retryWithBackoff<T>(operation: () => Promise<T>, config?: RetryConfig): Promise<{
        result: T | null;
        success: boolean;
        attempts: number;
    }>;
    /**
     * Verify a ServiceNow record exists with retry logic
     */
    verifyRecordExists(client: ServiceNowClient, table: string, sys_id: string, config?: RetryConfig): Promise<VerificationResult>;
    /**
     * Verify multiple records exist (batch verification)
     */
    verifyMultipleRecords(client: ServiceNowClient, verifications: Array<{
        table: string;
        sys_id: string;
        name?: string;
    }>, config?: RetryConfig): Promise<Array<VerificationResult & {
        table: string;
        sys_id: string;
        name?: string;
    }>>;
    /**
     * Execute operation with eventual consistency retry
     * Generic wrapper for any ServiceNow operation that might fail due to timing
     */
    executeWithRetry<T>(operationName: string, operation: () => Promise<T>, validator: (result: T) => boolean, config?: RetryConfig): Promise<{
        result: T | null;
        success: boolean;
        metadata: any;
    }>;
    /**
     * Sleep utility
     */
    private sleep;
    /**
     * Determine if an error indicates a permanent failure vs timing issue
     */
    private isPermanentError;
    /**
     * Get user-friendly error description
     */
    private getErrorDescription;
    /**
     * Assess if failure is likely due to timing issues
     */
    private assessIfTimingIssue;
    /**
     * Create a pre-configured instance for widget deployments
     */
    static createForWidgets(): ServiceNowEventualConsistency;
    /**
     * Create a pre-configured instance for flow deployments
     */
    static createForFlows(): ServiceNowEventualConsistency;
    /**
     * Create a pre-configured instance for application deployments
     */
    static createForApplications(): ServiceNowEventualConsistency;
}
/**
 * Default configuration for different deployment types
 */
export declare const CONSISTENCY_CONFIGS: {
    WIDGET: {
        maxRetries: number;
        baseDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
    };
    FLOW: {
        maxRetries: number;
        baseDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
    };
    APPLICATION: {
        maxRetries: number;
        baseDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
    };
    BATCH: {
        maxRetries: number;
        baseDelay: number;
        maxDelay: number;
        backoffMultiplier: number;
    };
};
export declare const widgetConsistency: ServiceNowEventualConsistency;
export declare const flowConsistency: ServiceNowEventualConsistency;
export declare const appConsistency: ServiceNowEventualConsistency;
//# sourceMappingURL=servicenow-eventual-consistency.d.ts.map