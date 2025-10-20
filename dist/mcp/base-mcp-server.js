"use strict";
/**
 * Base MCP Server Implementation
 *
 * Solves DRY violations by providing common functionality for all MCP servers:
 * - Unified authentication handling
 * - Consistent error handling
 * - Session management
 * - Logging and monitoring
 * - Retry logic with exponential backoff
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const servicenow_client_js_1 = require("../utils/servicenow-client.js");
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const logger_js_1 = require("../utils/logger.js");
const response_limiter_js_1 = require("./shared/response-limiter.js");
/**
 * Base class for all ServiceNow MCP servers
 * Provides common functionality to eliminate code duplication
 */
class BaseMCPServer {
    constructor(config) {
        this.tools = new Map();
        // Performance tracking
        this.toolMetrics = new Map();
        // 🔴 SNOW-003 FIX: Circuit breaker implementation
        this.circuitBreakers = new Map();
        /**
         * Tool handlers map
         */
        this.toolHandlers = new Map();
        // Store the config
        this.config = config;
        // Initialize server with config
        this.server = new index_js_1.Server({
            name: config.name,
            version: config.version,
        }, {
            capabilities: config.capabilities || { tools: {} },
        });
        // Initialize common dependencies
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        this.logger = new logger_js_1.Logger(`MCP:${config.name}`);
        this.transport = new stdio_js_1.StdioServerTransport();
        // Setup common functionality
        this.setupCommonHandlers();
        this.setupAuthentication();
        this.setupErrorHandling();
        this.setupMetrics();
        // Let child classes define their specific tools
        this.setupTools();
    }
    /**
     * Setup common request handlers
     */
    setupCommonHandlers() {
        // Handle tool listing
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => ({
            tools: Array.from(this.tools.values()),
        }));
        // Handle tool execution with common auth/error handling
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request, extra) => {
            const { name, arguments: args } = request.params;
            // Track metrics
            const startTime = Date.now();
            const metrics = this.toolMetrics.get(name) || { calls: 0, totalTime: 0, errors: 0 };
            metrics.calls++;
            try {
                // Validate authentication first (skip if not required)
                if (this.config.requiresAuth !== false) {
                    const authResult = await this.validateAuth();
                    if (!authResult.success) {
                        throw new types_js_1.McpError(types_js_1.ErrorCode.InvalidRequest, `Authentication failed: ${authResult.error}`);
                    }
                }
                // Execute tool with retry logic
                let result = await this.executeWithRetry(name, args);
                // Limit response size to prevent timeouts
                const { limited, wasLimited, originalSize } = response_limiter_js_1.ResponseLimiter.limitResponse(result);
                if (wasLimited) {
                    this.logger.warn(`Response limited for ${name}: ${originalSize} bytes -> ${JSON.stringify(limited).length} bytes`);
                    // Only create summary for EXTREMELY large responses (>2MB)
                    // Normal widgets/flows should pass through fine with 500KB limit
                    if (originalSize > 2000000) { // > 2MB - truly excessive
                        result = response_limiter_js_1.ResponseLimiter.createSummaryResponse(result, name);
                    }
                    else {
                        result = limited;
                    }
                }
                // Add token tracking metadata
                const responseSize = JSON.stringify(result).length;
                const estimatedTokens = Math.ceil(responseSize / 4);
                if (result && typeof result === 'object') {
                    result._meta = {
                        ...result._meta,
                        tokenCount: estimatedTokens,
                        responseSize,
                        wasLimited
                    };
                }
                // Update metrics
                metrics.totalTime += Date.now() - startTime;
                this.toolMetrics.set(name, metrics);
                return result;
            }
            catch (error) {
                // Update error metrics
                metrics.errors++;
                metrics.totalTime += Date.now() - startTime;
                this.toolMetrics.set(name, metrics);
                throw error;
            }
        });
    }
    /**
     * Setup authentication with automatic token refresh
     */
    setupAuthentication() {
        // Skip authentication setup if not required
        if (this.config.requiresAuth === false) {
            return;
        }
        // Check auth every 5 minutes
        this.authCheckInterval = setInterval(async () => {
            try {
                await this.validateAuth();
            }
            catch (error) {
                this.logger.error('Background auth check failed:', error);
            }
        }, 5 * 60 * 1000);
    }
    /**
     * Validate authentication with smart caching
     */
    async validateAuth() {
        try {
            // Check if we have a valid session
            if (this.sessionToken && this.sessionExpiry && this.sessionExpiry > new Date()) {
                return { success: true, token: this.sessionToken };
            }
            // Validate connection
            const connectionResult = await this.validateServiceNowConnection();
            if (!connectionResult.success) {
                return {
                    success: false,
                    error: connectionResult.error || 'Authentication validation failed'
                };
            }
            // Get fresh token
            const isAuthenticated = await this.oauth.isAuthenticated();
            if (!isAuthenticated) {
                // Try to refresh
                try {
                    await this.oauth.refreshAccessToken();
                }
                catch (refreshError) {
                    return {
                        success: false,
                        error: 'OAuth authentication required. Run "snow-flow auth login" to authenticate.',
                    };
                }
            }
            // Cache session info
            const tokenInfo = await this.oauth.loadTokens();
            this.sessionToken = tokenInfo?.access_token;
            this.sessionExpiry = new Date(Date.now() + (tokenInfo?.expires_in || 3600) * 1000);
            return {
                success: true,
                token: this.sessionToken,
                expiresIn: tokenInfo.expires_in,
            };
        }
        catch (error) {
            this.logger.error('Authentication validation failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown authentication error',
            };
        }
    }
    /**
     * 🔴 SNOW-003 FIX: Enhanced retry logic with intelligent backoff and circuit breaker
     * Addresses the 19% failure rate with better retry strategies and failure prevention
     */
    async executeWithRetry(toolName, args, attempt = 1) {
        // 🔴 CRITICAL: Increased retries from 3 to 6 for better resilience
        const maxRetries = 6;
        // 🔴 CRITICAL: Intelligent backoff based on error type
        const backoffMs = this.calculateBackoff(attempt, toolName);
        // 🔴 CRITICAL: Dynamic timeout based on tool complexity
        const timeout = this.calculateTimeout(toolName);
        try {
            // Get tool handler
            const handler = this.getToolHandler(toolName);
            if (!handler) {
                throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
            }
            // 🔴 CRITICAL: Memory usage check before execution
            if (attempt === 1) {
                await this.checkMemoryUsage();
            }
            // Execute with dynamic timeout
            const result = await Promise.race([
                handler(args),
                new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)),
            ]);
            // 🔴 SUCCESS: Reset circuit breaker on success
            this.resetCircuitBreaker(toolName);
            return result;
        }
        catch (error) {
            this.logger.error(`🔴 Tool ${toolName} execution failed (attempt ${attempt}/${maxRetries}):`, error);
            // 🔴 CRITICAL: Update circuit breaker
            this.updateCircuitBreaker(toolName, error);
            // Check if retryable and within limits
            if (attempt < maxRetries && this.isRetryableError(error) && !this.isCircuitBreakerOpen(toolName)) {
                this.logger.info(`🔄 Retrying ${toolName} after ${backoffMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
                return this.executeWithRetry(toolName, args, attempt + 1);
            }
            // 🔴 FINAL FAILURE: Enhanced error reporting
            const errorMessage = this.createEnhancedErrorMessage(toolName, error, attempt, maxRetries);
            throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, errorMessage);
        }
    }
    /**
     * 🔴 SNOW-003 FIX: Calculate intelligent backoff based on error type and attempt
     */
    calculateBackoff(attempt, toolName) {
        // Base exponential backoff: 1s, 2s, 4s, 8s, 16s, 32s
        const baseBackoff = 1000 * Math.pow(2, attempt - 1);
        // Add jitter to prevent thundering herd (±25%)
        const jitter = baseBackoff * 0.25 * (Math.random() - 0.5);
        // Cap maximum backoff at 30 seconds
        const maxBackoff = 30000;
        return Math.min(baseBackoff + jitter, maxBackoff);
    }
    /**
     * 🔴 SNOW-003 FIX: Calculate dynamic timeout based on tool complexity
     */
    calculateTimeout(toolName) {
        // Tool-specific timeouts based on complexity
        const timeoutMap = {
            'snow_create_flow': 90000, // Flow creation: 90s
            'snow_deploy': 120000, // Deployment: 2 minutes
            'snow_deploy_widget': 180000, // Widget deployment: 3 minutes (complex ML widgets)
            'snow_create_widget': 120000, // Widget creation: 2 minutes
            'ml_train_incident_classifier': 300000, // ML training: 5 minutes
            'ml_train_change_risk': 300000, // ML training: 5 minutes
            'snow_comprehensive_search': 45000, // Search: 45s
            'snow_find_artifact': 30000, // Find: 30s
            'snow_validate_live_connection': 15000, // Validation: 15s
        };
        // Default timeout for unknown tools
        return timeoutMap[toolName] || 60000; // 60s default (increased from 30s)
    }
    updateCircuitBreaker(toolName, error) {
        const breaker = this.circuitBreakers.get(toolName) || { failures: 0, lastFailure: 0, isOpen: false };
        breaker.failures++;
        breaker.lastFailure = Date.now();
        // Open circuit breaker after 5 failures within 5 minutes
        if (breaker.failures >= 5 && (Date.now() - breaker.lastFailure) < 300000) {
            breaker.isOpen = true;
            this.logger.warn(`🚨 Circuit breaker opened for ${toolName} due to repeated failures`);
        }
        this.circuitBreakers.set(toolName, breaker);
    }
    isCircuitBreakerOpen(toolName) {
        const breaker = this.circuitBreakers.get(toolName);
        if (!breaker || !breaker.isOpen)
            return false;
        // Auto-reset circuit breaker after 10 minutes
        if (Date.now() - breaker.lastFailure > 600000) {
            breaker.isOpen = false;
            breaker.failures = 0;
            this.circuitBreakers.set(toolName, breaker);
            this.logger.info(`✅ Circuit breaker reset for ${toolName}`);
            return false;
        }
        return true;
    }
    resetCircuitBreaker(toolName) {
        const breaker = this.circuitBreakers.get(toolName);
        if (breaker) {
            breaker.failures = 0;
            breaker.isOpen = false;
            this.circuitBreakers.set(toolName, breaker);
        }
    }
    /**
     * 🔴 SNOW-003 FIX: Memory usage monitoring to prevent memory exhaustion failures
     */
    async checkMemoryUsage() {
        try {
            const memUsage = process.memoryUsage();
            const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
            // Log memory usage if high (>200MB)
            if (heapUsedMB > 200) {
                this.logger.warn(`⚠️ High memory usage: ${heapUsedMB}MB heap used, ${heapTotalMB}MB total`);
            }
            // Trigger garbage collection if memory usage is very high (>500MB)
            if (heapUsedMB > 500 && global.gc) {
                this.logger.info('🧹 Triggering garbage collection due to high memory usage');
                global.gc();
            }
            // Fail fast if memory usage is critical (>800MB)
            if (heapUsedMB > 800) {
                throw new Error(`Critical memory usage: ${heapUsedMB}MB. Operation aborted to prevent system instability.`);
            }
        }
        catch (error) {
            this.logger.warn('Could not check memory usage:', error);
        }
    }
    /**
     * 🔴 SNOW-003 FIX: Enhanced error message with troubleshooting guidance
     */
    createEnhancedErrorMessage(toolName, error, attempts, maxRetries) {
        const baseMessage = `Tool '${toolName}' failed after ${attempts}/${maxRetries} attempts`;
        const errorDetail = error instanceof Error ? error.message : String(error);
        let troubleshooting = '';
        // Add specific troubleshooting based on error type
        if (error.response?.status === 401) {
            troubleshooting = '\n💡 Authentication issue: Run "snow-flow auth login" to re-authenticate';
        }
        else if (error.response?.status === 403) {
            troubleshooting = '\n💡 Permission issue: Check ServiceNow user permissions and OAuth scopes';
        }
        else if (error.response?.status >= 500) {
            troubleshooting = '\n💡 ServiceNow server issue: Try again later or contact ServiceNow administrator';
        }
        else if (errorDetail.includes('timeout')) {
            troubleshooting = '\n💡 Timeout issue: ServiceNow instance may be slow - try again later';
        }
        else if (errorDetail.includes('network') || errorDetail.includes('connection')) {
            troubleshooting = '\n💡 Network issue: Check internet connection and ServiceNow instance availability';
        }
        return `${baseMessage}: ${errorDetail}${troubleshooting}`;
    }
    /**
     * 🔴 SNOW-003 FIX: Enhanced error classification for ServiceNow specific errors
     * Addresses the 19% failure rate by properly categorizing retryable errors
     */
    isRetryableError(error) {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            // 🔴 CRITICAL: ServiceNow specific retryable errors
            const serviceNowRetryable = (message.includes('timeout') ||
                message.includes('econnreset') ||
                message.includes('socket hang up') ||
                message.includes('enotfound') ||
                message.includes('rate limit') ||
                message.includes('service unavailable') ||
                message.includes('bad gateway') ||
                message.includes('gateway timeout') ||
                message.includes('connection refused') ||
                message.includes('network error') ||
                message.includes('dns lookup failed') ||
                message.includes('connect etimedout') ||
                message.includes('index not available') ||
                message.includes('search index updating') ||
                message.includes('temporary failure') ||
                message.includes('server is busy') ||
                message.includes('database lock') ||
                message.includes('deadlock detected'));
            // 🔴 CRITICAL: HTTP status code based retry logic
            if (error.response?.status) {
                const status = error.response.status;
                const httpRetryable = (status === 429 || // Rate limit
                    status === 502 || // Bad Gateway 
                    status === 503 || // Service Unavailable
                    status === 504 || // Gateway Timeout
                    status === 507 || // Insufficient Storage
                    status === 520 || // CloudFlare unknown error
                    status === 521 || // Web server is down
                    status === 522 || // Connection timed out
                    status === 523 || // Origin is unreachable
                    status === 524 // A timeout occurred
                );
                // 401 is retryable only once (for token refresh)
                const authRetryable = status === 401 && !error.config?._retry;
                return httpRetryable || authRetryable;
            }
            return serviceNowRetryable;
        }
        // Handle specific error types
        if (error.code) {
            const retryableCodes = [
                'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT',
                'ESOCKETTIMEDOUT', 'EHOSTUNREACH', 'EPIPE', 'EAI_AGAIN'
            ];
            return retryableCodes.includes(error.code);
        }
        return false;
    }
    /**
     * Setup global error handling
     */
    setupErrorHandling() {
        process.on('uncaughtException', (error) => {
            this.logger.error('Uncaught exception:', error);
            this.gracefulShutdown();
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.logger.error('Unhandled rejection:', { promise, reason });
        });
        process.on('SIGINT', () => {
            this.logger.info('Received SIGINT, shutting down gracefully...');
            this.gracefulShutdown();
        });
    }
    /**
     * Setup metrics collection
     */
    setupMetrics() {
        // Log metrics every minute
        setInterval(() => {
            const metrics = Array.from(this.toolMetrics.entries()).map(([tool, data]) => ({
                tool,
                calls: data.calls,
                avgTime: data.calls > 0 ? Math.round(data.totalTime / data.calls) : 0,
                errorRate: data.calls > 0 ? (data.errors / data.calls * 100).toFixed(2) : '0',
            }));
            if (metrics.length > 0) {
                this.logger.info('Tool metrics:', metrics);
            }
        }, 60000);
    }
    /**
     * Execute tool with common error handling
     */
    async executeTool(toolName, handler) {
        const startTime = Date.now();
        try {
            // Validate auth before execution
            const authResult = await this.validateAuth();
            if (!authResult.success) {
                return {
                    success: false,
                    error: authResult.error,
                    retryable: true,
                };
            }
            // Execute the tool logic
            const result = await handler();
            // Log success
            this.logger.debug(`Tool ${toolName} executed successfully in ${Date.now() - startTime}ms`);
            return {
                success: true,
                result,
                executionTime: Date.now() - startTime,
            };
        }
        catch (error) {
            this.logger.error(`Tool ${toolName} failed:`, error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                retryable: this.isRetryableError(error),
                executionTime: Date.now() - startTime,
            };
        }
    }
    /**
     * Register a tool
     */
    registerTool(tool, handler) {
        this.tools.set(tool.name, tool);
        this.toolHandlers.set(tool.name, handler);
    }
    /**
     * Get tool handler
     */
    getToolHandler(name) {
        return this.toolHandlers.get(name);
    }
    /**
     * Graceful shutdown
     */
    async gracefulShutdown() {
        this.logger.info('Starting graceful shutdown...');
        // Clear intervals
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
        // Log final metrics
        const metrics = Array.from(this.toolMetrics.entries());
        if (metrics.length > 0) {
            this.logger.info('Final metrics:', metrics);
        }
        // Close connections
        try {
            await this.oauth.logout();
        }
        catch (error) {
            this.logger.error('Error during logout:', error);
        }
        process.exit(0);
    }
    /**
     * Start the server
     */
    async start() {
        this.logger.info(`Starting ${this.config.name} v${this.config.version}`);
        // Validate initial connection (skip if not required)
        if (this.config.requiresAuth !== false) {
            const authResult = await this.validateAuth();
            if (!authResult.success) {
                this.logger.warn('Starting without authentication - some features may be limited');
            }
        }
        await this.server.connect(this.transport);
        this.logger.info('MCP server started successfully');
    }
    /**
     * Abstract method for child classes to implement their specific tools
     */
    /**
     * Validate ServiceNow connection
     */
    async validateServiceNowConnection() {
        try {
            const isAuthenticated = await this.oauth.isAuthenticated();
            if (!isAuthenticated) {
                return {
                    success: false,
                    error: 'Not authenticated with ServiceNow'
                };
            }
            // Test connection with a simple request
            const response = await this.client.makeRequest({
                method: 'GET',
                url: '/api/now/table/sys_properties',
                params: { sysparm_limit: 1 }
            });
            return {
                success: response.success,
                token: 'valid'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Connection validation failed'
            };
        }
    }
}
exports.BaseMCPServer = BaseMCPServer;
//# sourceMappingURL=base-mcp-server.js.map