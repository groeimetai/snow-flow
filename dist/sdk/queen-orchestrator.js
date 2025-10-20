"use strict";
/**
 * Queen Orchestrator - Intelligence Layer
 * Replaces 1380-line QueenAgent with focused 400-line orchestrator
 *
 * Responsibilities:
 * - Objective analysis (KEEP from old QueenAgent)
 * - Parallelization strategy (KEEP - use ParallelAgentEngine)
 * - Progress monitoring (KEEP)
 * - Agent spawning (REPLACE - use ClaudeAgentSDKIntegration)
 *
 * What's Gone:
 * - Agent spawning logic (SDK handles this)
 * - Message passing (Memory handles this)
 * - Agent lifecycle management (SDK handles this)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueenOrchestrator = void 0;
const events_1 = require("events");
const claude_agent_sdk_integration_js_1 = require("./claude-agent-sdk-integration.js");
const parallel_agent_engine_js_1 = require("../queen/parallel-agent-engine.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Queen Orchestrator - Intelligence-Focused Architecture
 *
 * Before: 1380 lines managing everything
 * After: ~400 lines of pure intelligence
 */
class QueenOrchestrator extends events_1.EventEmitter {
    constructor(memory) {
        super();
        this.activeObjectives = new Map();
        this.memory = memory;
        this.logger = new logger_js_1.Logger('QueenOrchestrator');
        this.sdkIntegration = new claude_agent_sdk_integration_js_1.ClaudeAgentSDKIntegration(memory);
        this.parallelEngine = new parallel_agent_engine_js_1.ParallelAgentEngine(memory); // Type compatibility
        this.setupEventHandlers();
    }
    /**
     * Main orchestration entry point
     * Analyzes objective → Plans execution → Spawns agents → Monitors progress
     */
    async orchestrate(objective) {
        const startTime = Date.now();
        const queenObjective = typeof objective === 'string'
            ? { id: this.generateId(), description: objective }
            : objective;
        this.activeObjectives.set(queenObjective.id, queenObjective);
        this.emit('orchestration:started', queenObjective);
        try {
            // 1. ANALYZE: What needs to be done? (Intelligence)
            this.logger.info(`🧠 Analyzing objective: ${queenObjective.description}`);
            const analysis = await this.analyzeObjective(queenObjective);
            // 2. PLAN: Generate todos with dependencies (Intelligence)
            this.logger.info(`📋 Creating execution plan...`);
            const todos = this.generateTodos(queenObjective, analysis);
            // 3. STRATEGIZE: Detect parallelization opportunities (Intelligence)
            this.logger.info(`🚀 Analyzing parallelization strategy...`);
            const opportunities = await this.parallelEngine.detectParallelizationOpportunities(todos, analysis.type, [] // No active agents yet
            );
            // 4. EXECUTE: Spawn agents via SDK (Execution - Delegated)
            this.logger.info(`⚡ Spawning ${analysis.requiredAgents.length} agents...`);
            const agentResults = await this.executeStrategy(queenObjective, analysis, todos, opportunities);
            // 5. VERIFY: Check results and artifacts (Intelligence)
            const artifacts = this.extractArtifacts(agentResults);
            const success = agentResults.every(r => r.success);
            // Store orchestration result
            const result = {
                objectiveId: queenObjective.id,
                success,
                agentsSpawned: agentResults.length,
                artifactsCreated: artifacts,
                totalDuration: Date.now() - startTime,
                agentResults,
                todos
            };
            await this.memory.store(`orchestration_${queenObjective.id}`, result);
            this.emit('orchestration:completed', result);
            return result;
        }
        catch (error) {
            this.logger.error(`❌ Orchestration failed:`, error);
            this.emit('orchestration:failed', { objective: queenObjective, error });
            throw error;
        }
        finally {
            this.activeObjectives.delete(queenObjective.id);
        }
    }
    /**
     * INTELLIGENCE: Analyze objective to determine requirements
     * Kept from old QueenAgent - this is our domain expertise
     */
    async analyzeObjective(objective) {
        const description = objective.description.toLowerCase();
        let type = 'unknown';
        let requiredAgents = [];
        let estimatedComplexity = 5;
        const dependencies = [];
        // Portal page detection
        if ((description.includes('portal') && description.includes('page')) ||
            description.includes('portal page')) {
            type = 'portal_page';
            requiredAgents = ['widget-creator', 'page-designer', 'script-writer', 'tester'];
            if (description.includes('dashboard') || description.includes('multi')) {
                estimatedComplexity = 8;
                requiredAgents.push('ui-ux-specialist');
            }
        }
        // Widget development
        else if (description.includes('widget') || description.includes('ui component')) {
            type = 'widget';
            requiredAgents = ['widget-creator', 'script-writer', 'tester'];
            if (description.includes('complex') || description.includes('interactive')) {
                estimatedComplexity = 8;
                requiredAgents.push('ui-ux-specialist');
            }
        }
        // Workspace development
        else if (description.includes('workspace') || description.includes('agent workspace')) {
            type = 'workspace';
            requiredAgents = ['workspace-specialist', 'ui-builder-expert', 'tester'];
            estimatedComplexity = 7;
        }
        // Flow development
        else if (description.includes('flow') || description.includes('workflow')) {
            type = 'flow';
            requiredAgents = ['flow-builder', 'integration-specialist', 'tester'];
            if (description.includes('approval')) {
                dependencies.push('user_management', 'notification_system');
            }
        }
        // Application development
        else if (description.includes('application') || description.includes('app') || description.includes('complete solution')) {
            type = 'application';
            requiredAgents = ['app-architect', 'widget-creator', 'ui-builder-expert', 'script-writer', 'tester'];
            estimatedComplexity = 10;
        }
        // Script development
        else if (description.includes('script') || description.includes('business rule') || description.includes('api')) {
            type = 'script';
            requiredAgents = ['script-writer', 'tester'];
            if (description.includes('integration')) {
                requiredAgents.push('integration-specialist');
            }
        }
        // Integration development
        else if (description.includes('integration') || description.includes('connect') || description.includes('external')) {
            type = 'integration';
            requiredAgents = ['integration-specialist', 'script-writer', 'tester'];
            dependencies.push('authentication', 'data_transformation');
        }
        // Add security agent if mentioned
        if (description.includes('secure') || description.includes('security') || description.includes('permission')) {
            requiredAgents.push('security-specialist');
        }
        // Store analysis in Memory for coordination
        await this.memory.store(`analysis_${objective.id}`, {
            objective,
            analysis: { type, requiredAgents, estimatedComplexity, dependencies },
            timestamp: new Date().toISOString()
        });
        const suggestedPattern = {
            taskType: type === 'application' ? 'modular' : 'standard',
            successRate: 0.8,
            agentSequence: requiredAgents,
            mcpSequence: [],
            avgDuration: 300 * estimatedComplexity,
            lastUsed: new Date()
        };
        return {
            type,
            complexity: estimatedComplexity.toString(),
            requiredAgents: [...new Set(requiredAgents)],
            estimatedComplexity,
            suggestedPattern,
            dependencies
        };
    }
    /**
     * INTELLIGENCE: Generate todos based on objective analysis
     * Kept from old QueenAgent - domain expertise
     */
    generateTodos(objective, analysis) {
        const baseTodos = [
            {
                id: this.generateId(),
                content: `Initialize orchestration for: ${objective.description}`,
                status: 'pending',
                priority: 'high'
            },
            {
                id: this.generateId(),
                content: 'Validate ServiceNow authentication and permissions',
                status: 'pending',
                priority: 'high'
            },
            {
                id: this.generateId(),
                content: 'Ensure active Update Set for tracking changes',
                status: 'pending',
                priority: 'high'
            }
        ];
        // Add type-specific todos based on analysis
        switch (analysis.type) {
            case 'workspace':
                baseTodos.push({ id: this.generateId(), content: 'Design workspace architecture and tables', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Create workspace using snow_create_complete_workspace', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Configure workspace screens and components', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Test workspace functionality', status: 'pending', priority: 'high' });
                break;
            case 'widget':
                baseTodos.push({ id: this.generateId(), content: 'Design widget structure (HTML/Client/Server)', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Create widget using snow_create_sp_widget', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Validate widget coherence', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Test widget functionality', status: 'pending', priority: 'high' });
                break;
            case 'portal_page':
                baseTodos.push({ id: this.generateId(), content: 'Design portal page layout', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Create or identify widget for page', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Create portal page using snow_create_sp_page', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Place widget on page with proper layout', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Test page across devices', status: 'pending', priority: 'high' });
                break;
            default:
                baseTodos.push({ id: this.generateId(), content: `Analyze ${analysis.type} requirements`, status: 'pending', priority: 'high' }, { id: this.generateId(), content: `Implement ${analysis.type} solution`, status: 'pending', priority: 'high' }, { id: this.generateId(), content: `Test ${analysis.type} functionality`, status: 'pending', priority: 'high' });
        }
        // Add final validation todos
        baseTodos.push({ id: this.generateId(), content: 'Verify all artifacts in ServiceNow', status: 'pending', priority: 'high' }, { id: this.generateId(), content: 'Generate documentation', status: 'pending', priority: 'medium' });
        return baseTodos;
    }
    /**
     * EXECUTION: Execute strategy using SDK
     * SIMPLIFIED: Just spawn agents - SDK handles execution
     */
    async executeStrategy(objective, analysis, todos, opportunities) {
        // Build agent configurations
        const agentConfigs = analysis.requiredAgents.map(agentType => ({
            type: agentType,
            objective: objective.description,
            context: {
                objectiveId: objective.id,
                todos: todos.map(t => t.content),
                analysis
            },
            maxTurns: 15,
            memory: this.memory
        }));
        // Execute based on parallelization opportunities
        if (opportunities.length > 0 && agentConfigs.length > 1) {
            this.logger.info(`🚀 Executing ${agentConfigs.length} agents in parallel`);
            return await this.sdkIntegration.spawnParallelAgents(agentConfigs);
        }
        else {
            this.logger.info(`📋 Executing ${agentConfigs.length} agents sequentially`);
            const results = [];
            for (const config of agentConfigs) {
                const result = await this.sdkIntegration.spawnAgent(config);
                results.push(result);
            }
            return results;
        }
    }
    /**
     * INTELLIGENCE: Extract and deduplicate artifacts
     */
    extractArtifacts(results) {
        const allArtifacts = results.flatMap(r => r.artifacts);
        return [...new Set(allArtifacts)];
    }
    /**
     * INTELLIGENCE: Monitor progress (simplified)
     */
    async monitorProgress(objectiveId) {
        const orchestration = await this.memory.get?.(`orchestration_${objectiveId}`);
        if (!orchestration) {
            return { overall: 0, agentsActive: 0, artifactsCreated: 0 };
        }
        return {
            overall: orchestration.success ? 100 : 50,
            agentsActive: 0, // Completed
            artifactsCreated: orchestration.artifactsCreated.length
        };
    }
    /**
     * Setup event handlers for SDK integration
     */
    setupEventHandlers() {
        this.sdkIntegration.on('agent:spawning', ({ agentId, type }) => {
            this.logger.info(`🚀 Spawning ${type} agent: ${agentId}`);
        });
        this.sdkIntegration.on('agent:completed', (result) => {
            this.logger.info(`✅ Agent ${result.agentId} completed: ${result.artifacts.length} artifacts`);
        });
        this.sdkIntegration.on('agent:failed', ({ agentId, type, error }) => {
            this.logger.error(`❌ Agent ${agentId} (${type}) failed:`, error);
        });
        this.sdkIntegration.on('agent:tool-used', ({ agentId, toolName }) => {
            this.logger.debug(`🔧 Agent ${agentId} used tool: ${toolName}`);
        });
    }
    /**
     * Utility methods
     */
    generateId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Cleanup
     */
    async shutdown() {
        await this.sdkIntegration.shutdown();
        this.removeAllListeners();
        this.logger.info('✅ Queen Orchestrator shutdown complete');
    }
}
exports.QueenOrchestrator = QueenOrchestrator;
//# sourceMappingURL=queen-orchestrator.js.map