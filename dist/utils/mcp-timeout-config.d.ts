/**
 * MCP Server Timeout Configuration
 *
 * Provides fast, reliable timeout settings for MCP server operations
 * to prevent Claude from timing out during API calls.
 */
export interface MCPTimeoutConfig {
    serverInitTimeout: number;
    defaultToolTimeout: number;
    queryToolTimeout: number;
    pullToolTimeout: number;
    pushToolTimeout: number;
    debugToolTimeout: number;
    scriptToolTimeout: number;
    apiCallTimeout: number;
    apiRetryDelay: number;
    apiMaxRetries: number;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    maxResponseSize: number;
    chunkDelay: number;
}
/**
 * Get MCP timeout configuration based on environment
 */
export declare function getMCPTimeoutConfig(): MCPTimeoutConfig;
/**
 * Wrap a promise with timeout protection
 */
export declare function withMCPTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName?: string): Promise<T>;
/**
 * Execute with retry logic and timeout
 */
export declare function withMCPRetry<T>(fn: () => Promise<T>, config?: Partial<MCPTimeoutConfig>, operationName?: string): Promise<T>;
/**
 * Quick health check with timeout
 */
export declare function quickHealthCheck(checkFn: () => Promise<boolean>, timeoutMs?: number): Promise<boolean>;
//# sourceMappingURL=mcp-timeout-config.d.ts.map