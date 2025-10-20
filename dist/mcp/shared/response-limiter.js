"use strict";
/**
 * MCP Response Limiter
 * Prevents oversized responses that cause timeouts in Claude Code
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResponseLimiter = void 0;
class ResponseLimiter {
    /**
     * Limit response size to prevent timeouts
     */
    static limitResponse(data) {
        const originalString = JSON.stringify(data);
        const originalSize = originalString.length;
        // If response is small enough, return as-is
        if (originalSize <= this.MAX_RESPONSE_SIZE) {
            return { limited: data, wasLimited: false };
        }
        // Response too large - need to limit it
        const limited = this.limitObject(data);
        return {
            limited,
            wasLimited: true,
            originalSize
        };
    }
    /**
     * Recursively limit object size
     */
    static limitObject(obj, depth = 0) {
        // Don't go too deep
        if (depth > 5) {
            return '[DEPTH_LIMITED]';
        }
        // Handle null/undefined
        if (obj === null || obj === undefined) {
            return obj;
        }
        // Handle primitives
        if (typeof obj !== 'object') {
            // Limit string length - 10KB per string field is reasonable
            if (typeof obj === 'string' && obj.length > 10000) {
                return obj.substring(0, 10000) + '... [TRUNCATED]';
            }
            return obj;
        }
        // Handle arrays
        if (Array.isArray(obj)) {
            if (obj.length > this.MAX_ARRAY_ITEMS) {
                return [
                    ...obj.slice(0, this.MAX_ARRAY_ITEMS).map(item => this.limitObject(item, depth + 1)),
                    `[... ${obj.length - this.MAX_ARRAY_ITEMS} more items]`
                ];
            }
            return obj.map(item => this.limitObject(item, depth + 1));
        }
        // Handle objects
        const limited = {};
        const keys = Object.keys(obj);
        // Limit number of keys
        const maxKeys = 50;
        const keysToProcess = keys.slice(0, maxKeys);
        for (const key of keysToProcess) {
            limited[key] = this.limitObject(obj[key], depth + 1);
        }
        if (keys.length > maxKeys) {
            limited._truncated = `${keys.length - maxKeys} more properties omitted`;
        }
        return limited;
    }
    /**
     * Create a summary response when data is too large
     */
    static createSummaryResponse(data, operation) {
        const originalSize = JSON.stringify(data).length;
        const estimatedTokens = Math.ceil(originalSize / 4);
        return {
            content: [{
                    type: 'text',
                    text: `⚠️ Response too large (${estimatedTokens} tokens, ${originalSize} bytes)

Operation: ${operation}
Status: Success (data limited to prevent timeout)

Summary:
- Original size: ${(originalSize / 1024 / 1024).toFixed(2)}MB
- Token estimate: ${estimatedTokens}
- Response limit: ${(this.MAX_RESPONSE_SIZE / 1024).toFixed(0)}KB

🎯 Immediate Solution:
Run \`/compact\` in Claude Code to clear context and prevent timeouts!

💡 Tips to reduce response size:
1. Use specific field queries instead of '*'
2. Add pagination with smaller limits
3. Filter results more specifically
4. Use count operations instead of full data retrieval

📝 Advanced Config:
- MCP_MAX_RESPONSE_SIZE (default: 500000 bytes)
- MCP_MAX_ARRAY_ITEMS (default: 500 items)`
                }],
            _meta: {
                limited: true,
                originalSize,
                tokenEstimate: estimatedTokens
            }
        };
    }
}
exports.ResponseLimiter = ResponseLimiter;
// Configurable via environment variable, default to 500KB (reasonable for widgets/flows)
ResponseLimiter.MAX_RESPONSE_SIZE = parseInt(process.env.MCP_MAX_RESPONSE_SIZE || '500000'); // 500KB default
ResponseLimiter.MAX_ARRAY_ITEMS = parseInt(process.env.MCP_MAX_ARRAY_ITEMS || '500'); // 500 items default
ResponseLimiter.MAX_TOKEN_ESTIMATE = 200000; // Claude's actual 200k context window
//# sourceMappingURL=response-limiter.js.map