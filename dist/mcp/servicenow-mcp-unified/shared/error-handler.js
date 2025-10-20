"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SnowFlowError = exports.ErrorType = void 0;
exports.retryWithBackoff = retryWithBackoff;
exports.classifyError = classifyError;
exports.handleError = handleError;
exports.createSuccessResult = createSuccessResult;
exports.createErrorResult = createErrorResult;
exports.executeWithErrorHandling = executeWithErrorHandling;
/**
 * Error classification
 */
var ErrorType;
(function (ErrorType) {
    // Network errors (retryable)
    ErrorType["NETWORK_ERROR"] = "NETWORK_ERROR";
    ErrorType["TIMEOUT"] = "TIMEOUT";
    ErrorType["TIMEOUT_ERROR"] = "TIMEOUT_ERROR";
    ErrorType["CONNECTION_RESET"] = "CONNECTION_RESET";
    // Auth errors (may need token refresh)
    ErrorType["UNAUTHORIZED"] = "UNAUTHORIZED";
    ErrorType["FORBIDDEN"] = "FORBIDDEN";
    // ServiceNow API errors
    ErrorType["INVALID_REQUEST"] = "INVALID_REQUEST";
    ErrorType["RESOURCE_NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    ErrorType["NOT_FOUND"] = "NOT_FOUND";
    ErrorType["NOT_FOUND_ERROR"] = "NOT_FOUND_ERROR";
    ErrorType["RATE_LIMIT_EXCEEDED"] = "RATE_LIMIT_EXCEEDED";
    ErrorType["SERVICENOW_API_ERROR"] = "SERVICENOW_API_ERROR";
    ErrorType["VALIDATION_ERROR"] = "VALIDATION_ERROR";
    // ServiceNow business logic errors
    ErrorType["ES5_SYNTAX_ERROR"] = "ES5_SYNTAX_ERROR";
    ErrorType["WIDGET_COHERENCE_ERROR"] = "WIDGET_COHERENCE_ERROR";
    ErrorType["UPDATE_SET_CONFLICT"] = "UPDATE_SET_CONFLICT";
    ErrorType["DEPENDENCY_MISSING"] = "DEPENDENCY_MISSING";
    ErrorType["PLUGIN_MISSING"] = "PLUGIN_MISSING";
    // Critical errors (not retryable)
    ErrorType["DEPLOYMENT_FAILED"] = "DEPLOYMENT_FAILED";
    ErrorType["DATA_CORRUPTION"] = "DATA_CORRUPTION";
    ErrorType["ROLLBACK_FAILED"] = "ROLLBACK_FAILED";
    // Unknown errors
    ErrorType["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
})(ErrorType || (exports.ErrorType = ErrorType = {}));
/**
 * Standard error structure
 */
class SnowFlowError extends Error {
    constructor(type, message, options = {}) {
        super(message);
        this.name = 'SnowFlowError';
        this.type = type;
        this.retryable = options.retryable ?? this.isRetryableByType(type);
        this.details = options.details;
        this.originalError = options.originalError;
        this.context = options.context;
        this.timestamp = new Date();
        // Capture stack trace
        Error.captureStackTrace(this, SnowFlowError);
    }
    /**
     * Determine if error type is retryable by default
     */
    isRetryableByType(type) {
        const retryableTypes = [
            ErrorType.NETWORK_ERROR,
            ErrorType.TIMEOUT,
            ErrorType.CONNECTION_RESET,
            ErrorType.RATE_LIMIT_EXCEEDED
        ];
        return retryableTypes.includes(type);
    }
    /**
     * Convert to ToolResult format
     */
    toToolResult() {
        return {
            success: false,
            error: this.message,
            metadata: {
                errorType: this.type,
                retryable: this.retryable,
                details: this.details,
                timestamp: this.timestamp.toISOString(),
                ...this.context
            }
        };
    }
}
exports.SnowFlowError = SnowFlowError;
/**
 * Default retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
    maxAttempts: 3,
    backoff: 'exponential',
    initialDelay: 1000,
    maxDelay: 10000,
    retryableErrors: [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'RATE_LIMIT_EXCEEDED',
        'NETWORK_ERROR',
        'TIMEOUT'
    ]
};
/**
 * Retry operation with exponential backoff
 */
async function retryWithBackoff(operation, config = {}) {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError;
    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
        try {
            console.log(`[ErrorHandler] Attempt ${attempt}/${retryConfig.maxAttempts}`);
            return await operation();
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            const snowFlowError = classifyError(error);
            if (!snowFlowError.retryable) {
                console.error('[ErrorHandler] Non-retryable error:', snowFlowError.type);
                throw snowFlowError;
            }
            // Last attempt - throw error
            if (attempt === retryConfig.maxAttempts) {
                console.error('[ErrorHandler] All retry attempts exhausted');
                throw snowFlowError;
            }
            // Calculate backoff delay
            const delay = calculateBackoff(attempt, retryConfig);
            console.log(`[ErrorHandler] Retrying in ${delay}ms (attempt ${attempt}/${retryConfig.maxAttempts})`);
            // Wait before retry
            await sleep(delay);
        }
    }
    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed');
}
/**
 * Calculate backoff delay
 */
function calculateBackoff(attempt, config) {
    let delay;
    if (config.backoff === 'exponential') {
        // Exponential: initialDelay * 2^(attempt-1)
        delay = config.initialDelay * Math.pow(2, attempt - 1);
    }
    else {
        // Linear: initialDelay * attempt
        delay = config.initialDelay * attempt;
    }
    // Cap at maxDelay
    return Math.min(delay, config.maxDelay);
}
/**
 * Sleep utility
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Classify error into SnowFlowError
 */
function classifyError(error) {
    // Already a SnowFlowError
    if (error instanceof SnowFlowError) {
        return error;
    }
    // Axios error (HTTP/network)
    if (error.isAxiosError) {
        return classifyAxiosError(error);
    }
    // ServiceNow API error
    if (error.response?.data?.error) {
        return classifyServiceNowError(error);
    }
    // Generic JavaScript error
    return new SnowFlowError(ErrorType.UNKNOWN_ERROR, error.message || 'Unknown error occurred', {
        retryable: false,
        details: {
            name: error.name,
            stack: error.stack
        },
        originalError: error
    });
}
/**
 * Classify Axios error
 */
function classifyAxiosError(error) {
    const code = error.code;
    const status = error.response?.status;
    // Network errors
    if (code === 'ECONNRESET') {
        return new SnowFlowError(ErrorType.CONNECTION_RESET, 'Connection reset by ServiceNow instance', {
            retryable: true,
            details: { code, url: error.config?.url },
            originalError: error
        });
    }
    if (code === 'ETIMEDOUT' || code === 'ECONNABORTED') {
        return new SnowFlowError(ErrorType.TIMEOUT, 'Request timed out', {
            retryable: true,
            details: { code, timeout: error.config?.timeout },
            originalError: error
        });
    }
    if (code === 'ENOTFOUND' || code === 'ECONNREFUSED') {
        return new SnowFlowError(ErrorType.NETWORK_ERROR, 'Network error: Cannot reach ServiceNow instance', {
            retryable: true,
            details: { code, url: error.config?.url },
            originalError: error
        });
    }
    // HTTP status codes
    if (status === 401) {
        return new SnowFlowError(ErrorType.UNAUTHORIZED, 'Authentication failed - token may be expired', {
            retryable: true, // Token refresh will be attempted
            details: { status, url: error.config?.url },
            originalError: error
        });
    }
    if (status === 403) {
        return new SnowFlowError(ErrorType.FORBIDDEN, 'Access forbidden - insufficient permissions', {
            retryable: false,
            details: { status, url: error.config?.url },
            originalError: error
        });
    }
    if (status === 404) {
        return new SnowFlowError(ErrorType.RESOURCE_NOT_FOUND, 'Resource not found in ServiceNow', {
            retryable: false,
            details: { status, url: error.config?.url },
            originalError: error
        });
    }
    if (status === 429) {
        return new SnowFlowError(ErrorType.RATE_LIMIT_EXCEEDED, 'ServiceNow API rate limit exceeded', {
            retryable: true,
            details: { status, retryAfter: error.response?.headers['retry-after'] },
            originalError: error
        });
    }
    // Generic HTTP error
    return new SnowFlowError(ErrorType.INVALID_REQUEST, `HTTP ${status}: ${error.message}`, {
        retryable: false,
        details: { status, url: error.config?.url, data: error.response?.data },
        originalError: error
    });
}
/**
 * Classify ServiceNow API error
 */
function classifyServiceNowError(error) {
    const snowError = error.response?.data;
    const message = snowError?.error?.message || 'ServiceNow API error';
    const detail = snowError?.error?.detail;
    // Check for specific error patterns
    if (detail?.includes('ES5') || detail?.includes('const') || detail?.includes('let')) {
        return new SnowFlowError(ErrorType.ES5_SYNTAX_ERROR, 'ES5 syntax violation detected', {
            retryable: false,
            details: { message, detail },
            originalError: error
        });
    }
    if (detail?.includes('coherence') || detail?.includes('data.')) {
        return new SnowFlowError(ErrorType.WIDGET_COHERENCE_ERROR, 'Widget coherence validation failed', {
            retryable: false,
            details: { message, detail },
            originalError: error
        });
    }
    if (detail?.includes('update set') || detail?.includes('conflict')) {
        return new SnowFlowError(ErrorType.UPDATE_SET_CONFLICT, 'Update Set conflict detected', {
            retryable: false,
            details: { message, detail },
            originalError: error
        });
    }
    // Generic ServiceNow error
    return new SnowFlowError(ErrorType.INVALID_REQUEST, message, {
        retryable: false,
        details: { message, detail, status: snowError?.status },
        originalError: error
    });
}
/**
 * Handle error with context
 */
function handleError(error, toolName, context = {}) {
    const snowFlowError = classifyError(error);
    snowFlowError.context = {
        tool: toolName,
        ...context
    };
    // Log error with context
    console.error(`[ErrorHandler] Error in ${toolName}:`, {
        type: snowFlowError.type,
        message: snowFlowError.message,
        retryable: snowFlowError.retryable,
        details: snowFlowError.details
    });
    return snowFlowError;
}
/**
 * Create success ToolResult
 */
function createSuccessResult(data, metadata = {}) {
    return {
        success: true,
        data,
        metadata
    };
}
/**
 * Create error ToolResult
 */
function createErrorResult(error, metadata = {}) {
    if (typeof error === 'string') {
        return {
            success: false,
            error,
            metadata
        };
    }
    return error.toToolResult();
}
/**
 * Wrap tool execution with error handling
 */
async function executeWithErrorHandling(toolName, operation, options = {}) {
    try {
        let result;
        if (options.retry) {
            result = await retryWithBackoff(operation, options.retryConfig);
        }
        else {
            result = await operation();
        }
        return createSuccessResult(result, {
            tool: toolName,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        const snowFlowError = handleError(error, toolName, options.context);
        return createErrorResult(snowFlowError);
    }
}
//# sourceMappingURL=error-handler.js.map