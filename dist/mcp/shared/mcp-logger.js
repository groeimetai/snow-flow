"use strict";
/**
 * Enhanced MCP Logger with Token Tracking and Progress Reporting
 * Sends logs to stderr so they appear in Claude Code console
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPLogger = void 0;
exports.getGlobalLogger = getGlobalLogger;
exports.formatLogMessage = formatLogMessage;
class MCPLogger {
    constructor(name) {
        this.tokenUsage = { input: 0, output: 0, total: 0 };
        this.startTime = Date.now();
        this.lastProgressTime = Date.now();
        this.progressInterval = null;
        this.name = name;
        // Don't start progress indicator automatically - only start when needed
    }
    /**
     * Log to stderr with proper formatting
     */
    log(level, message, data) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            service: this.name,
            message,
            data,
            tokens: this.tokenUsage.total,
            duration: Math.round((Date.now() - this.startTime) / 1000)
        };
        // Send to stderr so it appears in console
        console.error(`[${this.name}] ${level}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
        // Also send structured log for potential parsing
        if (process.send) {
            process.send({
                type: 'log',
                data: logEntry
            });
        }
    }
    /**
     * Start progress indicator for long-running operations
     */
    startProgressIndicator() {
        // Send progress every 5 seconds (reduced frequency)
        this.progressInterval = setInterval(() => {
            const duration = Math.round((Date.now() - this.startTime) / 1000);
            // CRITICAL: Stop progress after 60 seconds to prevent infinite loops
            if (duration > 60) {
                console.error(`⚠️ [${this.name}] Operation exceeded maximum time (60s). Stopping progress indicator.`);
                this.stopProgress();
                // Force stop the operation by throwing timeout error
                const timeoutError = new Error(`Operation timeout: exceeded 60 seconds`);
                this.operationError('Operation timeout', timeoutError);
                return;
            }
            if (duration > 3) { // Only show progress after 3+ seconds
                this.progress(`Operation in progress... (${duration}s elapsed, ${this.tokenUsage.total} tokens used)`);
            }
        }, 5000);
    }
    /**
     * Stop progress indicator
     */
    stopProgress() {
        if (this.progressInterval) {
            clearInterval(this.progressInterval);
            this.progressInterval = null;
        }
    }
    /**
     * Log info message
     */
    info(message, data) {
        this.log('INFO', message, data);
    }
    /**
     * Log warning message
     */
    warn(message, data) {
        this.log('WARN', message, data);
    }
    /**
     * Log error message
     */
    error(message, error) {
        const errorData = error instanceof Error ? {
            message: error.message,
            stack: error.stack,
            name: error.name
        } : error;
        this.log('ERROR', message, errorData);
    }
    /**
     * Log operation error - ensures progress indicator is stopped
     */
    operationError(operation, error) {
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        // Always stop progress indicator when operation fails
        this.stopProgress();
        this.error(`❌ Failed: ${operation} (${duration}s)`, error);
    }
    /**
     * Log debug message
     */
    debug(message, data) {
        if (process.env.DEBUG === 'true' || process.env.NODE_ENV === 'development') {
            this.log('DEBUG', message, data);
        }
    }
    /**
     * Log progress update
     */
    progress(message) {
        // Only log progress if enough time has passed
        const now = Date.now();
        if (now - this.lastProgressTime > 1000) {
            this.lastProgressTime = now;
            console.error(`⏳ [${this.name}] ${message}`);
        }
    }
    /**
     * Track API call
     */
    trackAPICall(operation, table, recordCount) {
        const message = `🔄 API Call: ${operation}${table ? ` on ${table}` : ''}${recordCount ? ` (${recordCount} records)` : ''}`;
        this.info(message);
        // NOTE: Removed automatic token estimation as it was inaccurate
        // Real token usage should come from Claude Code's actual measurements
    }
    /**
     * Add token usage
     */
    addTokens(input, output) {
        this.tokenUsage.input += input;
        this.tokenUsage.output += output;
        this.tokenUsage.total = this.tokenUsage.input + this.tokenUsage.output;
        // Only log token usage in debug mode to avoid spam
        if (process.env.MCP_DEBUG === 'true' && this.tokenUsage.total > 0) {
            console.error(`📊 [${this.name}] Tokens used: ${this.tokenUsage.total} (in: ${this.tokenUsage.input}, out: ${this.tokenUsage.output})`);
        }
    }
    /**
     * Log operation start
     */
    operationStart(operation, params) {
        this.startTime = Date.now();
        this.resetTokens(); // Actually reset tokens when starting new operation!
        this.info(`🚀 Starting: ${operation}`, params);
        // Start progress indicator after 3 seconds (only for long operations)
        setTimeout(() => {
            if (!this.progressInterval) {
                this.startProgressIndicator();
            }
        }, 3000);
    }
    /**
     * Log operation complete
     */
    operationComplete(operation, result) {
        const duration = Math.round((Date.now() - this.startTime) / 1000);
        // Always stop progress indicator first
        this.stopProgress();
        this.info(`✅ Completed: ${operation} (${duration}s, ${this.tokenUsage.total} tokens)`, result);
        // Only show token report for operations with actual token usage
        if (this.tokenUsage.total > 0 && duration > 1) {
            console.error(`📊 [${this.name}] ${operation} completed: ${duration}s, ${this.tokenUsage.total} tokens`);
        }
    }
    /**
     * Get token usage
     */
    getTokenUsage() {
        return { ...this.tokenUsage };
    }
    /**
     * Add token usage to MCP response
     * Helper method to append token usage to tool response via _meta field
     */
    addTokenUsageToResponse(result) {
        const tokenUsage = this.getTokenUsage();
        if (tokenUsage.total > 0) {
            // Add token usage to _meta field for Claude Code UI
            if (!result._meta) {
                result._meta = {};
            }
            result._meta.tokenUsage = {
                input: tokenUsage.input,
                output: tokenUsage.output,
                total: tokenUsage.total
            };
            // Token usage is available in _meta.tokenUsage for debugging
            // We no longer automatically add it to response text to avoid pollution
        }
        return result;
    }
    /**
     * Reset token usage
     */
    resetTokens() {
        this.tokenUsage = { input: 0, output: 0, total: 0 };
        console.error(`🔄 [${this.name}] Token counter reset for new operation`);
    }
}
exports.MCPLogger = MCPLogger;
/**
 * Create a singleton logger instance for consistent logging
 */
let globalLogger = null;
function getGlobalLogger(name) {
    if (!globalLogger) {
        globalLogger = new MCPLogger(name || 'MCP-Server');
    }
    return globalLogger;
}
/**
 * Log formatter for consistent output
 */
function formatLogMessage(level, message, data) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const dataStr = data ? ` | ${JSON.stringify(data)}` : '';
    return `[${timestamp}] ${level.padEnd(5)} | ${message}${dataStr}`;
}
//# sourceMappingURL=mcp-logger.js.map