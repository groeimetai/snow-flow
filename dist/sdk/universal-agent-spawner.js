"use strict";
/**
 * Universal Agent Spawner - OpenCode Compatible
 * Uses Vercel AI SDK instead of Claude Agent SDK for true multi-model support
 *
 * Purpose:
 * - Replace Claude Agent SDK with provider-agnostic Vercel AI SDK
 * - Support ANY LLM via LiteLLM proxy
 * - Integrate MCP tools manually (no auto-discovery)
 * - Provide same interface as ClaudeAgentSDKIntegration for backward compatibility
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
exports.UniversalAgentSpawner = void 0;
const logger_js_1 = require("../utils/logger.js");
const events_1 = require("events");
// BYOLLM: Import provider factory for multi-LLM support
const providers_js_1 = require("../llm/providers.js");
const llm_config_loader_js_1 = require("../config/llm-config-loader.js");
// MCP: Import tool manager
const mcp_tool_manager_js_1 = require("../mcp/mcp-tool-manager.js");
/**
 * Universal Agent Spawner - Vercel AI SDK Based
 * TRUE BYOLLM support - works with ANY LLM provider via LiteLLM
 */
class UniversalAgentSpawner extends events_1.EventEmitter {
    constructor(memory, llmConfig) {
        super();
        this.activeAgents = new Map();
        this.mcpInitialized = false;
        this.memory = memory;
        this.logger = new logger_js_1.Logger('UniversalAgentSpawner');
        this.llmConfig = llmConfig;
        this.mcpToolManager = new mcp_tool_manager_js_1.MCPToolManager();
    }
    /**
     * Initialize MCP servers (call this once before spawning agents)
     */
    async initialize() {
        if (this.mcpInitialized) {
            this.logger.debug('MCP already initialized');
            return;
        }
        this.logger.info('🚀 Initializing MCP Tool Manager...');
        const configs = (0, mcp_tool_manager_js_1.getDefaultMCPServerConfigs)();
        await this.mcpToolManager.connectToServers(configs);
        this.mcpInitialized = true;
        this.logger.info(`✅ MCP initialized with ${this.mcpToolManager.getToolNames().length} tools`);
    }
    /**
     * Spawn agent using Vercel AI SDK (replaces Claude Agent SDK)
     *
     * Before: Claude Agent SDK query() - Claude models only
     * After: Vercel AI SDK generateText() - ANY model via LiteLLM
     */
    async spawnAgent(config) {
        const agentId = this.generateAgentId(config.type);
        const startTime = Date.now();
        // BYOLLM: Determine which model to use (priority: config > llmConfig > env > default)
        const effectiveLLMConfig = this.llmConfig || (0, llm_config_loader_js_1.loadSnowFlowConfig)().llm;
        const providerToUse = config.provider || effectiveLLMConfig?.provider || 'litellm';
        const modelToUse = config.model || effectiveLLMConfig?.model || 'claude-sonnet-3.5';
        const baseURL = effectiveLLMConfig?.baseURL || process.env.LITELLM_PROXY_URL || 'http://localhost:4000';
        this.logger.info(`🚀 Spawning ${config.type} agent`);
        this.logger.info(`   Provider: ${providerToUse}`);
        this.logger.info(`   Model: ${modelToUse}`);
        if (providerToUse === 'litellm') {
            this.logger.info(`   Proxy: ${baseURL}`);
        }
        this.emit('agent:spawning', { agentId, type: config.type, provider: providerToUse, model: modelToUse });
        try {
            // Build agent instructions with Snow-Flow context
            const instructions = this.buildAgentInstructions(config);
            // Get LLM model via provider factory
            const model = (0, providers_js_1.getModel)({
                provider: providerToUse,
                model: modelToUse,
                baseURL: baseURL,
                apiKeyEnv: effectiveLLMConfig?.apiKeyEnv
            });
            // Get MCP tools (TODO: Implement MCPToolManager)
            const tools = this.buildMCPTools();
            // Build messages array (CoreMessage type resolved at runtime)
            const messages = [
                {
                    role: 'user',
                    content: instructions
                }
            ];
            this.logger.info(`🤖 Executing agent with Vercel AI SDK...`);
            this.logger.info(`   Max turns: ${config.maxTurns || 10}`);
            this.logger.info(`   Tools available: ${Object.keys(tools).length}`);
            // Execute agent via Vercel AI SDK (dynamic import for ESM compatibility)
            const ai = await Promise.resolve().then(() => __importStar(require('ai')));
            const result = await ai.generateText({
                model,
                messages,
                tools,
                maxSteps: config.maxTurns || 10,
                temperature: 1.0,
                onStepFinish: (step) => {
                    this.logger.debug(`Step ${step.stepNumber} completed`);
                    this.emit('agent:step', {
                        agentId,
                        stepNumber: step.stepNumber,
                        finishReason: step.finishReason
                    });
                }
            });
            // Process execution result
            const executionResult = await this.processAgentExecution(agentId, config.type, result, startTime, providerToUse, modelToUse);
            this.logger.info(`✅ Agent ${agentId} completed successfully`);
            this.logger.info(`   Tokens used: ${executionResult.tokensUsed.total}`);
            if (executionResult.cost) {
                this.logger.info(`   Estimated cost: $${executionResult.cost.toFixed(4)}`);
            }
            this.emit('agent:completed', executionResult);
            return executionResult;
        }
        catch (error) {
            this.logger.error(`❌ Agent ${agentId} failed:`, error);
            this.emit('agent:failed', { agentId, type: config.type, error });
            return {
                success: false,
                agentId,
                agentType: config.type,
                artifacts: [],
                output: error instanceof Error ? error.message : String(error),
                tokensUsed: { input: 0, output: 0, total: 0 },
                duration: Date.now() - startTime,
                error: error,
                providerUsed: providerToUse,
                modelUsed: modelToUse
            };
        }
        finally {
            this.activeAgents.delete(agentId);
        }
    }
    /**
     * Build agent instructions with Snow-Flow context
     */
    buildAgentInstructions(config) {
        const instructions = `You are a specialized ${config.type} agent in the Snow-Flow multi-agent framework.

# Your Mission
${config.objective}

# Agent Specialization
Type: ${config.type}
Capabilities: ${this.getAgentCapabilities(config.type)}

# Available Tools
You have access to 411 ServiceNow tools via MCP (Model Context Protocol):
- ServiceNow Operations (235+ tools): CRUD, queries, deployments, testing
- Snow-Flow Orchestration (176+ tools): Neural networks, memory, coordination

# Instructions
1. Analyze the objective carefully
2. Break down into concrete steps
3. Use available tools to accomplish each step
4. Store learnings in shared memory using snow_memory_store
5. Report progress and results clearly
6. If blocked, explain why and suggest alternatives

# Context
${config.context ? JSON.stringify(config.context, null, 2) : 'No additional context provided'}

# Execution Guidelines
- Test before deploying (use snow_execute_script_with_output)
- Validate artifacts after creation
- Use background scripts for verification only (NOT for updates)
- Follow ServiceNow best practices (ES5 JavaScript, proper error handling)
- Store important findings in memory for other agents

Begin your work now. Focus on delivering tangible results.`;
        return instructions;
    }
    /**
     * Get agent-specific capabilities
     */
    getAgentCapabilities(type) {
        const capabilities = {
            'widget-creator': 'Creating ServiceNow Service Portal widgets with HTML, CSS, and JavaScript',
            'script-writer': 'Writing ServiceNow server-side scripts (Business Rules, Script Includes)',
            'tester': 'Testing ServiceNow artifacts, running validation scripts',
            'researcher': 'Analyzing ServiceNow configurations, discovering patterns',
            'flow-builder': 'Creating ServiceNow Flow Designer flows',
            'deployer': 'Deploying and managing ServiceNow artifacts',
            'security-reviewer': 'Reviewing ServiceNow security configurations',
            'performance-optimizer': 'Optimizing ServiceNow performance and queries'
        };
        return capabilities[type] || 'General ServiceNow development and analysis';
    }
    /**
     * Build MCP tools for Vercel AI SDK
     */
    buildMCPTools() {
        if (!this.mcpInitialized) {
            this.logger.warn('⚠️  MCP not initialized - no tools available');
            this.logger.info('   Call initialize() before spawning agents');
            return {};
        }
        return this.mcpToolManager.getToolsForAI();
    }
    /**
     * Process agent execution result
     */
    async processAgentExecution(agentId, agentType, result, startTime, provider, model) {
        const duration = Date.now() - startTime;
        // Extract artifacts from result (sys_ids created)
        const artifacts = this.extractArtifacts(result.text);
        // Calculate token usage
        const tokensUsed = {
            input: result.usage?.promptTokens || 0,
            output: result.usage?.completionTokens || 0,
            total: (result.usage?.promptTokens || 0) + (result.usage?.completionTokens || 0)
        };
        // Calculate cost (if cost information available)
        const cost = this.calculateCost(provider, model, tokensUsed);
        // Store in memory
        await this.memory.store(`agent_${agentId}_result`, {
            agentId,
            agentType,
            success: true,
            artifacts,
            tokensUsed,
            duration,
            timestamp: new Date().toISOString(),
            provider,
            model,
            cost
        });
        return {
            success: true,
            agentId,
            agentType,
            artifacts,
            output: result.text,
            tokensUsed,
            duration,
            providerUsed: provider,
            modelUsed: model,
            cost
        };
    }
    /**
     * Extract ServiceNow sys_ids from agent output
     */
    extractArtifacts(output) {
        const sysIdRegex = /[0-9a-f]{32}/g;
        const matches = output.match(sysIdRegex);
        return matches ? [...new Set(matches)] : [];
    }
    /**
     * Calculate cost for token usage
     */
    calculateCost(provider, model, tokensUsed) {
        // Cost per 1M tokens
        const pricing = {
            'claude-sonnet-3.5': { input: 3.0, output: 15.0 },
            'claude-haiku-3.5': { input: 0.8, output: 4.0 },
            'gpt-4o': { input: 2.5, output: 10.0 },
            'gpt-4o-mini': { input: 0.15, output: 0.60 },
            'gemini-pro': { input: 1.25, output: 5.0 },
            'gemini-flash': { input: 0.075, output: 0.30 },
            'deepseek-coder': { input: 0.14, output: 0.28 },
            'deepseek-chat': { input: 0.14, output: 0.28 },
            'llama-3.1': { input: 0, output: 0 },
            'llama-3.3': { input: 0, output: 0 },
            'qwen-2.5-coder': { input: 0, output: 0 }
        };
        const rates = pricing[model] || { input: 0, output: 0 };
        const inputCost = (tokensUsed.input / 1000000) * rates.input;
        const outputCost = (tokensUsed.output / 1000000) * rates.output;
        return inputCost + outputCost;
    }
    /**
     * Utility methods
     */
    generateAgentId(type) {
        return `universal_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Get active agent status
     */
    getActiveAgents() {
        return Array.from(this.activeAgents.keys());
    }
    /**
     * Interrupt agent (for graceful shutdown)
     */
    async interruptAgent(agentId) {
        if (this.activeAgents.has(agentId)) {
            this.logger.info(`⏹️ Interrupting agent ${agentId}`);
            this.activeAgents.delete(agentId);
            this.emit('agent:interrupted', { agentId });
            return true;
        }
        return false;
    }
    /**
     * Cleanup
     */
    async shutdown() {
        this.logger.info('🔌 Shutting down UniversalAgentSpawner...');
        // Interrupt all active agents
        for (const agentId of this.activeAgents.keys()) {
            await this.interruptAgent(agentId);
        }
        // Shutdown MCP connections
        if (this.mcpInitialized) {
            await this.mcpToolManager.shutdown();
        }
        this.activeAgents.clear();
        this.removeAllListeners();
        this.logger.info('✓ UniversalAgentSpawner shut down');
    }
}
exports.UniversalAgentSpawner = UniversalAgentSpawner;
//# sourceMappingURL=universal-agent-spawner.js.map