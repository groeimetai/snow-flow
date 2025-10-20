"use strict";
/**
 * MCP Execution Bridge
 *
 * Bridges the gap between agent recommendations and actual MCP tool execution
 * Enables Queen Agent and specialized agents to directly execute ServiceNow operations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPExecutionBridge = void 0;
const eventemitter3_1 = require("eventemitter3");
const snow_oauth_js_1 = require("../utils/snow-oauth.js");
const queen_memory_js_1 = require("./queen-memory.js");
const logger_js_1 = require("../utils/logger.js");
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
const child_process_1 = require("child_process");
/**
 * Maps agent recommendations to MCP tool calls and executes them
 */
class MCPExecutionBridge extends eventemitter3_1.EventEmitter {
    constructor(memory) {
        super();
        this.mcpClients = new Map();
        this.mcpProcesses = new Map();
        // MCP server configurations
        this.serverConfigs = new Map([
            ['deployment', {
                    name: 'servicenow-deployment',
                    command: 'node',
                    args: ['dist/mcp/servicenow-deployment-mcp.js']
                }],
            ['intelligent', {
                    name: 'servicenow-intelligent',
                    command: 'node',
                    args: ['dist/mcp/servicenow-intelligent-mcp.js']
                }],
            ['operations', {
                    name: 'servicenow-operations',
                    command: 'node',
                    args: ['dist/mcp/servicenow-operations-mcp.js']
                }],
            ['update-set', {
                    name: 'servicenow-update-set',
                    command: 'node',
                    args: ['dist/mcp/servicenow-update-set-mcp.js']
                }],
        ]);
        // Tool to server mapping
        this.toolServerMap = new Map([
            // Deployment tools
            ['snow_deploy', 'deployment'],
            ['snow_deploy_widget', 'deployment'],
            ['snow_deploy_flow', 'deployment'],
            ['snow_preview_widget', 'deployment'],
            ['snow_widget_test', 'deployment'],
            // Intelligent tools
            ['snow_find_artifact', 'intelligent'],
            ['snow_edit_artifact', 'intelligent'],
            ['snow_comprehensive_search', 'intelligent'],
            ['snow_analyze_requirements', 'intelligent'],
            // Operations tools
            ['snow_catalog_item_search', 'operations'],
            ['snow_test_flow_with_mock', 'operations'],
            ['snow_link_catalog_to_flow', 'operations'],
            // Update set tools
            ['snow_update_set_create', 'update-set'],
            ['snow_update_set_switch', 'update-set'],
            ['snow_update_set_add_artifact', 'update-set'],
        ]);
        this.sessionAuth = new snow_oauth_js_1.ServiceNowOAuth();
        this.memory = memory || new queen_memory_js_1.QueenMemorySystem();
        this.logger = new logger_js_1.Logger('MCPExecutionBridge');
    }
    /**
     * Execute an agent recommendation by calling the appropriate MCP tool
     */
    async executeAgentRecommendation(agent, recommendation) {
        const startTime = Date.now();
        try {
            this.logger.info(`Executing recommendation from ${agent.type} agent:`, {
                tool: recommendation.tool,
                action: recommendation.action,
                confidence: recommendation.confidence
            });
            // 1. Map recommendation to MCP tool
            const toolMapping = await this.mapRecommendationToTool(recommendation);
            // 2. Ensure MCP client is connected
            const client = await this.ensureMCPClient(toolMapping.server);
            // 3. Execute tool with session authentication
            const toolResult = await this.executeToolWithAuth(client, toolMapping.tool, toolMapping.params);
            // 4. Store result in shared memory for other agents
            await this.storeExecutionResult(agent.id, recommendation, toolResult);
            // 5. Emit execution event for monitoring
            this.emit('execution:complete', {
                agent,
                recommendation,
                result: toolResult,
                executionTime: Date.now() - startTime
            });
            return {
                success: true,
                recommendation,
                toolResult: toolResult.result,
                executionTime: Date.now() - startTime
            };
        }
        catch (error) {
            this.logger.error('Execution failed:', error);
            // Try fallback strategies
            const fallbackResult = await this.tryFallbackStrategies(agent, recommendation, error);
            if (fallbackResult.success) {
                return fallbackResult;
            }
            // Store failure for learning
            await this.storeExecutionFailure(agent.id, recommendation, error);
            return {
                success: false,
                recommendation,
                error: error instanceof Error ? error.message : 'Unknown error',
                executionTime: Date.now() - startTime,
                fallbackUsed: true
            };
        }
    }
    /**
     * Map agent recommendation to specific MCP tool
     */
    async mapRecommendationToTool(recommendation) {
        // Direct tool mapping if specified
        if (recommendation.tool && recommendation.server) {
            return {
                server: recommendation.server,
                tool: recommendation.tool,
                params: recommendation.params
            };
        }
        // Intelligent mapping based on action
        const mapping = await this.intelligentToolMapping(recommendation);
        // Store mapping decision for learning
        await this.memory.store(`tool_mapping_${Date.now()}`, {
            recommendation,
            mapping,
            timestamp: new Date().toISOString()
        });
        return mapping;
    }
    /**
     * Intelligent tool mapping based on action description
     */
    async intelligentToolMapping(recommendation) {
        const action = recommendation.action.toLowerCase();
        // Widget-related actions
        if (action.includes('widget') || action.includes('portal')) {
            if (action.includes('deploy') || action.includes('create')) {
                return {
                    server: 'deployment',
                    tool: 'snow_deploy',
                    params: { type: 'widget', config: recommendation.params }
                };
            }
            if (action.includes('test')) {
                return {
                    server: 'deployment',
                    tool: 'snow_widget_test',
                    params: recommendation.params
                };
            }
        }
        // Flow-related actions (testing only - creation not supported)
        if (action.includes('flow') || action.includes('workflow')) {
            if (action.includes('test')) {
                return {
                    server: 'operations',
                    tool: 'snow_test_flow_with_mock',
                    params: recommendation.params
                };
            }
        }
        // Search/discovery actions
        if (action.includes('find') || action.includes('search') || action.includes('discover')) {
            return {
                server: 'intelligent',
                tool: 'snow_find_artifact',
                params: {
                    query: recommendation.params.query || recommendation.action,
                    type: recommendation.params.type || 'any'
                }
            };
        }
        // Update set actions
        if (action.includes('update set') || action.includes('track')) {
            if (action.includes('create')) {
                return {
                    server: 'update-set',
                    tool: 'snow_update_set_create',
                    params: recommendation.params
                };
            }
            if (action.includes('add') || action.includes('track')) {
                return {
                    server: 'update-set',
                    tool: 'snow_update_set_add_artifact',
                    params: recommendation.params
                };
            }
        }
        // Default fallback - try intelligent search
        return {
            server: 'intelligent',
            tool: 'snow_find_artifact',
            params: {
                query: recommendation.action,
                type: 'any'
            }
        };
    }
    /**
     * Ensure MCP client is connected and ready
     */
    async ensureMCPClient(serverName) {
        // Check if client already exists and is connected
        const existingClient = this.mcpClients.get(serverName);
        if (existingClient) {
            return existingClient;
        }
        // Get server configuration
        const config = this.serverConfigs.get(serverName);
        if (!config) {
            throw new Error(`Unknown MCP server: ${serverName}`);
        }
        // Spawn MCP server process
        const serverProcess = (0, child_process_1.spawn)(config.command, config.args || [], {
            env: { ...process.env, ...config.env },
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.mcpProcesses.set(serverName, serverProcess);
        // Create MCP client
        const transport = new stdio_js_1.StdioClientTransport({
            command: config.command,
            args: config.args,
            env: { ...process.env, ...config.env },
        });
        const client = new index_js_1.Client({
            name: `queen-agent-${serverName}`,
            version: '1.0.0',
        }, {
            capabilities: {}
        });
        // Connect to server
        await client.connect(transport);
        // Store client
        this.mcpClients.set(serverName, client);
        this.logger.info(`Connected to MCP server: ${serverName}`);
        return client;
    }
    /**
     * Execute tool with authentication
     */
    async executeToolWithAuth(client, tool, params) {
        // Ensure we have valid authentication
        const isAuthenticated = await this.sessionAuth.isAuthenticated();
        if (!isAuthenticated) {
            throw new Error('Not authenticated with ServiceNow. Run "snow-flow auth login" first.');
        }
        // Call the tool
        const result = await client.callTool({
            name: tool,
            arguments: params
        });
        return result;
    }
    /**
     * Store execution result in shared memory
     */
    async storeExecutionResult(agentId, recommendation, result) {
        const executionRecord = {
            agentId,
            recommendation,
            result,
            timestamp: new Date().toISOString(),
            success: true
        };
        // Store in memory for coordination
        await this.memory.store(`execution_${agentId}_${Date.now()}`, executionRecord);
        // Update agent progress
        await this.memory.storeProgress(agentId, {
            lastExecution: executionRecord,
            totalExecutions: await this.getAgentExecutionCount(agentId) + 1
        });
    }
    /**
     * Store execution failure for learning
     */
    async storeExecutionFailure(agentId, recommendation, error) {
        const failureRecord = {
            agentId,
            recommendation,
            error: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
            success: false
        };
        // Store failure for pattern analysis
        await this.memory.store(`failure_${agentId}_${Date.now()}`, failureRecord);
        // Update failure patterns
        await this.memory.storeFailurePattern({
            tool: recommendation.tool,
            action: recommendation.action,
            errorType: this.classifyError(error),
            frequency: 1
        });
    }
    /**
     * Try fallback strategies when primary execution fails
     */
    async tryFallbackStrategies(agent, recommendation, error) {
        const strategies = [
            this.tryAlternativeTool.bind(this),
            this.trySimplifiedParams.bind(this),
            this.tryManualSteps.bind(this)
        ];
        for (const strategy of strategies) {
            try {
                const result = await strategy(agent, recommendation, error);
                if (result.success) {
                    this.logger.info('Fallback strategy succeeded:', strategy.name);
                    return result;
                }
            }
            catch (strategyError) {
                this.logger.warn(`Fallback strategy ${strategy.name} failed:`, strategyError);
            }
        }
        return {
            success: false,
            recommendation,
            error: 'All fallback strategies failed',
            executionTime: 0,
            fallbackUsed: true
        };
    }
    /**
     * Try using an alternative tool
     */
    async tryAlternativeTool(agent, recommendation, error) {
        // Map to alternative tools based on failure type
        const alternatives = {
            'snow_deploy': ['snow_deploy_widget', 'snow_deploy_flow'],
            'snow_create_flow': ['snow_flow_wizard', 'snow_deploy'],
            'snow_find_artifact': ['snow_comprehensive_search', 'snow_discover_existing_flows']
        };
        const altTools = alternatives[recommendation.tool];
        if (!altTools || altTools.length === 0) {
            throw new Error('No alternative tools available');
        }
        // Try first alternative
        const altTool = altTools[0];
        const altRecommendation = {
            ...recommendation,
            tool: altTool,
            params: this.adaptParamsForTool(recommendation.params, altTool)
        };
        return this.executeAgentRecommendation(agent, altRecommendation);
    }
    /**
     * Try with simplified parameters
     */
    async trySimplifiedParams(agent, recommendation, error) {
        // Simplify complex params
        const simplifiedParams = this.simplifyParams(recommendation.params);
        const simplifiedRecommendation = {
            ...recommendation,
            params: simplifiedParams
        };
        return this.executeAgentRecommendation(agent, simplifiedRecommendation);
    }
    /**
     * Generate manual steps as fallback
     */
    async tryManualSteps(agent, recommendation, error) {
        // Generate manual steps based on recommendation
        const manualSteps = this.generateManualSteps(recommendation);
        return {
            success: true,
            recommendation,
            toolResult: {
                type: 'manual_steps',
                steps: manualSteps,
                reason: 'Automated execution failed, manual steps provided'
            },
            executionTime: 0,
            fallbackUsed: true
        };
    }
    /**
     * Helper methods
     */
    async getAgentExecutionCount(agentId) {
        const progress = await this.memory.getProgress(agentId);
        return progress?.totalExecutions || 0;
    }
    classifyError(error) {
        if (!error)
            return 'unknown';
        const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        if (message.includes('auth') || message.includes('401') || message.includes('403')) {
            return 'authentication';
        }
        if (message.includes('timeout')) {
            return 'timeout';
        }
        if (message.includes('not found') || message.includes('404')) {
            return 'not_found';
        }
        if (message.includes('permission') || message.includes('access')) {
            return 'permission';
        }
        if (message.includes('rate limit')) {
            return 'rate_limit';
        }
        return 'general';
    }
    adaptParamsForTool(params, newTool) {
        // Adapt parameters for different tool format
        const adaptations = {
            'snow_deploy_widget': (p) => ({
                name: p.name || p.config?.name,
                title: p.title || p.config?.title,
                template: p.template || p.config?.template || '<div>Widget</div>',
                css: p.css || p.config?.css || '',
                client_script: p.client_script || p.config?.client_script || '',
                server_script: p.server_script || p.config?.server_script || ''
            }),
            'snow_comprehensive_search': (p) => ({
                query: p.query || p.name || p.description,
                include_inactive: false
            })
        };
        const adapter = adaptations[newTool];
        return adapter ? adapter(params) : params;
    }
    simplifyParams(params) {
        // Remove optional fields and complex nested structures
        const simplified = {};
        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null) {
                if (typeof value === 'object' && !Array.isArray(value)) {
                    // Flatten nested objects
                    simplified[key] = JSON.stringify(value);
                }
                else if (Array.isArray(value) && value.length > 5) {
                    // Limit array size
                    simplified[key] = value.slice(0, 5);
                }
                else {
                    simplified[key] = value;
                }
            }
        }
        return simplified;
    }
    generateManualSteps(recommendation) {
        const action = recommendation.action.toLowerCase();
        if (action.includes('widget')) {
            return [
                '1. Navigate to Service Portal > Widgets',
                '2. Click "New" to create a widget',
                `3. Set name to: ${recommendation.params.name || 'custom_widget'}`,
                '4. Add HTML template, CSS, and scripts as needed',
                '5. Save and test the widget',
                '6. Add widget to a portal page'
            ];
        }
        if (action.includes('flow')) {
            return [
                '1. Navigate to Flow Designer',
                '2. Click "New" > "Flow"',
                `3. Set name to: ${recommendation.params.name || 'custom_flow'}`,
                '4. Configure trigger conditions',
                '5. Add flow steps and actions',
                '6. Test and activate the flow'
            ];
        }
        return [
            '1. Log in to ServiceNow instance',
            `2. Execute action: ${recommendation.action}`,
            '3. Use parameters provided in the recommendation',
            '4. Test the implementation',
            '5. Document the changes'
        ];
    }
    /**
     * Cleanup resources
     */
    async cleanup() {
        // Disconnect all clients
        for (const [name, client] of this.mcpClients) {
            try {
                await client.close();
                this.logger.info(`Disconnected from MCP server: ${name}`);
            }
            catch (error) {
                this.logger.error(`Error disconnecting from ${name}:`, error);
            }
        }
        // Terminate all processes
        for (const [name, process] of this.mcpProcesses) {
            try {
                process.kill('SIGTERM');
                this.logger.info(`Terminated MCP server process: ${name}`);
            }
            catch (error) {
                this.logger.error(`Error terminating ${name}:`, error);
            }
        }
        this.mcpClients.clear();
        this.mcpProcesses.clear();
    }
    /**
     * Disconnect from MCP resources
     */
    async disconnect() {
        this.logger.info('Disconnecting MCP resources');
        // Clean up any active connections or resources
    }
    /**
     * Public shutdown method for cleanup
     */
    async shutdown() {
        this.logger.info('Shutting down MCP Execution Bridge');
        await this.disconnect();
    }
}
exports.MCPExecutionBridge = MCPExecutionBridge;
//# sourceMappingURL=mcp-execution-bridge.js.map