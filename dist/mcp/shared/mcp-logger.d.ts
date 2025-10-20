/**
 * Enhanced MCP Logger with Token Tracking and Progress Reporting
 * Sends logs to stderr so they appear in Claude Code console
 */
interface TokenUsage {
    input: number;
    output: number;
    total: number;
}
export declare class MCPLogger {
    private name;
    private tokenUsage;
    private startTime;
    private lastProgressTime;
    private progressInterval;
    constructor(name: string);
    /**
     * Log to stderr with proper formatting
     */
    private log;
    /**
     * Start progress indicator for long-running operations
     */
    private startProgressIndicator;
    /**
     * Stop progress indicator
     */
    stopProgress(): void;
    /**
     * Log info message
     */
    info(message: string, data?: any): void;
    /**
     * Log warning message
     */
    warn(message: string, data?: any): void;
    /**
     * Log error message
     */
    error(message: string, error?: any): void;
    /**
     * Log operation error - ensures progress indicator is stopped
     */
    operationError(operation: string, error: any): void;
    /**
     * Log debug message
     */
    debug(message: string, data?: any): void;
    /**
     * Log progress update
     */
    progress(message: string): void;
    /**
     * Track API call
     */
    trackAPICall(operation: string, table?: string, recordCount?: number): void;
    /**
     * Add token usage
     */
    addTokens(input: number, output: number): void;
    /**
     * Log operation start
     */
    operationStart(operation: string, params?: any): void;
    /**
     * Log operation complete
     */
    operationComplete(operation: string, result?: any): void;
    /**
     * Get token usage
     */
    getTokenUsage(): TokenUsage;
    /**
     * Add token usage to MCP response
     * Helper method to append token usage to tool response via _meta field
     */
    addTokenUsageToResponse(result: any): any;
    /**
     * Reset token usage
     */
    resetTokens(): void;
}
export declare function getGlobalLogger(name?: string): MCPLogger;
/**
 * Log formatter for consistent output
 */
export declare function formatLogMessage(level: string, message: string, data?: any): string;
export {};
//# sourceMappingURL=mcp-logger.d.ts.map