/**
 * Shared Error Handling Module
 *
 * Provides unified error handling, retry logic, and recovery strategies
 * for all ServiceNow MCP tools. Replaces 34 duplicate error handlers
 * with consistent, predictable error management.
 *
 * Features:
 * - Standardized error formats
 * - Automatic retry with exponential backoff
 * - Error classification (retryable vs fatal)
 * - Detailed error messages for debugging
 * - Rollback coordination
 */
import { RetryConfig, ToolResult } from './types';
/**
 * Error classification
 */
export declare enum ErrorType {
    NETWORK_ERROR = "NETWORK_ERROR",
    TIMEOUT = "TIMEOUT",
    TIMEOUT_ERROR = "TIMEOUT_ERROR",// Alias for TIMEOUT
    CONNECTION_RESET = "CONNECTION_RESET",
    UNAUTHORIZED = "UNAUTHORIZED",
    FORBIDDEN = "FORBIDDEN",
    INVALID_REQUEST = "INVALID_REQUEST",
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
    NOT_FOUND = "NOT_FOUND",// Alias for RESOURCE_NOT_FOUND
    NOT_FOUND_ERROR = "NOT_FOUND_ERROR",// Additional alias
    RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
    SERVICENOW_API_ERROR = "SERVICENOW_API_ERROR",// Generic API error
    VALIDATION_ERROR = "VALIDATION_ERROR",// Validation failure
    ES5_SYNTAX_ERROR = "ES5_SYNTAX_ERROR",
    WIDGET_COHERENCE_ERROR = "WIDGET_COHERENCE_ERROR",
    UPDATE_SET_CONFLICT = "UPDATE_SET_CONFLICT",
    DEPENDENCY_MISSING = "DEPENDENCY_MISSING",
    PLUGIN_MISSING = "PLUGIN_MISSING",// Plugin not installed
    DEPLOYMENT_FAILED = "DEPLOYMENT_FAILED",
    DATA_CORRUPTION = "DATA_CORRUPTION",
    ROLLBACK_FAILED = "ROLLBACK_FAILED",
    UNKNOWN_ERROR = "UNKNOWN_ERROR"
}
/**
 * Standard error structure
 */
export declare class SnowFlowError extends Error {
    type: ErrorType;
    retryable: boolean;
    details: any;
    originalError?: Error;
    timestamp: Date;
    context?: {
        tool?: string;
        args?: any;
        instanceUrl?: string;
    };
    constructor(type: ErrorType, message: string, options?: {
        retryable?: boolean;
        details?: any;
        originalError?: Error;
        context?: any;
    });
    /**
     * Determine if error type is retryable by default
     */
    private isRetryableByType;
    /**
     * Convert to ToolResult format
     */
    toToolResult(): ToolResult;
}
/**
 * Retry operation with exponential backoff
 */
export declare function retryWithBackoff<T>(operation: () => Promise<T>, config?: Partial<RetryConfig>): Promise<T>;
/**
 * Classify error into SnowFlowError
 */
export declare function classifyError(error: any): SnowFlowError;
/**
 * Handle error with context
 */
export declare function handleError(error: any, toolName: string, context?: {
    args?: any;
    instanceUrl?: string;
}): SnowFlowError;
/**
 * Create success ToolResult
 */
export declare function createSuccessResult(data: any, metadata?: any): ToolResult;
/**
 * Create error ToolResult
 */
export declare function createErrorResult(error: SnowFlowError | string, metadata?: any): ToolResult;
/**
 * Wrap tool execution with error handling
 */
export declare function executeWithErrorHandling<T>(toolName: string, operation: () => Promise<T>, options?: {
    retry?: boolean;
    retryConfig?: Partial<RetryConfig>;
    context?: any;
}): Promise<ToolResult>;
//# sourceMappingURL=error-handler.d.ts.map