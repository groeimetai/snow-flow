/**
 * Base MCP Server with Agent Integration
 * Provides common functionality for all MCP servers in the agent ecosystem
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { ServiceNowClient } from '../../utils/servicenow-client.js';
import { ServiceNowOAuth } from '../../utils/snow-oauth.js';
import { Logger } from '../../utils/logger.js';
import { AgentContextProvider } from './agent-context-provider.js';
import { MCPMemoryManager, AgentContext } from './mcp-memory-manager.js';
import { MCPResourceManager } from './mcp-resource-manager.js';
export interface MCPToolResult {
    [key: string]: unknown;
    content: Array<{
        type: string;
        text?: string;
        data?: any;
    }>;
    metadata?: {
        agent_id?: string;
        session_id?: string;
        duration_ms?: number;
        artifacts_created?: string[];
    };
    _meta?: {
        [key: string]: unknown;
    };
}
export declare abstract class BaseMCPServer {
    protected server: Server;
    protected client: ServiceNowClient;
    protected oauth: ServiceNowOAuth;
    protected logger: Logger;
    protected contextProvider: AgentContextProvider;
    protected memory: MCPMemoryManager;
    protected resourceManager: MCPResourceManager;
    constructor(name: string, version?: string);
    /**
     * Execute a tool with agent context tracking
     */
    protected executeWithAgentContext<T>(toolName: string, args: any, operation: (context: AgentContext) => Promise<T>): Promise<MCPToolResult>;
    /**
     * MANDATORY authentication and connection validation before ServiceNow operations
     */
    protected validateServiceNowConnection(): Promise<{
        success: boolean;
        error?: string;
    }>;
    /**
     * Check authentication with proper error handling (deprecated - use validateServiceNowConnection)
     */
    protected checkAuthentication(): Promise<boolean>;
    /**
     * Create standard authentication error response with detailed instructions
     */
    protected createAuthenticationError(error?: string): MCPToolResult;
    /**
     * Smart artifact discovery - check for existing artifacts before creating new ones
     */
    protected discoverExistingArtifacts(type: string, name: string, searchTerms?: string[]): Promise<{
        found: boolean;
        artifacts: any[];
        suggestions: string[];
    }>;
    /**
     * Ensure active Update Set for tracking changes
     */
    protected ensureUpdateSet(context: AgentContext, purpose?: string): Promise<string | null>;
    /**
     * Automatically track artifact in Update Set
     */
    protected trackArtifact(sysId: string, type: string, name: string, updateSetId?: string): Promise<void>;
    /**
     * Get ServiceNow table name for artifact type
     */
    protected getTableForType(type: string): string;
    /**
     * Report progress during long operations
     */
    protected reportProgress(context: AgentContext, progress: number, phase: string): Promise<void>;
    /**
     * Store artifact with agent tracking
     */
    protected storeArtifact(context: AgentContext, artifact: {
        sys_id: string;
        type: string;
        name: string;
        description?: string;
        config?: any;
        update_set_id?: string;
    }): Promise<void>;
    /**
     * Notify handoff to another agent
     */
    protected notifyHandoff(context: AgentContext, to_agent: string, artifact_info: {
        type: string;
        sys_id: string;
        next_steps: string[];
    }): Promise<void>;
    /**
     * Request Queen intervention for issues
     */
    protected requestQueenIntervention(context: AgentContext, issue: {
        type: string;
        priority: 'low' | 'medium' | 'high' | 'critical';
        description: string;
        attempted_solutions?: string[];
    }): Promise<void>;
    /**
     * Get session context for coordination
     */
    protected getSessionContext(session_id: string): Promise<any>;
    /**
     * Create success response with metadata
     */
    protected createSuccessResponse(message: string, data?: any, metadata?: any): MCPToolResult;
    /**
     * Create error response with metadata
     */
    protected createErrorResponse(message: string, error?: any, metadata?: any): MCPToolResult;
    /**
     * Enhanced error handling with intelligent recovery strategies
     */
    protected handleServiceNowError(error: any, operation: string, context: AgentContext, fallbackOptions?: {
        enableRetry?: boolean;
        enableScopeEscalation?: boolean;
        enableManualSteps?: boolean;
    }): Promise<MCPToolResult>;
    /**
     * Categorize error for appropriate recovery strategy
     */
    private categorizeError;
    /**
     * Handle authentication errors with automatic recovery
     */
    private handleAuthenticationError;
    /**
     * Handle permission errors with scope escalation
     */
    private handlePermissionError;
    /**
     * Handle network errors with intelligent retry
     */
    private handleNetworkError;
    /**
     * Handle validation errors with correction suggestions
     */
    private handleValidationError;
    /**
     * Handle scope errors with automatic fallback
     */
    private handleScopeError;
    /**
     * Handle generic errors with comprehensive guidance
     */
    private handleGenericError;
    /**
     * Helper methods for error handling
     */
    private extractErrorCode;
    private extractFieldInfoFromError;
    private generateRecoveryOptions;
    private escalateToGlobalScope;
    /**
     * Determine required roles based on operation type
     */
    private determineRequiredRoles;
    /**
     * Determine required OAuth scopes based on operation type
     */
    private determineRequiredOAuthScopes;
    /**
     * Enhanced role assignment with better validation
     */
    private attemptEnhancedRoleAssignment;
    /**
     * Attempt OAuth scope elevation
     */
    private attemptOAuthScopeElevation;
    /**
     * Enhanced deployment context extraction
     */
    private extractEnhancedDeploymentContext;
    /**
     * Analyze error for global scope strategy
     */
    private analyzeErrorForGlobalScopeStrategy;
    /**
     * Validate global scope deployment permissions
     */
    private validateGlobalScopePermissions;
    /**
     * Determine global deployment strategy
     */
    private determineGlobalDeploymentStrategy;
    /**
     * Attempt automatic role assignment (usually requires admin privileges)
     */
    private attemptRoleAssignment;
    private fallbackToGlobalScope;
    /**
     * Extract deployment context from operation and context
     */
    private extractDeploymentContext;
    /**
     * Extract artifact type from operation string
     */
    private extractArtifactType;
    /**
     * Extract artifact name from operation string
     */
    private extractArtifactName;
    /**
     * Deploy widget in global scope
     */
    private deployWidgetInGlobalScope;
    /**
     * Deploy flow in global scope
     */
    private deployFlowInGlobalScope;
    /**
     * Deploy script include in global scope
     */
    private deployScriptInGlobalScope;
    /**
     * Deploy business rule in global scope
     */
    private deployBusinessRuleInGlobalScope;
    /**
     * Generic global scope deployment for unknown artifact types
     */
    private deployGenericArtifactInGlobalScope;
    /**
     * Update context with global deployment information
     */
    private updateContextWithGlobalDeployment;
    /**
     * Enhanced context update with deployment tracking
     */
    private updateContextWithEnhancedGlobalDeployment;
    /**
     * Enhanced widget deployment in global scope
     */
    private deployWidgetInGlobalScopeEnhanced;
    /**
     * Enhanced flow deployment in global scope
     */
    private deployFlowInGlobalScopeEnhanced;
    /**
     * Enhanced script deployment in global scope
     */
    private deployScriptInGlobalScopeEnhanced;
    /**
     * Enhanced business rule deployment in global scope
     */
    private deployBusinessRuleInGlobalScopeEnhanced;
    /**
     * Enhanced table deployment in global scope
     */
    private deployTableInGlobalScopeEnhanced;
    /**
     * Enhanced generic artifact deployment in global scope
     */
    private deployGenericArtifactInGlobalScopeEnhanced;
    /**
     * Handle application scope fallback
     */
    private handleApplicationScopeFallback;
    /**
     * Attempt generic global scope deployment
     */
    private attemptGenericGlobalScopeDeployment;
    /**
     * Validate global deployment
     */
    private validateGlobalDeployment;
    /**
     * Generate global scope recommendations
     */
    private generateGlobalScopeRecommendations;
    /**
     * Analyze global scope failure
     */
    private analyzeGlobalScopeFailure;
    private delay;
    /**
     * Handle mock data removal - ensure real operations only
     */
    protected assertNoMockData(operation: string): void;
    /**
     * List available MCP resources
     */
    protected listMCPResources(): Promise<any>;
    /**
     * Read a specific MCP resource by URI
     */
    protected readMCPResource(uri: string): Promise<any>;
    /**
     * Get resource manager statistics
     */
    protected getMCPResourceStats(): any;
    /**
     * Clear resource cache (useful for development)
     */
    protected clearMCPResourceCache(): void;
    /**
     * Start the MCP server
     */
    start(): Promise<void>;
}
//# sourceMappingURL=base-mcp-server.d.ts.map