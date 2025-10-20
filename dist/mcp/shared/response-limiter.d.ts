/**
 * MCP Response Limiter
 * Prevents oversized responses that cause timeouts in Claude Code
 */
export declare class ResponseLimiter {
    private static readonly MAX_RESPONSE_SIZE;
    private static readonly MAX_ARRAY_ITEMS;
    private static readonly MAX_TOKEN_ESTIMATE;
    /**
     * Limit response size to prevent timeouts
     */
    static limitResponse(data: any): {
        limited: any;
        wasLimited: boolean;
        originalSize?: number;
    };
    /**
     * Recursively limit object size
     */
    private static limitObject;
    /**
     * Create a summary response when data is too large
     */
    static createSummaryResponse(data: any, operation: string): any;
}
//# sourceMappingURL=response-limiter.d.ts.map