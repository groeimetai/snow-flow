/**
 * Timeout Manager for Snow-Flow
 * Provides intelligent timeout configuration and retry logic
 */
/**
 * Operation types with their specific timeout requirements
 */
export declare enum OperationType {
    SIMPLE_QUERY = "simple_query",
    SINGLE_RECORD = "single_record",
    HEALTH_CHECK = "health_check",
    TABLE_QUERY = "table_query",
    CREATE_RECORD = "create_record",
    UPDATE_RECORD = "update_record",
    DELETE_RECORD = "delete_record",
    BATCH_OPERATION = "batch_operation",
    BULK_QUERY = "bulk_query",
    DEPLOYMENT = "deployment",
    WORKFLOW_EXECUTION = "workflow_execution",
    ML_TRAINING = "ml_training",
    ML_BATCH_FETCH = "ml_batch_fetch",
    ML_PREDICTION = "ml_prediction",
    LARGE_EXPORT = "large_export",
    MIGRATION = "migration",
    FULL_SYNC = "full_sync"
}
/**
 * Timeout configuration with intelligent defaults
 */
export interface TimeoutConfig {
    baseTimeout: number;
    maxTimeout: number;
    retryCount: number;
    backoffMultiplier: number;
    jitterRange: number;
}
/**
 * Get timeout configuration for operation type
 */
export declare function getTimeoutConfig(operationType: OperationType): TimeoutConfig;
/**
 * Calculate timeout with exponential backoff
 */
export declare function calculateTimeout(config: TimeoutConfig, attemptNumber: number): number;
/**
 * Retry wrapper with exponential backoff
 */
export declare function withRetry<T>(operation: () => Promise<T>, operationType: OperationType, operationName?: string): Promise<T>;
/**
 * Detect operation type from context
 */
export declare function detectOperationType(context: {
    tool?: string;
    table?: string;
    action?: string;
    limit?: number;
}): OperationType;
/**
 * Get human-readable timeout description
 */
export declare function getTimeoutDescription(operationType: OperationType): string;
//# sourceMappingURL=timeout-manager.d.ts.map