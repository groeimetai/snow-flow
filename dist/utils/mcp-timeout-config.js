"use strict";
/**
 * MCP Server Timeout Configuration
 *
 * Provides fast, reliable timeout settings for MCP server operations
 * to prevent Claude from timing out during API calls.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMCPTimeoutConfig = getMCPTimeoutConfig;
exports.withMCPTimeout = withMCPTimeout;
exports.withMCPRetry = withMCPRetry;
exports.quickHealthCheck = quickHealthCheck;
/**
 * Get MCP timeout configuration based on environment
 */
function getMCPTimeoutConfig() {
    const isDebug = process.env.DEBUG === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    // Balanced timeouts - long enough for real work, short enough to prevent hanging
    const config = {
        // Server should start reasonably quickly
        serverInitTimeout: parseInt(process.env.MCP_SERVER_INIT_TIMEOUT || '10000'), // 10s for server init
        // Tool timeouts - balanced for real operations
        defaultToolTimeout: parseInt(process.env.MCP_DEFAULT_TOOL_TIMEOUT || '30000'), // 30s default
        queryToolTimeout: parseInt(process.env.MCP_QUERY_TIMEOUT || '15000'), // 15s for queries
        pullToolTimeout: parseInt(process.env.MCP_PULL_TIMEOUT || '60000'), // 60s for pulls (large widgets)
        pushToolTimeout: parseInt(process.env.MCP_PUSH_TIMEOUT || '45000'), // 45s for pushes
        debugToolTimeout: parseInt(process.env.MCP_DEBUG_TIMEOUT || '30000'), // 30s for debug
        scriptToolTimeout: parseInt(process.env.MCP_SCRIPT_TIMEOUT || '120000'), // 2 min for scripts
        // API calls get reasonable time
        apiCallTimeout: parseInt(process.env.MCP_API_TIMEOUT || '15000'), // 15s per API call
        apiRetryDelay: parseInt(process.env.MCP_API_RETRY_DELAY || '2000'), // 2s between retries
        apiMaxRetries: parseInt(process.env.MCP_API_MAX_RETRIES || '3'), // 3 retries for resilience
        // Health checks
        healthCheckInterval: parseInt(process.env.MCP_HEALTH_INTERVAL || '30000'), // Every 30s
        healthCheckTimeout: parseInt(process.env.MCP_HEALTH_TIMEOUT || '2000'), // 2s timeout
        // Response optimization
        maxResponseSize: parseInt(process.env.MCP_MAX_RESPONSE_SIZE || '100000'), // 100KB chunks
        chunkDelay: parseInt(process.env.MCP_CHUNK_DELAY || '100'), // 100ms between chunks
    };
    // In debug mode, allow longer timeouts
    if (isDebug) {
        config.defaultToolTimeout *= 2;
        config.queryToolTimeout *= 2;
        config.pullToolTimeout *= 2;
        config.pushToolTimeout *= 2;
        config.debugToolTimeout *= 2;
        config.scriptToolTimeout *= 2;
    }
    // In production, ensure fast responses
    if (isProduction) {
        config.apiMaxRetries = 1; // Only 1 retry in production
        config.apiRetryDelay = 500; // Faster retry
    }
    return config;
}
/**
 * Wrap a promise with timeout protection
 */
async function withMCPTimeout(promise, timeoutMs, operationName = 'Operation') {
    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error(`${operationName} timed out after ${timeoutMs / 1000}s`));
        }, timeoutMs);
    });
    try {
        return await Promise.race([promise, timeoutPromise]);
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
            // Log timeout for debugging
            console.error(`⏱️ MCP Timeout: ${operationName} exceeded ${timeoutMs}ms`);
            // Add context about what to do
            error.message += ' - Consider increasing timeout or optimizing the operation';
        }
        throw error;
    }
}
/**
 * Execute with retry logic and timeout
 */
async function withMCPRetry(fn, config = {}, operationName = 'Operation') {
    const fullConfig = { ...getMCPTimeoutConfig(), ...config };
    let lastError = null;
    for (let attempt = 0; attempt <= fullConfig.apiMaxRetries; attempt++) {
        try {
            // Try with timeout
            const result = await withMCPTimeout(fn(), fullConfig.defaultToolTimeout, `${operationName} (attempt ${attempt + 1})`);
            return result;
        }
        catch (error) {
            lastError = error;
            // Don't retry on non-retryable errors
            if (error instanceof Error) {
                if (error.message.includes('Authentication') ||
                    error.message.includes('Permission') ||
                    error.message.includes('Not found')) {
                    throw error; // Don't retry auth/permission errors
                }
            }
            // If we have retries left, wait and try again
            if (attempt < fullConfig.apiMaxRetries) {
                console.log(`⚠️ ${operationName} failed, retrying in ${fullConfig.apiRetryDelay / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, fullConfig.apiRetryDelay));
            }
        }
    }
    // All retries exhausted
    throw lastError || new Error(`${operationName} failed after ${fullConfig.apiMaxRetries} retries`);
}
/**
 * Quick health check with timeout
 */
async function quickHealthCheck(checkFn, timeoutMs = 2000) {
    try {
        return await withMCPTimeout(checkFn(), timeoutMs, 'Health check');
    }
    catch (error) {
        // Health check failed or timed out
        return false;
    }
}
//# sourceMappingURL=mcp-timeout-config.js.map