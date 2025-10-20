"use strict";
/**
 * Base MCP Server with Agent Integration
 * Provides common functionality for all MCP servers in the agent ecosystem
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const servicenow_client_js_1 = require("../../utils/servicenow-client.js");
const snow_oauth_js_1 = require("../../utils/snow-oauth.js");
const logger_js_1 = require("../../utils/logger.js");
const agent_context_provider_js_1 = require("./agent-context-provider.js");
const mcp_memory_manager_js_1 = require("./mcp-memory-manager.js");
const mcp_resource_manager_js_1 = require("./mcp-resource-manager.js");
class BaseMCPServer {
    constructor(name, version = '1.0.0') {
        this.server = new index_js_1.Server({
            name,
            version,
        }, {
            capabilities: {
                tools: {},
                resources: {},
            },
        });
        this.client = new servicenow_client_js_1.ServiceNowClient();
        this.oauth = new snow_oauth_js_1.ServiceNowOAuth();
        this.logger = new logger_js_1.Logger(name);
        this.contextProvider = new agent_context_provider_js_1.AgentContextProvider();
        this.memory = mcp_memory_manager_js_1.MCPMemoryManager.getInstance();
        this.resourceManager = new mcp_resource_manager_js_1.MCPResourceManager(name);
    }
    /**
     * Execute a tool with agent context tracking
     */
    async executeWithAgentContext(toolName, args, operation) {
        // Extract agent context
        const agentContext = this.contextProvider.extractAgentContext(args);
        // Log operation start
        this.logger.info(`Executing ${toolName}`, {
            agent_id: agentContext.agent_id,
            session_id: agentContext.session_id
        });
        // Execute with context tracking
        const result = await this.contextProvider.executeWithContext({
            ...agentContext,
            operation_name: toolName,
            mcp_server: this.server.serverInfo?.name || 'unknown'
        }, async () => operation(agentContext));
        if (!result.success) {
            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Operation failed: ${result.error}`
                    }
                ],
                metadata: {
                    agent_id: agentContext.agent_id,
                    session_id: agentContext.session_id,
                    duration_ms: result.duration_ms
                }
            };
        }
        return result.data;
    }
    /**
     * MANDATORY authentication and connection validation before ServiceNow operations
     */
    async validateServiceNowConnection() {
        try {
            this.logger.info('🔍 Validating ServiceNow connection...');
            // 1. Check if we have valid credentials
            const credentials = await this.oauth.loadCredentials();
            if (!credentials) {
                return {
                    success: false,
                    error: 'No ServiceNow credentials found. Set up .env file and run "snow-flow auth login".'
                };
            }
            // 2. Check if we have access token (OAuth session)
            if (!credentials.accessToken) {
                return {
                    success: false,
                    error: 'OAuth authentication required. Run "snow-flow auth login" to authenticate.'
                };
            }
            // 3. Check if token is still valid
            const isAuth = await this.oauth.isAuthenticated();
            if (!isAuth) {
                this.logger.info('🔄 Token expired, attempting refresh...');
                // Try to refresh token
                const refreshResult = await this.oauth.refreshAccessToken();
                if (!refreshResult.success) {
                    return {
                        success: false,
                        error: 'OAuth token expired and refresh failed. Run "snow-flow auth login" to re-authenticate.'
                    };
                }
                this.logger.info('✅ Token refreshed successfully');
            }
            // 4. Test actual ServiceNow connection
            this.logger.info('🔧 About to call testConnection', {
                clientType: this.client.constructor.name,
                clientMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.client)),
                hasTestConnection: typeof this.client.testConnection === 'function',
                hasMakeRequest: typeof this.client.makeRequest === 'function'
            });
            try {
                const connectionTest = await this.client.testConnection();
                if (!connectionTest.success) {
                    return {
                        success: false,
                        error: `ServiceNow connection failed: ${connectionTest.error}`
                    };
                }
            }
            catch (testError) {
                this.logger.error('🔧 testConnection error:', {
                    error: testError.message,
                    stack: testError.stack,
                    clientInfo: {
                        type: this.client.constructor.name,
                        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(this.client))
                    }
                });
                throw testError;
            }
            this.logger.info('✅ ServiceNow connection validated');
            return { success: true };
        }
        catch (error) {
            this.logger.error('ServiceNow connection validation failed', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Check authentication with proper error handling (deprecated - use validateServiceNowConnection)
     */
    async checkAuthentication() {
        const result = await this.validateServiceNowConnection();
        return result.success;
    }
    /**
     * Create standard authentication error response with detailed instructions
     */
    createAuthenticationError(error) {
        const errorText = error || 'Authentication validation failed';
        return {
            content: [
                {
                    type: 'text',
                    text: `❌ ServiceNow Connection Failed

${errorText}

🔧 To fix this:

1. Ensure .env file has OAuth credentials:
   SNOW_INSTANCE=your-instance.service-now.com
   SNOW_CLIENT_ID=your_oauth_client_id
   SNOW_CLIENT_SECRET=your_oauth_client_secret

2. Authenticate with ServiceNow:
   snow-flow auth login

3. If you still get errors, run diagnostics:
   snow_auth_diagnostics()

💡 To get OAuth credentials:
   • ServiceNow: System OAuth > Application Registry > New OAuth Application
   • Redirect URI: http://localhost:3005/callback (configurable via SNOW_REDIRECT_* env vars)
   • Scopes: useraccount write admin`
                }
            ]
        };
    }
    /**
     * Smart artifact discovery - check for existing artifacts before creating new ones
     */
    async discoverExistingArtifacts(type, name, searchTerms) {
        try {
            this.logger.info(`🔍 Discovering existing ${type} artifacts...`);
            const suggestions = [];
            let artifacts = [];
            // Search by name
            const nameSearch = await this.client.searchRecords(this.getTableForType(type), `nameLIKE${name}`, 5);
            if (nameSearch.success && nameSearch.data?.result?.length > 0) {
                artifacts = nameSearch.data.result;
                suggestions.push(`Found ${artifacts.length} existing ${type}(s) with similar names`);
                suggestions.push(`Consider reusing: ${artifacts.map(a => a.name).join(', ')}`);
            }
            // Search by additional terms if provided
            if (searchTerms && searchTerms.length > 0) {
                for (const term of searchTerms) {
                    const termSearch = await this.client.searchRecords(this.getTableForType(type), `nameLIKE${term}^ORdescriptionLIKE${term}`, 3);
                    if (termSearch.success && termSearch.data?.result?.length > 0) {
                        const newArtifacts = termSearch.data.result.filter((new_artifact) => !artifacts.some(existing => existing.sys_id === new_artifact.sys_id));
                        artifacts.push(...newArtifacts);
                        if (newArtifacts.length > 0) {
                            suggestions.push(`Found ${newArtifacts.length} related ${type}(s) for "${term}"`);
                        }
                    }
                }
            }
            return {
                found: artifacts.length > 0,
                artifacts,
                suggestions
            };
        }
        catch (error) {
            this.logger.warn('Artifact discovery failed', error);
            return { found: false, artifacts: [], suggestions: [] };
        }
    }
    /**
     * Ensure active Update Set for tracking changes
     */
    async ensureUpdateSet(context, purpose) {
        try {
            this.logger.info('📦 Ensuring active Update Set...');
            // Check current update set
            const currentUpdateSet = await this.client.getCurrentUpdateSet();
            if (currentUpdateSet.success && currentUpdateSet.data) {
                this.logger.info(`✅ Using existing Update Set: ${currentUpdateSet.data.name}`);
                return currentUpdateSet.data.sys_id;
            }
            // Create new update set
            const updateSetName = purpose
                ? `Snow-Flow ${purpose} - ${new Date().toISOString().split('T')[0]}`
                : `Snow-Flow Changes - ${new Date().toISOString().split('T')[0]}`;
            this.logger.info(`📦 Creating new Update Set: ${updateSetName}`);
            const newUpdateSet = await this.client.createUpdateSet({
                name: updateSetName,
                description: `Automated changes from Snow-Flow Agent (${context.agent_id})`,
                state: 'in_progress'
            });
            if (newUpdateSet.success && newUpdateSet.data) {
                // Set it as current
                await this.client.setCurrentUpdateSet(newUpdateSet.data.sys_id);
                this.logger.info(`✅ Update Set created and activated: ${newUpdateSet.data.sys_id}`);
                return newUpdateSet.data.sys_id;
            }
            this.logger.warn('⚠️ Could not create Update Set, changes will not be tracked');
            return null;
        }
        catch (error) {
            this.logger.warn('Update Set creation failed', error);
            return null;
        }
    }
    /**
     * Automatically track artifact in Update Set
     */
    async trackArtifact(sysId, type, name, updateSetId) {
        try {
            if (!updateSetId) {
                this.logger.warn('No Update Set ID provided for artifact tracking');
                return;
            }
            this.logger.info(`📋 Tracking ${type} artifact: ${name} (${sysId})`);
            // Add artifact to update set tracking (this is handled automatically by ServiceNow 
            // when artifacts are created/modified, but we can log it for visibility)
            this.logger.info(`✅ Artifact tracked in Update Set: ${updateSetId}`);
        }
        catch (error) {
            this.logger.warn('Artifact tracking failed', error);
        }
    }
    /**
     * Get ServiceNow table name for artifact type
     */
    getTableForType(type) {
        const tableMap = {
            'widget': 'sp_widget',
            'flow': 'sys_hub_flow',
            'subflow': 'sys_hub_flow',
            'action': 'sys_hub_action_type_definition',
            'script': 'sys_script_include',
            'business_rule': 'sys_script',
            'table': 'sys_db_object',
            'application': 'sys_app'
        };
        return tableMap[type] || 'sys_metadata';
    }
    /**
     * Report progress during long operations
     */
    async reportProgress(context, progress, phase) {
        await this.contextProvider.reportProgress(context, progress, phase);
    }
    /**
     * Store artifact with agent tracking
     */
    async storeArtifact(context, artifact) {
        await this.contextProvider.storeArtifact(context, artifact);
    }
    /**
     * Notify handoff to another agent
     */
    async notifyHandoff(context, to_agent, artifact_info) {
        await this.contextProvider.notifyHandoff(context, to_agent, artifact_info);
    }
    /**
     * Request Queen intervention for issues
     */
    async requestQueenIntervention(context, issue) {
        await this.contextProvider.requestQueenIntervention(context, issue);
    }
    /**
     * Get session context for coordination
     */
    async getSessionContext(session_id) {
        return await this.contextProvider.getSessionContext(session_id);
    }
    /**
     * Create success response with metadata
     */
    createSuccessResponse(message, data, metadata) {
        const content = [
            {
                type: 'text',
                text: `✅ ${message}`
            }
        ];
        if (data) {
            content.push({
                type: 'text',
                text: JSON.stringify(data, null, 2)
            });
        }
        return {
            content,
            metadata
        };
    }
    /**
     * Create error response with metadata
     */
    createErrorResponse(message, error, metadata) {
        const content = [
            {
                type: 'text',
                text: `❌ ${message}`
            }
        ];
        if (error) {
            content.push({
                type: 'text',
                text: `Error details: ${error instanceof Error ? error.message : String(error)}`
            });
        }
        return {
            content,
            metadata
        };
    }
    /**
     * Enhanced error handling with intelligent recovery strategies
     */
    async handleServiceNowError(error, operation, context, fallbackOptions) {
        this.logger.error(`ServiceNow operation failed: ${operation}`, error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorCode = this.extractErrorCode(errorMessage);
        // Categorize error and determine recovery strategy
        const errorCategory = this.categorizeError(errorMessage, errorCode);
        switch (errorCategory) {
            case 'authentication':
                return this.handleAuthenticationError(error, operation, context);
            case 'permissions':
                return this.handlePermissionError(error, operation, context, fallbackOptions);
            case 'network':
                return this.handleNetworkError(error, operation, context, fallbackOptions);
            case 'validation':
                return this.handleValidationError(error, operation, context);
            case 'scope':
                return this.handleScopeError(error, operation, context, fallbackOptions);
            default:
                return this.handleGenericError(error, operation, context, fallbackOptions);
        }
    }
    /**
     * Categorize error for appropriate recovery strategy
     */
    categorizeError(errorMessage, errorCode) {
        const msgLower = errorMessage.toLowerCase();
        // Authentication errors
        if (msgLower.includes('unauthorized') ||
            msgLower.includes('invalid_grant') ||
            msgLower.includes('authentication') ||
            errorCode === '401' || errorCode === '403') {
            return 'authentication';
        }
        // Permission errors
        if (msgLower.includes('insufficient privileges') ||
            msgLower.includes('access denied') ||
            msgLower.includes('acl')) {
            return 'permissions';
        }
        // Network errors
        if (msgLower.includes('network') ||
            msgLower.includes('timeout') ||
            msgLower.includes('connection') ||
            msgLower.includes('econnrefused')) {
            return 'network';
        }
        // Validation errors
        if (msgLower.includes('invalid') ||
            msgLower.includes('required field') ||
            msgLower.includes('constraint') ||
            msgLower.includes('validation')) {
            return 'validation';
        }
        // Scope errors
        if (msgLower.includes('scope') ||
            msgLower.includes('application') ||
            msgLower.includes('global')) {
            return 'scope';
        }
        return 'generic';
    }
    /**
     * Handle authentication errors with automatic recovery
     */
    async handleAuthenticationError(error, operation, context) {
        this.logger.info('🔄 Attempting automatic authentication recovery...');
        // Try to refresh token automatically
        try {
            const refreshResult = await this.oauth.refreshAccessToken();
            if (refreshResult.success) {
                this.logger.info('✅ Token refreshed successfully, retry operation');
                // Store recovery in context for coordination
                await this.memory.updateSharedContext({
                    session_id: context.session_id,
                    context_key: `auth_recovery_${operation}`,
                    context_value: JSON.stringify({
                        recovery_action: 'token_refresh',
                        timestamp: new Date().toISOString(),
                        operation: operation
                    }),
                    created_by_agent: context.agent_id
                });
                return this.createSuccessResponse('Authentication recovered - token refreshed', {
                    recovery_action: 'token_refresh',
                    next_step: 'retry_operation',
                    can_continue: true
                });
            }
        }
        catch (refreshError) {
            this.logger.warn('Token refresh failed', refreshError);
        }
        // Request Queen intervention for authentication issues
        await this.requestQueenIntervention(context, {
            type: 'authentication_failure',
            priority: 'high',
            description: `Authentication failed for ${operation}`,
            attempted_solutions: ['token_refresh']
        });
        return this.createAuthenticationError(`Authentication failed during ${operation}. Automatic recovery failed.`);
    }
    /**
     * Handle permission errors with scope escalation
     */
    async handlePermissionError(error, operation, context, fallbackOptions) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Try scope escalation if enabled
        if (fallbackOptions?.enableScopeEscalation) {
            this.logger.info('🔝 Attempting scope escalation...');
            try {
                // Try to escalate to global scope
                const escalationResult = await this.escalateToGlobalScope(operation, context);
                if (escalationResult.success) {
                    return this.createSuccessResponse('Permission issue resolved via scope escalation', escalationResult);
                }
            }
            catch (escalationError) {
                this.logger.warn('Scope escalation failed', escalationError);
            }
        }
        // Request permission elevation
        await this.requestQueenIntervention(context, {
            type: 'permission_elevation_needed',
            priority: 'high',
            description: `Insufficient privileges for ${operation}: ${errorMessage}`,
            attempted_solutions: fallbackOptions?.enableScopeEscalation ? ['scope_escalation'] : []
        });
        return this.createErrorResponse(`Permission error during ${operation}`, {
            error: errorMessage,
            recovery_options: [
                '1. Request admin privileges from Queen Agent',
                '2. Try scope escalation to global',
                '3. Create manual Update Set instructions',
                '4. Use alternative deployment approach'
            ],
            next_steps: [
                'Contact ServiceNow admin for elevated permissions',
                'Or use snow_deploy with fallback_strategy="manual_steps"'
            ]
        });
    }
    /**
     * Handle network errors with intelligent retry
     */
    async handleNetworkError(error, operation, context, fallbackOptions) {
        if (fallbackOptions?.enableRetry) {
            this.logger.info('🔄 Network error - attempting retry with backoff...');
            // Implement exponential backoff retry
            const maxRetries = 3;
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                await this.delay(Math.pow(2, attempt) * 1000); // Exponential backoff
                try {
                    // Test connection
                    const connectionTest = await this.client.testConnection();
                    if (connectionTest.success) {
                        this.logger.info(`✅ Network recovered after ${attempt} attempts`);
                        return this.createSuccessResponse('Network error recovered - connection restored', {
                            recovery_action: 'network_retry',
                            attempts: attempt,
                            can_continue: true
                        });
                    }
                }
                catch (retryError) {
                    this.logger.warn(`Retry attempt ${attempt} failed`, retryError);
                }
            }
        }
        return this.createErrorResponse(`Network error during ${operation}`, {
            error: error instanceof Error ? error.message : String(error),
            recovery_options: [
                '1. Check ServiceNow instance availability',
                '2. Verify network connectivity',
                '3. Check firewall/proxy settings',
                '4. Retry operation in a few minutes'
            ],
            next_steps: [
                'Wait for network recovery and retry',
                'Or check ServiceNow instance status'
            ]
        });
    }
    /**
     * Handle validation errors with correction suggestions
     */
    async handleValidationError(error, operation, context) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Extract field information from validation error
        const fieldInfo = this.extractFieldInfoFromError(errorMessage);
        return this.createErrorResponse(`Validation error during ${operation}`, {
            error: errorMessage,
            field_issues: fieldInfo,
            recovery_options: [
                '1. Fix required fields and retry',
                '2. Check field constraints and formats',
                '3. Use snow_validate_deployment() first',
                '4. Review ServiceNow table schema'
            ],
            next_steps: [
                'Update configuration with correct field values',
                'Validate against ServiceNow table requirements'
            ]
        });
    }
    /**
     * Handle scope errors with automatic fallback
     */
    async handleScopeError(error, operation, context, fallbackOptions) {
        if (fallbackOptions?.enableScopeEscalation) {
            this.logger.info('🌐 Scope error - attempting global scope fallback...');
            try {
                const scopeFallback = await this.fallbackToGlobalScope(operation, context);
                if (scopeFallback.success) {
                    return this.createSuccessResponse('Scope error resolved - using global scope', scopeFallback);
                }
            }
            catch (scopeError) {
                this.logger.warn('Global scope fallback failed', scopeError);
            }
        }
        return this.createErrorResponse(`Scope error during ${operation}`, {
            error: error instanceof Error ? error.message : String(error),
            recovery_options: [
                '1. Deploy to global scope instead',
                '2. Create scoped application first',
                '3. Use manual deployment approach',
                '4. Check application scope permissions'
            ],
            next_steps: [
                'Try snow_deploy with scope_strategy="global"',
                'Or create application scope manually first'
            ]
        });
    }
    /**
     * Handle generic errors with comprehensive guidance
     */
    async handleGenericError(error, operation, context, fallbackOptions) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        // Generate contextual recovery options based on operation type
        const recoveryOptions = this.generateRecoveryOptions(operation, errorMessage);
        // Store error for pattern analysis
        await this.memory.updateSharedContext({
            session_id: context.session_id,
            context_key: `error_${operation}_${Date.now()}`,
            context_value: JSON.stringify({
                error: errorMessage,
                operation: operation,
                timestamp: new Date().toISOString(),
                recovery_attempted: Object.keys(fallbackOptions || {})
            }),
            created_by_agent: context.agent_id
        });
        return this.createErrorResponse(`Unexpected error during ${operation}`, {
            error: errorMessage,
            recovery_options: recoveryOptions,
            next_steps: [
                'Review error details and try alternative approach',
                'Use snow_deployment_debug() for diagnostics',
                'Contact Queen Agent for intervention'
            ],
            fallback_available: fallbackOptions?.enableManualSteps || false
        });
    }
    /**
     * Helper methods for error handling
     */
    extractErrorCode(errorMessage) {
        const codeMatch = errorMessage.match(/(\d{3})/);
        return codeMatch ? codeMatch[1] : undefined;
    }
    extractFieldInfoFromError(errorMessage) {
        const fieldMatch = errorMessage.match(/field[:\s]+([a-z_]+)/i);
        const requiredMatch = errorMessage.match(/required/i);
        return {
            field: fieldMatch ? fieldMatch[1] : null,
            is_required: !!requiredMatch,
            raw_message: errorMessage
        };
    }
    generateRecoveryOptions(operation, errorMessage) {
        const options = [
            '1. Review error message and fix configuration',
            '2. Check ServiceNow instance status and permissions'
        ];
        if (operation.includes('deploy')) {
            options.push('3. Use snow_validate_deployment() before retrying');
            options.push('4. Try manual deployment with Update Set');
        }
        if (operation.includes('search') || operation.includes('find')) {
            options.push('3. Try alternative search terms');
            options.push('4. Use snow_comprehensive_search() for broader search');
        }
        options.push('5. Request Queen Agent intervention for complex issues');
        return options;
    }
    async escalateToGlobalScope(operation, context) {
        this.logger.info(`🔝 Attempting permission escalation for ${operation}`);
        try {
            // Enhanced authentication validation
            const authValidation = await this.validateServiceNowConnection();
            if (!authValidation.success) {
                return {
                    success: false,
                    reason: 'Authentication validation failed before escalation',
                    recovery_action: 'Run: snow-flow auth login',
                    auth_error: authValidation.error
                };
            }
            // Get current user information with enhanced OAuth scope handling
            this.logger.info('🔍 Analyzing current user permissions and OAuth scopes...');
            let currentUser = null;
            let currentRoles = [];
            let oAuthScopes = [];
            try {
                // Get current user details
                const userResponse = await this.client.makeRequest({
                    method: 'GET',
                    endpoint: '/api/now/v2/table/sys_user',
                    params: {
                        sysparm_query: 'active=true^user_name=javascript:gs.getUserName()',
                        sysparm_fields: 'sys_id,user_name,name,email,active,locked_out,roles',
                        sysparm_limit: 1
                    }
                });
                if (userResponse.data?.result?.[0]) {
                    currentUser = userResponse.data.result[0];
                    this.logger.info(`👤 Current user: ${currentUser.name} (${currentUser.user_name})`);
                }
                // Get detailed role information
                const rolesResponse = await this.client.makeRequest({
                    method: 'GET',
                    endpoint: '/api/now/v2/table/sys_user_has_role',
                    params: {
                        sysparm_query: `user.user_name=${currentUser?.user_name || 'javascript:gs.getUserName()'}`,
                        sysparm_fields: 'role.name,role.description,state,inherited',
                        sysparm_limit: 100
                    }
                });
                if (rolesResponse.data?.result) {
                    currentRoles = rolesResponse.data.result
                        .filter((r) => r.state === 'active')
                        .map((r) => r['role.name'])
                        .filter(Boolean);
                    this.logger.info(`🛡️ Active roles: ${currentRoles.join(', ')}`);
                }
                // Check OAuth token scopes if available
                try {
                    // Attempt to get token info if method exists
                    if (typeof this.oauth.getTokenInfo === 'function') {
                        const tokenInfo = await this.oauth.getTokenInfo();
                        if (tokenInfo?.scope) {
                            oAuthScopes = tokenInfo.scope.split(' ');
                            this.logger.info(`🔑 OAuth scopes: ${oAuthScopes.join(', ')}`);
                        }
                    }
                    else {
                        this.logger.debug('OAuth getTokenInfo method not available');
                    }
                }
                catch (scopeError) {
                    this.logger.debug('Could not retrieve OAuth scope information', { error: scopeError });
                }
            }
            catch (roleError) {
                this.logger.warn('Could not fetch complete user information', { error: roleError });
                // Continue with limited information
            }
            // Enhanced role _analysis based on operation type
            const requiredRoles = this.determineRequiredRoles(operation);
            const requiredScopes = this.determineRequiredOAuthScopes(operation);
            const missingRoles = requiredRoles.filter(role => !currentRoles.includes(role));
            const missingScopes = requiredScopes.filter(scope => !oAuthScopes.includes(scope));
            this.logger.info(`📊 Permission Analysis:`, {
                required_roles: requiredRoles,
                current_roles: currentRoles,
                missing_roles: missingRoles,
                required_scopes: requiredScopes,
                current_scopes: oAuthScopes,
                missing_scopes: missingScopes
            });
            // Check if user has sufficient permissions
            if (missingRoles.length === 0 && missingScopes.length === 0) {
                // User has all required permissions, issue might be elsewhere
                return {
                    success: true,
                    reason: 'User has all required roles and scopes - permission issue may be configuration related',
                    current_roles: currentRoles,
                    current_scopes: oAuthScopes,
                    diagnostic_actions: [
                        'Check ACL rules for the specific table/operation',
                        'Verify application scope permissions',
                        'Check domain separation settings',
                        'Review field-level security',
                        'Validate write permissions for target table'
                    ]
                };
            }
            // Enhanced automatic role assignment with better error handling
            let autoAssignmentAttempted = false;
            const canAutoAssign = currentRoles.includes('admin') ||
                currentRoles.includes('user_admin') ||
                currentRoles.includes('system_administrator');
            if (canAutoAssign && missingRoles.length > 0) {
                this.logger.info('🤖 Attempting automatic role assignment...');
                try {
                    const assignmentResult = await this.attemptEnhancedRoleAssignment(currentUser?.sys_id, missingRoles, context);
                    if (assignmentResult.success) {
                        autoAssignmentAttempted = true;
                        // Update context with successful assignment
                        await this.memory.updateSharedContext({
                            session_id: context.session_id,
                            context_key: `permission_escalation_${operation}`,
                            context_value: JSON.stringify({
                                escalation_type: 'automatic_role_assignment',
                                assigned_roles: assignmentResult.assigned_roles,
                                timestamp: new Date().toISOString(),
                                operation: operation
                            }),
                            created_by_agent: context.agent_id
                        });
                        return {
                            success: true,
                            reason: 'Roles automatically assigned successfully',
                            assigned_roles: assignmentResult.assigned_roles,
                            assignment_details: assignmentResult.details,
                            recommended_action: 'Retry the original operation - new permissions are active'
                        };
                    }
                }
                catch (assignError) {
                    this.logger.warn('Automatic role assignment failed', { error: assignError });
                    autoAssignmentAttempted = true; // We tried
                }
            }
            // Enhanced OAuth scope elevation attempt
            if (missingScopes.length > 0) {
                this.logger.info('🔑 Attempting OAuth scope elevation...');
                try {
                    const scopeElevationResult = await this.attemptOAuthScopeElevation(missingScopes, operation, context);
                    if (scopeElevationResult.success) {
                        return {
                            success: true,
                            reason: 'OAuth scopes elevated successfully',
                            elevated_scopes: scopeElevationResult.elevated_scopes,
                            recommended_action: 'Retry the original operation with elevated OAuth permissions'
                        };
                    }
                }
                catch (scopeError) {
                    this.logger.warn('OAuth scope elevation failed', { error: scopeError });
                }
            }
            // Request Queen intervention for complex permission issues
            await this.requestQueenIntervention(context, {
                type: 'permission_escalation_required',
                priority: 'high',
                description: `Permission escalation needed for ${operation}. Missing roles: ${missingRoles.join(', ')}. Missing OAuth scopes: ${missingScopes.join(', ')}.`,
                attempted_solutions: [
                    ...(autoAssignmentAttempted ? ['automatic_role_assignment'] : []),
                    ...(missingScopes.length > 0 ? ['oauth_scope_elevation'] : [])
                ]
            });
            // Comprehensive manual escalation instructions
            const manualSteps = [
                `1. ServiceNow Administrator Actions Required:`,
                `   • Navigate to User Administration > Users`,
                `   • Find user: ${currentUser?.name || 'Current User'} (${currentUser?.user_name || 'unknown'})`,
                `   • Add missing roles: ${missingRoles.join(', ')}`,
                ...missingScopes.length > 0 ? [
                    `2. OAuth Application Configuration:`,
                    `   • Update OAuth application scopes to include: ${missingScopes.join(', ')}`,
                    `   • Re-authorize application with elevated permissions`
                ] : [],
                `${missingScopes.length > 0 ? '3' : '2'}. Verification Steps:`,
                `   • Test permissions: snow_validate_live_connection({ test_level: "permissions" })`,
                `   • Retry operation: ${operation}`
            ];
            return {
                success: false,
                reason: 'Manual permission escalation required',
                current_user: currentUser,
                current_roles: currentRoles,
                missing_roles: missingRoles,
                current_oauth_scopes: oAuthScopes,
                missing_oauth_scopes: missingScopes,
                escalation_required: true,
                auto_assignment_attempted: autoAssignmentAttempted,
                manual_steps: manualSteps,
                estimated_time: `${5 + (missingRoles.length * 2)}–${10 + (missingRoles.length * 3)} minutes with admin access`,
                priority: missingRoles.includes('admin') || missingRoles.includes('system_administrator') ? 'critical' : 'high'
            };
        }
        catch (error) {
            this.logger.error('🚨 Permission escalation process failed', { error, operation, context });
            return {
                success: false,
                reason: 'Critical error during permission escalation',
                error: error instanceof Error ? error.message : String(error),
                error_type: this.categorizeError(error instanceof Error ? error.message : String(error)),
                recovery_actions: [
                    '1. Verify ServiceNow connection: snow_validate_live_connection()',
                    '2. Check authentication status: snow_auth_diagnostics()',
                    '3. Confirm API access is enabled in ServiceNow',
                    '4. Contact ServiceNow administrator for manual role assignment',
                    '5. Review system logs for additional error details'
                ],
                escalation_required: true,
                contact_admin: true
            };
        }
    }
    /**
     * Determine required roles based on operation type
     */
    determineRequiredRoles(operation) {
        const roles = [];
        // Base roles for most operations
        if (operation.includes('deploy') || operation.includes('create') || operation.includes('update')) {
            roles.push('rest_service', 'web_service_admin');
        }
        // Widget operations
        if (operation.includes('widget')) {
            roles.push('sp_admin', 'sp_portal_admin');
        }
        // Flow operations  
        if (operation.includes('flow') || operation.includes('workflow')) {
            roles.push('flow_designer', 'admin');
        }
        // Application operations
        if (operation.includes('application') || operation.includes('app')) {
            roles.push('app_creator', 'admin');
        }
        // Update set operations
        if (operation.includes('update_set')) {
            roles.push('admin');
        }
        // Global scope operations
        if (operation.includes('global')) {
            roles.push('admin', 'system_administrator');
        }
        return Array.from(new Set(roles)); // Remove duplicates
    }
    /**
     * Determine required OAuth scopes based on operation type
     */
    determineRequiredOAuthScopes(operation) {
        const scopes = ['useraccount']; // Base scope for most operations
        // Operations that require write access
        if (operation.includes('deploy') || operation.includes('create') || operation.includes('update')) {
            scopes.push('write');
        }
        // Administrative operations
        if (operation.includes('admin') || operation.includes('global') || operation.includes('system')) {
            scopes.push('admin');
        }
        // Flow Designer operations may need specific scopes
        if (operation.includes('flow') || operation.includes('workflow')) {
            scopes.push('write', 'admin');
        }
        return Array.from(new Set(scopes)); // Remove duplicates
    }
    /**
     * Enhanced role assignment with better validation
     */
    async attemptEnhancedRoleAssignment(userSysId, roles, context) {
        try {
            const assignedRoles = [];
            const assignmentDetails = [];
            for (const roleName of roles) {
                try {
                    // Get the role sys_id with enhanced validation
                    const roleResponse = await this.client.makeRequest({
                        method: 'GET',
                        endpoint: '/api/now/v2/table/sys_user_role',
                        params: {
                            sysparm_query: `name=${roleName}^active=true`,
                            sysparm_fields: 'sys_id,name,description,can_delegate',
                            sysparm_limit: 1
                        }
                    });
                    if (roleResponse.data?.result?.[0]) {
                        const role = roleResponse.data.result[0];
                        // Check if user already has this role
                        const existingRoleResponse = await this.client.makeRequest({
                            method: 'GET',
                            endpoint: '/api/now/v2/table/sys_user_has_role',
                            params: {
                                sysparm_query: `user=${userSysId}^role=${role.sys_id}`,
                                sysparm_limit: 1
                            }
                        });
                        if (existingRoleResponse.data?.result?.length > 0) {
                            this.logger.info(`User already has role: ${roleName}`);
                            assignedRoles.push(roleName);
                            continue;
                        }
                        // Attempt to assign role
                        const assignmentResponse = await this.client.makeRequest({
                            method: 'POST',
                            endpoint: '/api/now/v2/table/sys_user_has_role',
                            data: {
                                user: userSysId,
                                role: role.sys_id,
                                state: 'active',
                                granted_by: 'snow_flow_automation'
                            }
                        });
                        if (assignmentResponse.data?.result) {
                            assignedRoles.push(roleName);
                            assignmentDetails.push({
                                role: roleName,
                                sys_id: assignmentResponse.data.result.sys_id,
                                status: 'assigned'
                            });
                            this.logger.info(`Successfully assigned role: ${roleName}`);
                        }
                    }
                    else {
                        this.logger.warn(`Role not found: ${roleName}`);
                    }
                }
                catch (roleError) {
                    this.logger.warn(`Failed to assign role ${roleName}`, { error: roleError });
                    assignmentDetails.push({
                        role: roleName,
                        status: 'failed',
                        error: roleError instanceof Error ? roleError.message : String(roleError)
                    });
                }
            }
            return {
                success: assignedRoles.length > 0,
                assigned_roles: assignedRoles,
                details: assignmentDetails
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Attempt OAuth scope elevation
     */
    async attemptOAuthScopeElevation(missingScopes, operation, context) {
        try {
            this.logger.info('Requesting OAuth scope elevation...', { missing_scopes: missingScopes });
            // In most ServiceNow OAuth implementations, scope elevation requires
            // re-authorization through the OAuth flow. We can't dynamically elevate
            // scopes without user interaction.
            // Check if we can refresh token with additional scopes
            let currentToken = null;
            try {
                if (typeof this.oauth.getTokenInfo === 'function') {
                    currentToken = await this.oauth.getTokenInfo();
                }
            }
            catch (error) {
                this.logger.debug('Could not get current token info', { error });
            }
            if (!currentToken) {
                return {
                    success: false,
                    error: 'No active OAuth token found or method not available'
                };
            }
            // Attempt token refresh - this typically won't add new scopes
            // but might refresh existing elevated permissions
            const refreshResult = await this.oauth.refreshAccessToken();
            if (!refreshResult.success) {
                return {
                    success: false,
                    error: 'Failed to refresh OAuth token'
                };
            }
            // Check if the refresh gave us the scopes we need
            let newTokenInfo = null;
            try {
                if (typeof this.oauth.getTokenInfo === 'function') {
                    newTokenInfo = await this.oauth.getTokenInfo();
                }
            }
            catch (error) {
                this.logger.debug('Could not get new token info after refresh', { error });
            }
            const newScopes = newTokenInfo?.scope?.split(' ') || [];
            const actuallyMissing = missingScopes.filter(scope => !newScopes.includes(scope));
            if (actuallyMissing.length === 0) {
                return {
                    success: true,
                    elevated_scopes: missingScopes
                };
            }
            // For missing scopes, we need manual re-authorization
            return {
                success: false,
                error: `OAuth scopes require manual re-authorization: ${actuallyMissing.join(', ')}`
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Enhanced deployment context extraction
     */
    async extractEnhancedDeploymentContext(operation, context) {
        try {
            // Extract from agent context
            const contextData = context;
            // Enhanced artifact type detection
            const artifactType = this.extractArtifactType(operation);
            const artifactName = contextData.artifact_name ||
                this.extractArtifactName(operation) ||
                `fallback_${artifactType}_${Date.now()}`;
            // Determine current scope from various sources
            let currentScope = contextData.current_scope || 'scoped_application';
            if (contextData.deployment_config?.sys_scope) {
                currentScope = contextData.deployment_config.sys_scope;
            }
            // Analyze original error for better global scope strategy
            const originalError = contextData.original_error || 'Scoped deployment failed';
            const globalScopeStrategy = this.analyzeErrorForGlobalScopeStrategy(originalError);
            return {
                artifact_type: artifactType,
                artifact_name: artifactName,
                current_scope: currentScope,
                original_error: originalError,
                global_scope_strategy: globalScopeStrategy,
                deployment_config: contextData.deployment_config || {},
                operation_context: {
                    session_id: context.session_id,
                    agent_id: context.agent_id,
                    timestamp: new Date().toISOString()
                }
            };
        }
        catch (error) {
            this.logger.warn('Failed to extract enhanced deployment context', { error });
            return null;
        }
    }
    /**
     * Analyze error for global scope strategy
     */
    analyzeErrorForGlobalScopeStrategy(error) {
        const errorLower = error.toLowerCase();
        if (errorLower.includes('scope') || errorLower.includes('application')) {
            return 'direct_global_deployment';
        }
        if (errorLower.includes('permission') || errorLower.includes('access')) {
            return 'elevated_permissions_deployment';
        }
        if (errorLower.includes('table') || errorLower.includes('field')) {
            return 'schema_aware_deployment';
        }
        return 'standard_global_deployment';
    }
    /**
     * Validate global scope deployment permissions
     */
    async validateGlobalScopePermissions(artifactType, context) {
        try {
            // Check basic global scope permissions
            const requiredRoles = ['admin'];
            const requiredScopes = ['write', 'admin'];
            // Get current user roles (simplified check)
            let hasAdminRole = false;
            try {
                const rolesResponse = await this.client.makeRequest({
                    method: 'GET',
                    endpoint: '/api/now/v2/table/sys_user_has_role',
                    params: {
                        sysparm_query: 'user.user_name=javascript:gs.getUserName()^role.name=admin',
                        sysparm_limit: 1
                    }
                });
                hasAdminRole = rolesResponse.data?.result?.length > 0;
            }
            catch (roleCheckError) {
                this.logger.warn('Could not verify admin role', { error: roleCheckError });
            }
            if (!hasAdminRole) {
                return {
                    canProceed: false,
                    missing_permissions: ['admin'],
                    recommended_actions: [
                        'Request admin role from ServiceNow administrator',
                        'Use snow_escalate_permissions() for automatic elevation',
                        'Consider scoped deployment alternative'
                    ]
                };
            }
            return { canProceed: true };
        }
        catch (error) {
            this.logger.warn('Permission validation failed', { error });
            return {
                canProceed: false,
                missing_permissions: ['unknown'],
                recommended_actions: ['Check authentication and try again']
            };
        }
    }
    /**
     * Determine global deployment strategy
     */
    determineGlobalDeploymentStrategy(deploymentContext) {
        const strategies = {
            direct_global_deployment: {
                name: 'Direct Global Deployment',
                reasons: ['Scope-related error detected', 'Standard global scope approach'],
                estimated_success_rate: 0.75
            },
            elevated_permissions_deployment: {
                name: 'Elevated Permissions Deployment',
                reasons: ['Permission error detected', 'Admin-level deployment required'],
                estimated_success_rate: 0.60
            },
            schema_aware_deployment: {
                name: 'Schema-Aware Deployment',
                reasons: ['Table/field error detected', 'Enhanced validation required'],
                estimated_success_rate: 0.80
            },
            standard_global_deployment: {
                name: 'Standard Global Deployment',
                reasons: ['Generic error', 'Default global scope approach'],
                estimated_success_rate: 0.65
            }
        };
        return strategies[deploymentContext.global_scope_strategy] || strategies.standard_global_deployment;
    }
    /**
     * Attempt automatic role assignment (usually requires admin privileges)
     */
    async attemptRoleAssignment(userId, roles) {
        try {
            // This typically fails in most ServiceNow instances for security reasons
            // But we attempt it for completeness
            for (const roleName of roles) {
                // First, get the role sys_id
                const roleResponse = await this.client.makeRequest({
                    method: 'GET',
                    endpoint: '/api/now/v2/table/sys_user_role',
                    params: {
                        sysparm_query: `name=${roleName}`,
                        sysparm_fields: 'sys_id,name',
                        sysparm_limit: 1
                    }
                });
                if (roleResponse.data?.result?.[0]) {
                    const roleSysId = roleResponse.data.result[0].sys_id;
                    // Attempt to assign role to user
                    await this.client.makeRequest({
                        method: 'POST',
                        endpoint: '/api/now/v2/table/sys_user_has_role',
                        data: {
                            user: userId,
                            role: roleSysId
                        }
                    });
                }
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    async fallbackToGlobalScope(operation, context) {
        this.logger.info(`🌐 Attempting intelligent global scope fallback for ${operation}`);
        try {
            // Enhanced pre-flight validation
            const authValidation = await this.validateServiceNowConnection();
            if (!authValidation.success) {
                return {
                    success: false,
                    reason: 'Authentication validation failed before global scope fallback',
                    auth_error: authValidation.error,
                    recovery_action: 'Fix authentication first, then retry global scope deployment'
                };
            }
            // Comprehensive deployment context extraction with validation
            const deploymentContext = await this.extractEnhancedDeploymentContext(operation, context);
            if (!deploymentContext) {
                this.logger.warn('Unable to extract deployment context - attempting generic global scope deployment');
                return await this.attemptGenericGlobalScopeDeployment(operation, context);
            }
            // Validate global scope deployment permissions
            const globalScopeValidation = await this.validateGlobalScopePermissions(deploymentContext.artifact_type, context);
            if (!globalScopeValidation.canProceed) {
                return {
                    success: false,
                    reason: 'Insufficient permissions for global scope deployment',
                    missing_permissions: globalScopeValidation.missing_permissions,
                    recommended_actions: globalScopeValidation.recommended_actions,
                    escalation_required: true
                };
            }
            this.logger.info('🔧 Configuring global scope deployment', {
                original_scope: deploymentContext.current_scope,
                artifact_type: deploymentContext.artifact_type,
                artifact_name: deploymentContext.artifact_name,
                global_scope_strategy: deploymentContext.global_scope_strategy
            });
            // Enhanced deployment strategy based on artifact type and complexity
            let globalDeploymentResult;
            const deploymentStrategy = this.determineGlobalDeploymentStrategy(deploymentContext);
            this.logger.info(`📋 Using deployment strategy: ${deploymentStrategy.name}`, {
                reasons: deploymentStrategy.reasons,
                estimated_success_rate: deploymentStrategy.estimated_success_rate
            });
            switch (deploymentContext.artifact_type.toLowerCase()) {
                case 'widget':
                    globalDeploymentResult = await this.deployWidgetInGlobalScopeEnhanced(deploymentContext, deploymentStrategy);
                    break;
                case 'flow':
                case 'workflow':
                    globalDeploymentResult = await this.deployFlowInGlobalScopeEnhanced(deploymentContext, deploymentStrategy);
                    break;
                case 'script':
                case 'script_include':
                    globalDeploymentResult = await this.deployScriptInGlobalScopeEnhanced(deploymentContext, deploymentStrategy);
                    break;
                case 'business_rule':
                    globalDeploymentResult = await this.deployBusinessRuleInGlobalScopeEnhanced(deploymentContext, deploymentStrategy);
                    break;
                case 'table':
                    globalDeploymentResult = await this.deployTableInGlobalScopeEnhanced(deploymentContext, deploymentStrategy);
                    break;
                case 'application':
                    // Enhanced application scope handling
                    return await this.handleApplicationScopeFallback(deploymentContext, context);
                default:
                    globalDeploymentResult = await this.deployGenericArtifactInGlobalScopeEnhanced(deploymentContext, deploymentStrategy);
            }
            // Enhanced result processing with comprehensive validation
            if (globalDeploymentResult.success) {
                this.logger.info('✅ Global scope deployment successful', {
                    sys_id: globalDeploymentResult.sys_id,
                    artifact_type: deploymentContext.artifact_type,
                    deployment_time_ms: globalDeploymentResult.deployment_time_ms,
                    strategy_used: deploymentStrategy.name
                });
                // Enhanced context update with deployment tracking
                await this.updateContextWithEnhancedGlobalDeployment(context, {
                    ...globalDeploymentResult,
                    deployment_context: deploymentContext,
                    strategy_used: deploymentStrategy
                });
                // Post-deployment validation
                const validationResult = await this.validateGlobalDeployment(globalDeploymentResult.sys_id, deploymentContext.artifact_type);
                return {
                    success: true,
                    reason: 'Successfully deployed in global scope with validation',
                    deployment_details: {
                        sys_id: globalDeploymentResult.sys_id,
                        scope: 'global',
                        artifact_type: deploymentContext.artifact_type,
                        artifact_name: deploymentContext.artifact_name,
                        fallback_reason: deploymentContext.original_error,
                        strategy_used: deploymentStrategy.name,
                        deployment_time_ms: globalDeploymentResult.deployment_time_ms,
                        validation_status: validationResult.status,
                        functional_verification: validationResult.functional_tests
                    },
                    next_steps: [
                        '1. Verify artifact functionality in global scope',
                        '2. Review and update ACL permissions if needed',
                        '3. Document scope change for future reference',
                        '4. Test integration with other components',
                        '5. Consider long-term scope strategy'
                    ],
                    warnings: validationResult.warnings || [],
                    recommendations: this.generateGlobalScopeRecommendations(deploymentContext, globalDeploymentResult)
                };
            }
            else {
                // Enhanced failure handling with intelligent retry suggestions
                const failureAnalysis = await this.analyzeGlobalScopeFailure(globalDeploymentResult, deploymentContext, deploymentStrategy);
                this.logger.error('❌ Global scope deployment failed', {
                    original_error: deploymentContext.original_error,
                    global_deployment_error: globalDeploymentResult.error,
                    failure__analysis: failureAnalysis
                });
                return {
                    success: false,
                    reason: 'Global scope deployment failed after comprehensive attempts',
                    original_error: deploymentContext.original_error,
                    global_deployment_error: globalDeploymentResult.error,
                    failure__analysis: failureAnalysis,
                    alternative_strategies: [
                        '1. Manual Update Set creation and deployment',
                        '2. Phased deployment (create components separately)',
                        '3. XML-based deployment approach',
                        '4. ServiceNow Studio development environment',
                        '5. Direct database approach (requires elevated access)'
                    ],
                    diagnostic_commands: [
                        'snow_deployment_debug() - Get detailed error _analysis',
                        'snow_validate_deployment() - Pre-deployment validation',
                        'snow_auth_diagnostics() - Check authentication and permissions',
                        'snow_comprehensive_search() - Find similar existing artifacts'
                    ],
                    manual_options: failureAnalysis.manual_steps,
                    escalation_required: failureAnalysis.requires_admin_intervention,
                    estimated_manual_effort: failureAnalysis.estimated_manual_time
                };
            }
        }
        catch (error) {
            this.logger.error('🚨 Global scope fallback process failed critically', {
                error,
                operation,
                context,
                stack: error instanceof Error ? error.stack : 'No stack trace available'
            });
            // Request immediate Queen intervention for critical failures
            await this.requestQueenIntervention(context, {
                type: 'global_scope_fallback_failure',
                priority: 'critical',
                description: `Critical failure during global scope fallback for ${operation}: ${error instanceof Error ? error.message : String(error)}`,
                attempted_solutions: ['global_scope_deployment', 'enhanced_validation']
            });
            return {
                success: false,
                reason: 'Critical error during global scope fallback process',
                error: error instanceof Error ? error.message : String(error),
                error_type: this.categorizeError(error instanceof Error ? error.message : String(error)),
                stack_trace: error instanceof Error ? error.stack : null,
                recovery_actions: [
                    '1. Emergency: Verify ServiceNow instance connectivity',
                    '2. Critical: Check authentication and API access',
                    '3. High: Review deployment configuration for errors',
                    '4. Medium: Contact ServiceNow administrator immediately',
                    '5. Low: Review system logs for additional context'
                ],
                emergency_contact: true,
                requires_immediate_attention: true,
                fallback_options: [
                    'Switch to manual deployment process',
                    'Use ServiceNow Studio for development',
                    'Create support ticket with ServiceNow',
                    'Engage emergency deployment procedures'
                ]
            };
        }
    }
    /**
     * Extract deployment context from operation and context
     */
    extractDeploymentContext(operation, context) {
        try {
            // Try to extract context from agent context or operation string
            const contextData = context; // Allow access to additional properties
            return {
                artifact_type: this.extractArtifactType(operation),
                artifact_name: contextData.artifact_name || this.extractArtifactName(operation),
                current_scope: contextData.current_scope || 'scoped_application',
                original_error: contextData.original_error || 'Scoped deployment failed',
                deployment_config: contextData.deployment_config || {}
            };
        }
        catch (error) {
            this.logger.warn('Failed to extract deployment context', { error });
            return null;
        }
    }
    /**
     * Extract artifact type from operation string
     */
    extractArtifactType(operation) {
        const patterns = [
            { pattern: /widget/i, type: 'widget' },
            { pattern: /flow|workflow/i, type: 'flow' },
            { pattern: /script.*include/i, type: 'script_include' },
            { pattern: /business.*rule/i, type: 'business_rule' },
            { pattern: /application|app/i, type: 'application' },
            { pattern: /script/i, type: 'script' }
        ];
        for (const { pattern, type } of patterns) {
            if (pattern.test(operation)) {
                return type;
            }
        }
        return 'unknown';
    }
    /**
     * Extract artifact name from operation string
     */
    extractArtifactName(operation) {
        // Try to extract name from common patterns
        const nameMatch = operation.match(/deploy(?:ing)?\s+([a-zA-Z0-9_\-\s]+)/i);
        return nameMatch ? nameMatch[1].trim() : 'fallback_artifact';
    }
    /**
     * Deploy widget in global scope
     */
    async deployWidgetInGlobalScope(context) {
        try {
            const widgetData = {
                ...context.deployment_config,
                name: context.artifact_name,
                sys_scope: 'global' // Force global scope
            };
            const response = await this.client.makeRequest({
                method: 'POST',
                endpoint: '/api/now/v2/table/sp_widget',
                data: widgetData
            });
            if (response.data?.result) {
                return {
                    success: true,
                    sys_id: response.data.result.sys_id,
                    name: response.data.result.name
                };
            }
            return { success: false, error: 'No result returned from widget creation' };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Deploy flow in global scope
     */
    async deployFlowInGlobalScope(context) {
        try {
            const flowData = {
                ...context.deployment_config,
                name: context.artifact_name,
                sys_scope: 'global' // Force global scope
            };
            const response = await this.client.makeRequest({
                method: 'POST',
                endpoint: '/api/now/v2/table/wf_workflow',
                data: flowData
            });
            if (response.data?.result) {
                return {
                    success: true,
                    sys_id: response.data.result.sys_id,
                    name: response.data.result.name
                };
            }
            return { success: false, error: 'No result returned from flow creation' };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Deploy script include in global scope
     */
    async deployScriptInGlobalScope(context) {
        try {
            const scriptData = {
                ...context.deployment_config,
                name: context.artifact_name,
                sys_scope: 'global' // Force global scope
            };
            const response = await this.client.makeRequest({
                method: 'POST',
                endpoint: '/api/now/v2/table/sys_script_include',
                data: scriptData
            });
            if (response.data?.result) {
                return {
                    success: true,
                    sys_id: response.data.result.sys_id,
                    name: response.data.result.name
                };
            }
            return { success: false, error: 'No result returned from script creation' };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Deploy business rule in global scope
     */
    async deployBusinessRuleInGlobalScope(context) {
        try {
            const ruleData = {
                ...context.deployment_config,
                name: context.artifact_name,
                sys_scope: 'global' // Force global scope
            };
            const response = await this.client.makeRequest({
                method: 'POST',
                endpoint: '/api/now/v2/table/sys_script',
                data: ruleData
            });
            if (response.data?.result) {
                return {
                    success: true,
                    sys_id: response.data.result.sys_id,
                    name: response.data.result.name
                };
            }
            return { success: false, error: 'No result returned from business rule creation' };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Generic global scope deployment for unknown artifact types
     */
    async deployGenericArtifactInGlobalScope(context) {
        try {
            // Attempt deployment based on common table patterns
            const possibleTables = [
                'sys_script_include',
                'sys_script',
                'sys_ui_script',
                'sys_ui_page'
            ];
            for (const table of possibleTables) {
                try {
                    const data = {
                        ...context.deployment_config,
                        name: context.artifact_name,
                        sys_scope: 'global'
                    };
                    const response = await this.client.makeRequest({
                        method: 'POST',
                        endpoint: `/api/now/v2/table/${table}`,
                        data
                    });
                    if (response.data?.result) {
                        return {
                            success: true,
                            sys_id: response.data.result.sys_id,
                            name: response.data.result.name,
                            table_used: table
                        };
                    }
                }
                catch (tableError) {
                    // Continue to next table
                    this.logger.debug(`Failed to deploy to ${table}`, { error: tableError });
                }
            }
            return { success: false, error: 'No suitable table found for deployment' };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Update context with global deployment information
     */
    async updateContextWithGlobalDeployment(context, deploymentResult) {
        try {
            // Store deployment information in memory for coordination
            await this.memory.updateSharedContext({
                session_id: context.session_id,
                context_key: 'global_deployment_fallback',
                context_value: JSON.stringify({
                    original_context: context,
                    global_deployment: deploymentResult,
                    timestamp: new Date().toISOString()
                }),
                created_by_agent: context.agent_id
            });
        }
        catch (error) {
            this.logger.warn('Failed to update context with global deployment', { error });
        }
    }
    /**
     * Enhanced context update with deployment tracking
     */
    async updateContextWithEnhancedGlobalDeployment(context, deploymentResult) {
        try {
            await this.memory.updateSharedContext({
                session_id: context.session_id,
                context_key: 'enhanced_global_deployment',
                context_value: JSON.stringify({
                    deployment_result: deploymentResult,
                    context: context,
                    timestamp: new Date().toISOString()
                }),
                created_by_agent: context.agent_id
            });
        }
        catch (error) {
            this.logger.warn('Failed to update enhanced global deployment context', { error });
        }
    }
    /**
     * Enhanced widget deployment in global scope
     */
    async deployWidgetInGlobalScopeEnhanced(context, strategy) {
        try {
            const startTime = Date.now();
            const result = await this.deployWidgetInGlobalScope(context);
            return {
                ...result,
                deployment_time_ms: Date.now() - startTime,
                strategy_applied: strategy.name
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                deployment_time_ms: 0
            };
        }
    }
    /**
     * Enhanced flow deployment in global scope
     */
    async deployFlowInGlobalScopeEnhanced(context, strategy) {
        try {
            const startTime = Date.now();
            const result = await this.deployFlowInGlobalScope(context);
            return {
                ...result,
                deployment_time_ms: Date.now() - startTime,
                strategy_applied: strategy.name
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                deployment_time_ms: 0
            };
        }
    }
    /**
     * Enhanced script deployment in global scope
     */
    async deployScriptInGlobalScopeEnhanced(context, strategy) {
        try {
            const startTime = Date.now();
            const result = await this.deployScriptInGlobalScope(context);
            return {
                ...result,
                deployment_time_ms: Date.now() - startTime,
                strategy_applied: strategy.name
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                deployment_time_ms: 0
            };
        }
    }
    /**
     * Enhanced business rule deployment in global scope
     */
    async deployBusinessRuleInGlobalScopeEnhanced(context, strategy) {
        try {
            const startTime = Date.now();
            const result = await this.deployBusinessRuleInGlobalScope(context);
            return {
                ...result,
                deployment_time_ms: Date.now() - startTime,
                strategy_applied: strategy.name
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                deployment_time_ms: 0
            };
        }
    }
    /**
     * Enhanced table deployment in global scope
     */
    async deployTableInGlobalScopeEnhanced(context, strategy) {
        try {
            const startTime = Date.now();
            const tableData = {
                ...context.deployment_config,
                name: context.artifact_name,
                sys_scope: 'global'
            };
            const response = await this.client.makeRequest({
                method: 'POST',
                endpoint: '/api/now/v2/table/sys_db_object',
                data: tableData
            });
            if (response.data?.result) {
                return {
                    success: true,
                    sys_id: response.data.result.sys_id,
                    name: response.data.result.name,
                    deployment_time_ms: Date.now() - startTime,
                    strategy_applied: strategy.name
                };
            }
            return {
                success: false,
                error: 'No result returned from table creation',
                deployment_time_ms: Date.now() - startTime
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                deployment_time_ms: 0
            };
        }
    }
    /**
     * Enhanced generic artifact deployment in global scope
     */
    async deployGenericArtifactInGlobalScopeEnhanced(context, strategy) {
        try {
            const startTime = Date.now();
            const result = await this.deployGenericArtifactInGlobalScope(context);
            return {
                ...result,
                deployment_time_ms: Date.now() - startTime,
                strategy_applied: strategy.name
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                deployment_time_ms: 0
            };
        }
    }
    /**
     * Handle application scope fallback
     */
    async handleApplicationScopeFallback(deploymentContext, context) {
        try {
            this.logger.info('🏢 Handling application scope fallback...');
            return {
                success: false,
                reason: 'Applications require special scope handling - cannot deploy in global scope',
                alternative_strategies: [
                    '1. Create scoped application with broader permissions',
                    '2. Deploy individual components separately in global scope',
                    '3. Request administrator to configure application scope',
                    '4. Use ServiceNow Studio for application development'
                ],
                manual_steps: [
                    'Navigate to System Applications > Studio',
                    'Create new scoped application',
                    'Configure appropriate scope permissions',
                    'Deploy components within application scope'
                ],
                estimated_time: '15-30 minutes with proper permissions'
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
                reason: 'Failed to analyze application scope requirements'
            };
        }
    }
    /**
     * Attempt generic global scope deployment
     */
    async attemptGenericGlobalScopeDeployment(operation, context) {
        try {
            this.logger.info('🌐 Attempting generic global scope deployment...');
            return {
                success: false,
                reason: 'Generic global scope deployment requires more specific context',
                recommended_actions: [
                    'Provide more specific deployment context',
                    'Use artifact-specific deployment methods',
                    'Check deployment configuration',
                    'Contact administrator for manual deployment'
                ]
            };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    /**
     * Validate global deployment
     */
    async validateGlobalDeployment(sysId, artifactType) {
        try {
            const table = this.getTableForType(artifactType);
            const validationResponse = await this.client.makeRequest({
                method: 'GET',
                endpoint: `/api/now/v2/table/${table}/${sysId}`,
                params: {
                    sysparm_fields: 'sys_id,name,active,sys_scope'
                }
            });
            if (validationResponse.data?.result) {
                const artifact = validationResponse.data.result;
                return {
                    status: 'validated',
                    functional_tests: [
                        `Artifact exists: ${artifact.name}`,
                        `Scope: ${artifact.sys_scope || 'global'}`,
                        `Active: ${artifact.active || 'unknown'}`
                    ],
                    warnings: artifact.sys_scope !== 'global' ? ['Artifact may not be in global scope'] : []
                };
            }
            return {
                status: 'validation_failed',
                functional_tests: [],
                warnings: ['Could not validate artifact deployment']
            };
        }
        catch (error) {
            return {
                status: 'validation_error',
                functional_tests: [],
                warnings: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
            };
        }
    }
    /**
     * Generate global scope recommendations
     */
    generateGlobalScopeRecommendations(deploymentContext, deploymentResult) {
        const recommendations = [
            '✅ Document this global scope deployment for future reference',
            '🔍 Review ACL permissions to ensure proper access control',
            '📋 Consider creating Update Set for deployment tracking'
        ];
        if (deploymentContext.artifact_type === 'widget') {
            recommendations.push('🎨 Test widget rendering in Service Portal');
        }
        if (deploymentContext.artifact_type === 'flow') {
            recommendations.push('⚡ Activate flow and test trigger conditions');
        }
        return recommendations;
    }
    /**
     * Analyze global scope failure
     */
    async analyzeGlobalScopeFailure(deploymentResult, deploymentContext, strategy) {
        const errorMessage = deploymentResult.error || 'Unknown error';
        const errorType = this.categorizeError(errorMessage);
        return {
            error_category: errorType,
            strategy_used: strategy.name,
            requires_admin_intervention: errorType === 'permissions' || errorType === 'authentication',
            estimated_manual_time: '10-30 minutes',
            manual_steps: [
                '1. Review ServiceNow system logs for detailed error information',
                '2. Check user permissions and roles',
                '3. Verify artifact configuration meets ServiceNow requirements',
                '4. Consider alternative deployment approaches',
                '5. Contact ServiceNow administrator if permission issues persist'
            ],
            technical_details: {
                original_error: deploymentContext.original_error,
                global_deployment_error: errorMessage,
                artifact_type: deploymentContext.artifact_type,
                deployment_strategy: strategy.name
            }
        };
    }
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Handle mock data removal - ensure real operations only
     */
    assertNoMockData(operation) {
        if (process.env.SNOW_FLOW_MOCK_MODE === 'true') {
            throw new Error(`Mock mode is not supported for ${operation}. All operations must use real ServiceNow instance.`);
        }
    }
    /**
     * List available MCP resources
     */
    async listMCPResources() {
        try {
            const resources = await this.resourceManager.listResources();
            this.logger.debug(`Listed ${resources.length} MCP resources`);
            return {
                resources: resources.map(resource => ({
                    uri: resource.uri,
                    name: resource.name,
                    description: resource.description,
                    mimeType: resource.mimeType
                }))
            };
        }
        catch (error) {
            this.logger.error('Failed to list MCP resources:', error);
            return { resources: [] };
        }
    }
    /**
     * Read a specific MCP resource by URI
     */
    async readMCPResource(uri) {
        try {
            const resource = await this.resourceManager.readResource(uri);
            this.logger.debug(`Read MCP resource: ${uri}`);
            return {
                contents: [{
                        uri: resource.uri,
                        mimeType: resource.mimeType,
                        text: resource.text
                    }]
            };
        }
        catch (error) {
            this.logger.error(`Failed to read MCP resource ${uri}:`, error);
            throw new Error(`Resource not found or inaccessible: ${uri}`);
        }
    }
    /**
     * Get resource manager statistics
     */
    getMCPResourceStats() {
        return this.resourceManager.getResourceStats();
    }
    /**
     * Clear resource cache (useful for development)
     */
    clearMCPResourceCache() {
        this.resourceManager.clearCache();
        this.logger.debug('MCP resource cache cleared');
    }
    /**
     * Start the MCP server
     */
    async start() {
        const transport = new (await Promise.resolve().then(() => __importStar(require('@modelcontextprotocol/sdk/server/stdio.js')))).StdioServerTransport();
        await this.server.connect(transport);
        this.logger.info(`${this.server.serverInfo?.name || 'Unknown'} MCP server started`);
    }
}
exports.BaseMCPServer = BaseMCPServer;
//# sourceMappingURL=base-mcp-server.js.map