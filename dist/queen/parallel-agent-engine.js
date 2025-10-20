"use strict";
/**
 * Intelligent Parallel Agent Engine
 * Automatically detects parallelizable work and spawns optimized agent teams
 * Integrates with Queen Agent for enhanced multi-agent coordination
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
exports.ParallelAgentEngine = void 0;
const eventemitter3_1 = require("eventemitter3");
const logger_1 = require("../utils/logger");
const crypto = __importStar(require("crypto"));
class ParallelAgentEngine extends eventemitter3_1.EventEmitter {
    constructor(memory) {
        super();
        this.logger = new logger_1.Logger('ParallelAgentEngine');
        this.memory = memory;
        this.activeExecutionPlans = new Map();
        this.agentWorkloads = new Map();
        this.parallelizationHistory = new Map();
        this.initializeCapabilityMap();
        this.setupLearningSystem();
    }
    /**
     * Main entry point: Analyze todos and detect parallelization opportunities
     */
    async detectParallelizationOpportunities(todos, objectiveType, currentAgents) {
        this.logger.info('🧠 Analyzing parallelization opportunities', {
            todoCount: todos.length,
            objectiveType,
            currentAgentCount: currentAgents.length
        });
        const opportunities = [];
        // 1. Detect independent tasks (can run simultaneously)
        const independentOpportunity = await this.detectIndependentTasks(todos);
        if (independentOpportunity)
            opportunities.push(independentOpportunity);
        // 2. Detect specialized breakdown opportunities (split complex task)
        const specializedOpportunity = await this.detectSpecializedBreakdown(todos, objectiveType);
        if (specializedOpportunity)
            opportunities.push(specializedOpportunity);
        // 3. Detect load distribution opportunities (same type, multiple agents)
        const loadOpportunity = await this.detectLoadDistribution(todos, currentAgents);
        if (loadOpportunity)
            opportunities.push(loadOpportunity);
        // 4. Detect capability split opportunities (different skills needed)
        const capabilityOpportunity = await this.detectCapabilitySplit(todos);
        if (capabilityOpportunity)
            opportunities.push(capabilityOpportunity);
        // 🚀 ENHANCED: More lenient filtering to ensure parallel execution happens
        const rankedOpportunities = opportunities
            .filter(opp => opp.confidence > 0.5 && opp.estimatedSpeedup > 1.1) // Lower thresholds
            .sort((a, b) => (b.confidence * b.estimatedSpeedup) - (a.confidence * a.estimatedSpeedup));
        this.logger.info(`🎯 Found ${rankedOpportunities.length} high-confidence parallelization opportunities`, {
            totalOpportunities: opportunities.length,
            rankedCount: rankedOpportunities.length,
            averageConfidence: rankedOpportunities.reduce((sum, opp) => sum + opp.confidence, 0) / rankedOpportunities.length || 0
        });
        // Store opportunities for learning
        await this.storeOpportunities(todos, rankedOpportunities);
        return rankedOpportunities;
    }
    /**
     * Create optimal execution plan based on opportunities
     */
    async createExecutionPlan(opportunities, todos, maxAgents = 8) {
        const planId = this.generateId('plan');
        // Calculate optimal agent team
        const agentTeam = await this.calculateOptimalTeam(opportunities, todos, maxAgents);
        // Determine execution strategy
        const strategy = this.determineExecutionStrategy(opportunities, agentTeam);
        // Estimate completion time
        const estimatedCompletion = this.estimateCompletionTime(agentTeam, strategy);
        const plan = {
            planId,
            opportunities,
            agentTeam,
            executionStrategy: strategy,
            estimatedCompletion,
            maxParallelism: Math.min(agentTeam.length, maxAgents),
            failureRecovery: 'reassign'
        };
        this.activeExecutionPlans.set(planId, plan);
        this.logger.info(`📋 Created execution plan ${planId}`, {
            planId,
            strategy,
            teamSize: agentTeam.length,
            estimatedCompletion,
            maxParallelism: plan.maxParallelism,
            opportunityCount: opportunities.length
        });
        return plan;
    }
    /**
     * Execute parallel plan and coordinate agents
     */
    async executeParallelPlan(plan, spawnAgentCallback) {
        this.logger.info(`🚀 Executing parallel plan ${plan.planId}`, {
            planId: plan.planId,
            strategy: plan.executionStrategy,
            agentTeamSize: plan.agentTeam.length,
            maxParallelism: plan.maxParallelism
        });
        const spawnedAgents = [];
        // Spawn agents based on plan
        for (const workload of plan.agentTeam) {
            if (workload.agentId === 'new') {
                // Spawn new agent with specialization
                const specialization = this.determineAgentSpecialization(workload);
                const agent = await spawnAgentCallback(workload.agentType, specialization);
                spawnedAgents.push(agent);
                // Update workload with actual agent ID
                workload.agentId = agent.id;
                this.agentWorkloads.set(agent.id, workload);
            }
        }
        // Set up parallel coordination
        await this.setupParallelCoordination(plan, spawnedAgents);
        // Calculate speedup
        const sequentialTime = plan.agentTeam.reduce((sum, w) => sum + w.estimatedDuration, 0);
        const parallelTime = plan.estimatedCompletion;
        const actualSpeedup = sequentialTime / parallelTime;
        this.emit('parallel_execution_started', {
            planId: plan.planId,
            agentCount: spawnedAgents.length,
            estimatedSpeedup: actualSpeedup
        });
        return {
            spawnedAgents,
            executionDetails: {
                totalAgentsSpawned: spawnedAgents.length,
                parallelWorkflows: plan.opportunities.length,
                estimatedSpeedup: `${actualSpeedup.toFixed(1)}x faster`
            }
        };
    }
    /**
     * Detect independent tasks that can run in parallel
     */
    async detectIndependentTasks(todos) {
        const independentGroups = [];
        const processed = new Set();
        for (const todo of todos) {
            if (processed.has(todo.id))
                continue;
            const group = [todo.id];
            processed.add(todo.id);
            // Find todos that can run with this one
            for (const otherTodo of todos) {
                if (processed.has(otherTodo.id))
                    continue;
                if (this.areTasksIndependent(todo, otherTodo)) {
                    group.push(otherTodo.id);
                    processed.add(otherTodo.id);
                }
            }
            if (group.length > 1) {
                independentGroups.push(group);
            }
        }
        if (independentGroups.length === 0)
            return null;
        // Find the largest independent group
        const largestGroup = independentGroups.reduce((max, group) => group.length > max.length ? group : max);
        return {
            id: this.generateId('independent'),
            type: 'independent_tasks',
            todos: largestGroup,
            suggestedAgents: this.suggestAgentsForTodos(largestGroup, todos),
            estimatedSpeedup: largestGroup.length * 0.8, // Account for coordination overhead
            confidence: 0.9, // High confidence for independent tasks
            dependencies: [],
            blockers: []
        };
    }
    /**
     * Detect opportunities to break down complex tasks into specialized agents
     */
    async detectSpecializedBreakdown(todos, objectiveType) {
        // 🚀 ENHANCED: More intelligent detection of tasks that benefit from specialization
        const canBenefitFromSpecialization = todos.filter(todo => {
            const content = todo.content.toLowerCase();
            // Widget development indicators
            if (content.includes('widget') || content.includes('portal') || content.includes('ui')) {
                return true;
            }
            // Development indicators
            if (content.includes('develop') || content.includes('create') || content.includes('build')) {
                return true;
            }
            // Multiple component indicators
            if (content.includes('and') || content.includes('with') || content.includes('including')) {
                return true;
            }
            // Complex task indicators
            if (todo.priority === 'high' || todo.priority === 'medium') {
                return true;
            }
            // Any development-related task benefits from specialization
            if (content.includes('test') || content.includes('style') || content.includes('script')) {
                return true;
            }
            return false;
        });
        // 🚀 Be more aggressive - even single development tasks benefit from parallel specialists
        if (canBenefitFromSpecialization.length === 0 && todos.length > 0) {
            // If no specific indicators, but we have todos, still try to parallelize
            canBenefitFromSpecialization.push(...todos.slice(0, Math.min(3, todos.length)));
        }
        if (canBenefitFromSpecialization.length === 0)
            return null;
        // 🚀 ENHANCED: More specialized agent teams with specific roles
        const breakdownMap = {
            'widget': [
                'widget-creator', // HTML structure specialist
                'css-specialist', // Styling and responsive design specialist
                'backend-specialist', // Server script specialist
                'frontend-specialist', // Client script specialist
                'integration-specialist', // API integration specialist
                'ui-ux-specialist', // User experience specialist
                'performance-specialist', // Performance optimization
                'accessibility-specialist', // Accessibility compliance
                'tester' // Testing specialist
            ],
            'flow': [
                'flow-builder', // Flow structure specialist
                'trigger-specialist', // Trigger configuration specialist
                'action-specialist', // Action development specialist
                'integration-specialist', // External system integration
                'approval-specialist', // Approval process specialist
                'notification-specialist', // Notification configuration
                'error-handler', // Error handling specialist
                'tester' // Flow testing specialist
            ],
            'application': [
                'app-architect', // Application architecture
                'widget-creator', // UI components
                'css-specialist', // Styling specialist
                'flow-builder', // Business logic flows
                'script-writer', // Script includes and business rules
                'security-specialist', // Security implementation
                'integration-specialist', // System integration
                'performance-specialist', // Performance optimization
                'documentation-specialist', // Documentation
                'tester' // Comprehensive testing
            ],
            'script': [
                'script-writer', // Core script development
                'api-specialist', // API integration specialist
                'performance-specialist', // Code optimization
                'security-specialist', // Security review
                'documentation-specialist', // Code documentation
                'tester' // Script testing
            ],
            'integration': [
                'integration-specialist', // Core integration
                'api-specialist', // API development
                'transform-specialist', // Data transformation
                'error-handler', // Error handling
                'monitoring-specialist', // Integration monitoring
                'security-specialist', // Security implementation
                'tester' // Integration testing
            ]
        };
        // Select appropriate specialists based on task
        let suggestedAgents = breakdownMap[objectiveType] || breakdownMap['widget'];
        // 🚀 Limit to reasonable number but ensure good coverage
        const maxSpecialists = Math.min(8, Math.max(4, canBenefitFromSpecialization.length * 2));
        suggestedAgents = suggestedAgents.slice(0, maxSpecialists);
        const todoIds = canBenefitFromSpecialization.map(t => t.id);
        return {
            id: this.generateId('specialized'),
            type: 'specialized_breakdown',
            todos: todoIds,
            suggestedAgents: suggestedAgents,
            estimatedSpeedup: Math.min(3.5, 1.5 + (suggestedAgents.length * 0.3)), // More realistic speedup
            confidence: 0.85, // Higher confidence for specialization benefits
            dependencies: [],
            blockers: []
        };
    }
    /**
     * Detect load distribution opportunities (same work type, multiple agents)
     */
    async detectLoadDistribution(todos, currentAgents) {
        // Group todos by capability requirement
        const todoGroups = new Map();
        for (const todo of todos) {
            const capability = this.inferTodoCapability(todo);
            if (!todoGroups.has(capability)) {
                todoGroups.set(capability, []);
            }
            todoGroups.get(capability).push(todo.id);
        }
        // Find groups with multiple todos that can be distributed
        for (const [capability, todoIds] of todoGroups) {
            if (todoIds.length >= 3) { // Worth distributing if 3+ similar tasks
                const agentType = this.capabilityToAgentType(capability);
                return {
                    id: this.generateId('load'),
                    type: 'load_distribution',
                    todos: todoIds,
                    suggestedAgents: [agentType, agentType, agentType], // Multiple agents of same type
                    estimatedSpeedup: Math.min(todoIds.length, 3) * 0.75, // Account for coordination
                    confidence: 0.85,
                    dependencies: [],
                    blockers: []
                };
            }
        }
        return null;
    }
    /**
     * Detect capability split opportunities (different skills for different parts)
     */
    async detectCapabilitySplit(todos) {
        const capabilityGroups = new Map();
        // Group todos by required capabilities
        for (const todo of todos) {
            const capabilities = this.analyzeTodoCapabilities(todo);
            for (const capability of capabilities) {
                if (!capabilityGroups.has(capability)) {
                    capabilityGroups.set(capability, []);
                }
                capabilityGroups.get(capability).push(todo.id);
            }
        }
        // If we have multiple capability groups, we can split
        if (capabilityGroups.size >= 2) {
            const allTodos = Array.from(new Set(Array.from(capabilityGroups.values()).flat()));
            const agentTypes = Array.from(capabilityGroups.keys())
                .map(cap => this.capabilityToAgentType(cap));
            return {
                id: this.generateId('capability'),
                type: 'capability_split',
                todos: allTodos,
                suggestedAgents: agentTypes,
                estimatedSpeedup: 1.8,
                confidence: 0.75,
                dependencies: [],
                blockers: []
            };
        }
        return null;
    }
    /**
     * Calculate optimal agent team for execution plan
     */
    async calculateOptimalTeam(opportunities, todos, maxAgents) {
        const team = [];
        const usedAgentTypes = new Set();
        for (const opportunity of opportunities) {
            for (const agentType of opportunity.suggestedAgents) {
                if (team.length >= maxAgents)
                    break;
                // Avoid duplicate agent types unless it's load distribution
                if (usedAgentTypes.has(agentType) && opportunity.type !== 'load_distribution') {
                    continue;
                }
                const workload = {
                    agentId: 'new', // Will be assigned when spawned
                    agentType,
                    assignedTodos: opportunity.todos.filter(todoId => this.todoRequiresAgentType(todoId, agentType, todos)),
                    estimatedDuration: this.estimateTodoDuration(opportunity.todos, todos),
                    utilization: 0.8, // Start at 80% utilization
                    capabilities: this.getAgentCapabilities(agentType),
                    specializations: this.getAgentSpecializations(agentType, opportunity.type)
                };
                team.push(workload);
                usedAgentTypes.add(agentType);
            }
        }
        return team;
    }
    /**
     * Determine execution strategy based on opportunities and team
     */
    determineExecutionStrategy(opportunities, agentTeam) {
        const hasIndependent = opportunities.some(o => o.type === 'independent_tasks');
        const hasSpecialized = opportunities.some(o => o.type === 'specialized_breakdown');
        const hasLoadDistribution = opportunities.some(o => o.type === 'load_distribution');
        if (hasIndependent && hasSpecialized) {
            return 'hybrid'; // Mix of parallel and sequential
        }
        else if (hasLoadDistribution) {
            return 'concurrent'; // All agents work simultaneously
        }
        else if (hasSpecialized) {
            return 'pipeline'; // Sequential handoffs between specialists
        }
        else {
            return 'wave_based'; // Waves of parallel execution
        }
    }
    /**
     * Estimate completion time for agent team
     */
    estimateCompletionTime(agentTeam, strategy) {
        const coordinationOverhead = agentTeam.length * 2; // 2 minutes per agent for coordination
        switch (strategy) {
            case 'concurrent':
                return Math.max(...agentTeam.map(w => w.estimatedDuration)) + coordinationOverhead;
            case 'pipeline':
                return agentTeam.reduce((sum, w) => sum + w.estimatedDuration, 0) * 0.7 + coordinationOverhead;
            case 'wave_based':
                const avgDuration = agentTeam.reduce((sum, w) => sum + w.estimatedDuration, 0) / agentTeam.length;
                return avgDuration * 1.5 + coordinationOverhead;
            case 'hybrid':
                return agentTeam.reduce((sum, w) => sum + w.estimatedDuration, 0) * 0.6 + coordinationOverhead;
            default:
                return Math.max(...agentTeam.map(w => w.estimatedDuration)) + coordinationOverhead;
        }
    }
    /**
     * Set up coordination between parallel agents
     */
    async setupParallelCoordination(plan, agents) {
        // Store coordination plan in memory for agents to access
        await this.memory.store(`parallel_coordination_${plan.planId}`, {
            planId: plan.planId,
            strategy: plan.executionStrategy,
            agentTeam: plan.agentTeam,
            sharedContext: {
                objectiveId: plan.planId,
                coordinationMode: 'parallel',
                checkpoints: this.createCoordinationCheckpoints(plan),
                failureRecovery: plan.failureRecovery
            },
            timestamp: new Date().toISOString()
        });
        // Set up shared memory spaces for agent coordination
        for (let i = 0; i < agents.length; i++) {
            const agent = agents[i];
            const workload = plan.agentTeam[i];
            await this.memory.store(`agent_workload_${agent.id}`, {
                agentId: agent.id,
                assignedTodos: workload.assignedTodos,
                specializations: workload.specializations,
                coordinationKey: `parallel_coordination_${plan.planId}`,
                peerAgents: agents.filter(a => a.id !== agent.id).map(a => a.id),
                timestamp: new Date().toISOString()
            });
        }
    }
    /**
     * Utility methods
     */
    areTasksIndependent(todo1, todo2) {
        // Check if tasks have no direct dependencies
        const todo1Keywords = todo1.content.toLowerCase().split(' ');
        const todo2Keywords = todo2.content.toLowerCase().split(' ');
        // Tasks are independent if they don't share critical keywords
        const sharedCriticalKeywords = ['deploy', 'test', 'validate', 'create table', 'configure'].filter(keyword => todo1.content.toLowerCase().includes(keyword) && todo2.content.toLowerCase().includes(keyword));
        return sharedCriticalKeywords.length === 0;
    }
    suggestAgentsForTodos(todoIds, todos) {
        const agents = [];
        const todoContents = todoIds.map(id => todos.find(t => t.id === id)?.content || '');
        for (const content of todoContents) {
            const agentType = this.inferBestAgentType(content);
            if (!agents.includes(agentType)) {
                agents.push(agentType);
            }
        }
        return agents;
    }
    inferTodoCapability(todo) {
        const content = todo.content.toLowerCase();
        if (content.includes('widget') || content.includes('template'))
            return 'widget_development';
        if (content.includes('flow') || content.includes('workflow'))
            return 'flow_creation';
        if (content.includes('script') || content.includes('code'))
            return 'scripting';
        if (content.includes('test') || content.includes('validate'))
            return 'testing';
        if (content.includes('deploy') || content.includes('configuration'))
            return 'deployment';
        return 'general_development';
    }
    capabilityToAgentType(capability) {
        const mapping = {
            'widget_development': 'widget-creator',
            'flow_creation': 'flow-builder',
            'scripting': 'script-writer',
            'testing': 'tester',
            'deployment': 'app-architect',
            'general_development': 'script-writer'
        };
        return mapping[capability] || 'script-writer';
    }
    analyzeTodoCapabilities(todo) {
        const content = todo.content.toLowerCase();
        const capabilities = [];
        if (content.includes('widget') || content.includes('ui'))
            capabilities.push('widget_development');
        if (content.includes('script') || content.includes('code'))
            capabilities.push('scripting');
        if (content.includes('flow') || content.includes('workflow'))
            capabilities.push('flow_creation');
        if (content.includes('test') || content.includes('validate'))
            capabilities.push('testing');
        if (content.includes('deploy') || content.includes('install'))
            capabilities.push('deployment');
        if (content.includes('integrate') || content.includes('api'))
            capabilities.push('integration');
        return capabilities.length > 0 ? capabilities : ['general_development'];
    }
    todoRequiresAgentType(todoId, agentType, todos) {
        const todo = todos.find(t => t.id === todoId);
        if (!todo)
            return false;
        const requiredType = this.inferBestAgentType(todo.content);
        return requiredType === agentType;
    }
    inferBestAgentType(content) {
        const lower = content.toLowerCase();
        if (lower.includes('widget') || lower.includes('template'))
            return 'widget-creator';
        if (lower.includes('flow') || lower.includes('workflow'))
            return 'flow-builder';
        if (lower.includes('script') || lower.includes('business rule'))
            return 'script-writer';
        if (lower.includes('test') || lower.includes('validate'))
            return 'tester';
        if (lower.includes('integrate') || lower.includes('api'))
            return 'integration-specialist';
        if (lower.includes('catalog') || lower.includes('item'))
            return 'catalog-manager';
        if (lower.includes('research') || lower.includes('analyze'))
            return 'researcher';
        return 'script-writer';
    }
    estimateTodoDuration(todoIds, todos) {
        let totalDuration = 0;
        for (const todoId of todoIds) {
            const todo = todos.find(t => t.id === todoId);
            if (!todo)
                continue;
            // Estimate based on content complexity
            const words = todo.content.split(' ').length;
            const baseDuration = 15; // 15 minutes base
            const complexityMultiplier = todo.priority === 'high' ? 1.5 : 1.0;
            totalDuration += baseDuration + (words * 2) * complexityMultiplier;
        }
        return Math.max(10, totalDuration); // Minimum 10 minutes
    }
    getAgentCapabilities(agentType) {
        const capabilityMap = {
            'widget-creator': ['html_generation', 'css_styling', 'javascript_development'],
            'flow-builder': ['flow_design', 'trigger_configuration', 'action_creation'],
            'script-writer': ['glide_scripting', 'business_logic', 'error_handling'],
            'app-architect': ['system_design', 'architecture_planning', 'integration'],
            'integration-specialist': ['rest_api', 'soap_services', 'data_transformation'],
            'catalog-manager': ['catalog_creation', 'variable_management', 'workflow_linking'],
            'researcher': ['requirement__analysis', 'feasibility_study', 'solution_research'],
            'tester': ['test_planning', 'test_execution', 'mock_data_creation']
        };
        return capabilityMap[agentType] || ['general_development'];
    }
    getAgentSpecializations(agentType, opportunityType) {
        const specializationMap = {
            'independent_tasks': {
                'widget-creator': ['parallel_ui_development', 'component_isolation'],
                'script-writer': ['parallel_scripting', 'independent_logic'],
                'tester': ['parallel_testing', 'test_isolation']
            },
            'specialized_breakdown': {
                'widget-creator': ['ui_specialist', 'template_expert'],
                'script-writer': ['logic_specialist', 'performance_expert'],
                'flow-builder': ['workflow_specialist', 'integration_expert']
            },
            'load_distribution': {
                'widget-creator': ['high_throughput_ui', 'batch_processing'],
                'script-writer': ['concurrent_scripting', 'load_handling'],
                'tester': ['bulk_testing', 'parallel_validation']
            }
        };
        return specializationMap[opportunityType]?.[agentType] || ['general_specialist'];
    }
    determineAgentSpecialization(workload) {
        return workload.specializations[0] || 'general';
    }
    createCoordinationCheckpoints(plan) {
        return [
            'initialization_complete',
            'halfway_milestone',
            'integration_ready',
            'testing_phase',
            'deployment_ready'
        ];
    }
    async storeOpportunities(todos, opportunities) {
        await this.memory.store(`parallelization_analysis_${Date.now()}`, {
            todoCount: todos.length,
            opportunitiesFound: opportunities.length,
            opportunities: opportunities.map(opp => ({
                type: opp.type,
                confidence: opp.confidence,
                estimatedSpeedup: opp.estimatedSpeedup,
                agentCount: opp.suggestedAgents.length
            })),
            timestamp: new Date().toISOString()
        });
    }
    setupLearningSystem() {
        this.on('parallel_execution_completed', async (data) => {
            // Store execution results for learning
            this.parallelizationHistory.set(data.planId, {
                success: data.success,
                speedup: data.actualSpeedup
            });
            await this.memory.store(`execution_result_${data.planId}`, {
                planId: data.planId,
                actualSpeedup: data.actualSpeedup,
                success: data.success,
                timestamp: new Date().toISOString()
            });
        });
    }
    initializeCapabilityMap() {
        this.capabilityMap = {
            'widget.*template': {
                primaryCapability: 'template_development',
                requiredAgentTypes: ['widget-creator'],
                parallelizable: true,
                estimatedDuration: 20,
                dependencies: []
            },
            'server.*script': {
                primaryCapability: 'server_development',
                requiredAgentTypes: ['script-writer'],
                parallelizable: true,
                estimatedDuration: 25,
                dependencies: ['template_development']
            },
            'client.*script': {
                primaryCapability: 'client_development',
                requiredAgentTypes: ['script-writer'],
                parallelizable: true,
                estimatedDuration: 20,
                dependencies: ['template_development']
            },
            'css.*style': {
                primaryCapability: 'styling',
                requiredAgentTypes: ['widget-creator'],
                parallelizable: true,
                estimatedDuration: 15,
                dependencies: ['template_development']
            },
            'test.*validate': {
                primaryCapability: 'testing',
                requiredAgentTypes: ['tester'],
                parallelizable: false,
                estimatedDuration: 30,
                dependencies: ['server_development', 'client_development', 'styling']
            },
            'deploy': {
                primaryCapability: 'deployment',
                requiredAgentTypes: ['app-architect'],
                parallelizable: false,
                estimatedDuration: 10,
                dependencies: ['testing']
            }
        };
    }
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
}
exports.ParallelAgentEngine = ParallelAgentEngine;
//# sourceMappingURL=parallel-agent-engine.js.map