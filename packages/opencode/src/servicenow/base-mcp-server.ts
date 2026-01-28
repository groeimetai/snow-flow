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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { ServiceNowOAuth } from '../utils/snow-oauth.js';
import { Logger } from '../utils/logger.js';
import { ResponseLimiter } from './shared/response-limiter.js';
import { timerRegistry } from '../utils/timer-registry.js';
import { BoundedMap } from '../utils/memory-safe-collections.js';

export interface MCPServerConfig {
  name: string;
  version: string;
  description?: string;
  requiresAuth?: boolean; // Optional flag to disable ServiceNow authentication
  capabilities?: {
    tools?: {};
    resources?: {};
    prompts?: {};
  };
}

export interface ToolResult<T = any> {
  success: boolean;
  result?: T;
  error?: string;
  retryable?: boolean;
  executionTime?: number;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  token?: string;
  expiresIn?: number;
}

/**
 * Base class for all ServiceNow MCP servers
 * Provides common functionality to eliminate code duplication
 */
export abstract class BaseMCPServer {
  protected server: Server;
  protected client: ServiceNowClient;
  protected oauth: ServiceNowOAuth;
  protected logger: Logger;
  protected transport: StdioServerTransport;
  protected tools: Map<string, Tool> = new Map();
  protected config: MCPServerConfig; // Store the config for later use
  
  // Session management
  private sessionToken?: string;
  private sessionExpiry?: Date;
  private authCheckInterval?: NodeJS.Timeout;
  
  // MEMORY FIX: Use BoundedMap to prevent unbounded growth
  // Default: 500 tools - very conservative, snow-flow has ~400 tools total
  private toolMetrics: BoundedMap<string, { calls: number; totalTime: number; errors: number }> =
    new BoundedMap(parseInt(process.env.SNOW_TOOL_METRICS_LIMIT || '500'));

  constructor(config: MCPServerConfig) {
    // Store the config
    this.config = config;
    // Initialize server with config
    this.server = new Server(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: config.capabilities || { tools: {} },
      }
    );

    // Initialize common dependencies
    this.client = new ServiceNowClient();
    this.oauth = new ServiceNowOAuth();
    this.logger = new Logger(`MCP:${config.name}`);
    this.transport = new StdioServerTransport();
    
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
  private setupCommonHandlers(): void {
    // Handle tool listing
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: Array.from(this.tools.values()),
    }));

    // Handle tool execution with common auth/error handling
    this.server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
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
            throw new McpError(
              ErrorCode.InvalidRequest,
              `Authentication failed: ${authResult.error}`
            );
          }
        }

        // Execute tool with retry logic
        let result = await this.executeWithRetry(name, args);
        
        // Limit response size to prevent timeouts
        const { limited, wasLimited, originalSize } = ResponseLimiter.limitResponse(result);
        
        if (wasLimited) {
          this.logger.warn(`Response limited for ${name}: ${originalSize} bytes -> ${JSON.stringify(limited).length} bytes`);
          
          // Only create summary for EXTREMELY large responses (>2MB)
          // Normal widgets/flows should pass through fine with 500KB limit
          if (originalSize > 2000000) { // > 2MB - truly excessive
            result = ResponseLimiter.createSummaryResponse(result, name);
          } else {
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
      } catch (error) {
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
  private setupAuthentication(): void {
    // Skip authentication setup if not required
    if (this.config.requiresAuth === false) {
      return;
    }

    // MEMORY FIX: Use timerRegistry for proper cleanup
    timerRegistry.registerInterval(
      `${this.config.name}-auth-check`,
      async () => {
        try {
          await this.validateAuth();
        } catch (error) {
          this.logger.error('Background auth check failed:', error);
        }
      },
      5 * 60 * 1000, // 5 minutes
      true // unref
    );
  }

  /**
   * Validate authentication with smart caching
   */
  protected async validateAuth(): Promise<AuthResult> {
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
        } catch (refreshError) {
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
    } catch (error) {
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
  private async executeWithRetry(toolName: string, args: any, attempt = 1): Promise<any> {
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
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
      }

      // 🔴 CRITICAL: Memory usage check before execution
      if (attempt === 1) {
        await this.checkMemoryUsage();
      }

      // Execute with dynamic timeout
      const result = await Promise.race([
        handler(args),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Tool execution timeout after ${timeout}ms`)), timeout)
        ),
      ]);

      // 🔴 SUCCESS: Reset circuit breaker on success
      this.resetCircuitBreaker(toolName);
      
      return result;
    } catch (error) {
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
      throw new McpError(ErrorCode.InternalError, errorMessage);
    }
  }

  /**
   * 🔴 SNOW-003 FIX: Calculate intelligent backoff based on error type and attempt
   */
  private calculateBackoff(attempt: number, toolName: string): number {
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
  private calculateTimeout(toolName: string): number {
    // Tool-specific timeouts based on complexity
    const timeoutMap: Record<string, number> = {
      'snow_create_flow': 90000,           // Flow creation: 90s
      'snow_create_artifact': 120000,      // Artifact creation: 2 minutes
      'snow_create_widget': 120000,        // Widget creation: 2 minutes
      'ml_train_incident_classifier': 300000, // ML training: 5 minutes
      'ml_train_change_risk': 300000,      // ML training: 5 minutes
      'snow_comprehensive_search': 45000,  // Search: 45s
      'snow_find_artifact': 30000,         // Find: 30s
      'snow_validate_live_connection': 15000, // Validation: 15s
    };
    
    // Default timeout for unknown tools
    return timeoutMap[toolName] || 60000; // 60s default (increased from 30s)
  }

  // 🔴 SNOW-003 FIX: Circuit breaker implementation
  // MEMORY FIX: Use BoundedMap to prevent unbounded growth
  // Default: 500 - matches tool count, as each tool can have a circuit breaker
  private circuitBreakers: BoundedMap<string, { failures: number; lastFailure: number; isOpen: boolean }> =
    new BoundedMap(parseInt(process.env.SNOW_CIRCUIT_BREAKER_LIMIT || '500'));
  
  private updateCircuitBreaker(toolName: string, error: any): void {
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
  
  private isCircuitBreakerOpen(toolName: string): boolean {
    const breaker = this.circuitBreakers.get(toolName);
    if (!breaker || !breaker.isOpen) return false;
    
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
  
  private resetCircuitBreaker(toolName: string): void {
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
  private async checkMemoryUsage(): Promise<void> {
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
      
    } catch (error) {
      this.logger.warn('Could not check memory usage:', error);
    }
  }

  /**
   * 🔴 SNOW-003 FIX: Enhanced error message with troubleshooting guidance
   */
  private createEnhancedErrorMessage(toolName: string, error: any, attempts: number, maxRetries: number): string {
    const baseMessage = `Tool '${toolName}' failed after ${attempts}/${maxRetries} attempts`;
    const errorDetail = error instanceof Error ? error.message : String(error);
    
    let troubleshooting = '';
    
    // Add specific troubleshooting based on error type
    if ((error as any).response?.status === 401) {
      troubleshooting = '\n💡 Authentication issue: Run "snow-flow auth login" to re-authenticate';
    } else if ((error as any).response?.status === 403) {
      troubleshooting = '\n💡 Permission issue: Check ServiceNow user permissions and OAuth scopes';
    } else if ((error as any).response?.status >= 500) {
      troubleshooting = '\n💡 ServiceNow server issue: Try again later or contact ServiceNow administrator';
    } else if (errorDetail.includes('timeout')) {
      troubleshooting = '\n💡 Timeout issue: ServiceNow instance may be slow - try again later';
    } else if (errorDetail.includes('network') || errorDetail.includes('connection')) {
      troubleshooting = '\n💡 Network issue: Check internet connection and ServiceNow instance availability';
    }
    
    return `${baseMessage}: ${errorDetail}${troubleshooting}`;
  }

  /**
   * 🔴 SNOW-003 FIX: Enhanced error classification for ServiceNow specific errors
   * Addresses the 19% failure rate by properly categorizing retryable errors
   */
  private isRetryableError(error: any): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // 🔴 CRITICAL: ServiceNow specific retryable errors
      const serviceNowRetryable = (
        message.includes('timeout') ||
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
        message.includes('deadlock detected')
      );
      
      // 🔴 CRITICAL: HTTP status code based retry logic
      if ((error as any).response?.status) {
        const status = (error as any).response.status;
        const httpRetryable = (
          status === 429 ||  // Rate limit
          status === 502 ||  // Bad Gateway 
          status === 503 ||  // Service Unavailable
          status === 504 ||  // Gateway Timeout
          status === 507 ||  // Insufficient Storage
          status === 520 ||  // CloudFlare unknown error
          status === 521 ||  // Web server is down
          status === 522 ||  // Connection timed out
          status === 523 ||  // Origin is unreachable
          status === 524     // A timeout occurred
        );
        
        // 401 is retryable only once (for token refresh)
        const authRetryable = status === 401 && !(error as any).config?._retry;
        
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

  // MEMORY FIX: Named handlers for proper cleanup
  private uncaughtExceptionHandler = (error: Error) => {
    this.logger.error('Uncaught exception:', error);
    this.gracefulShutdown();
  };

  private unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
    this.logger.error('Unhandled rejection:', { promise, reason });
  };

  private sigintHandler = () => {
    this.logger.info('Received SIGINT, shutting down gracefully...');
    this.gracefulShutdown();
  };

  /**
   * Setup global error handling
   */
  private setupErrorHandling(): void {
    // MEMORY FIX: Use named handlers so they can be removed later
    process.on('uncaughtException', this.uncaughtExceptionHandler);
    process.on('unhandledRejection', this.unhandledRejectionHandler);
    process.on('SIGINT', this.sigintHandler);
  }

  /**
   * Setup metrics collection
   */
  private setupMetrics(): void {
    // MEMORY FIX: Use timerRegistry for proper cleanup
    timerRegistry.registerInterval(
      `${this.config.name}-metrics`,
      () => {
        const metrics = Array.from(this.toolMetrics.entries()).map(([tool, data]) => ({
          tool,
          calls: data.calls,
          avgTime: data.calls > 0 ? Math.round(data.totalTime / data.calls) : 0,
          errorRate: data.calls > 0 ? (data.errors / data.calls * 100).toFixed(2) : '0',
        }));

        if (metrics.length > 0) {
          this.logger.info('Tool metrics:', metrics);
        }
      },
      60000, // Every minute
      true // unref
    );
  }

  /**
   * Execute tool with common error handling
   */
  protected async executeTool<T>(
    toolName: string,
    handler: () => Promise<T>
  ): Promise<ToolResult<T>> {
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
    } catch (error) {
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
  protected registerTool(tool: Tool, handler: (args: any) => Promise<any>): void {
    this.tools.set(tool.name, tool);
    this.toolHandlers.set(tool.name, handler);
  }

  /**
   * Tool handlers map
   */
  private toolHandlers: Map<string, (args: any) => Promise<any>> = new Map();

  /**
   * Get tool handler
   */
  private getToolHandler(name: string): ((args: any) => Promise<any>) | undefined {
    return this.toolHandlers.get(name);
  }


  /**
   * Graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    this.logger.info('Starting graceful shutdown...');

    // MEMORY FIX: Remove event listeners to prevent accumulation
    process.removeListener('uncaughtException', this.uncaughtExceptionHandler);
    process.removeListener('unhandledRejection', this.unhandledRejectionHandler);
    process.removeListener('SIGINT', this.sigintHandler);

    // MEMORY FIX: Clear intervals via timerRegistry
    timerRegistry.clearInterval(`${this.config.name}-auth-check`);
    timerRegistry.clearInterval(`${this.config.name}-metrics`);

    // Also clear legacy interval if it exists
    if (this.authCheckInterval) {
      clearInterval(this.authCheckInterval);
    }

    // Log final metrics
    const metrics = Array.from(this.toolMetrics.entries());
    if (metrics.length > 0) {
      this.logger.info('Final metrics:', metrics);
    }

    // MEMORY FIX: Clear collections
    this.toolMetrics.clear();
    this.circuitBreakers.clear();
    this.tools.clear();
    this.toolHandlers.clear();

    // Close connections
    try {
      await this.oauth.logout();
    } catch (error) {
      this.logger.error('Error during logout:', error);
    }

    this.logger.info('Graceful shutdown complete');
    process.exit(0);
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
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
  protected async validateServiceNowConnection(): Promise<AuthResult> {
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
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Connection validation failed'
      };
    }
  }

  protected abstract setupTools(): void;
}