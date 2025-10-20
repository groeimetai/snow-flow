"use strict";
/**
 * Dynamic Agent Discovery Methods
 * To be integrated into snow-flow-mcp.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentDiscoveryMethods = void 0;
exports.agentDiscoveryMethods = {
    async handleAgentDiscover(args) {
        const { task_analysis, required_capabilities = [], context = {} } = args;
        const { max_agents = 8, include_new_types = true, learn_from_history = true } = context;
        // Start with base agent knowledge
        const baseAgents = this.getBaseAgentTypes();
        // Analyze task requirements to discover needed agent types
        const discoveredAgents = [];
        const agentDependencies = {};
        // Always include architecture agents for complex tasks
        if (task_analysis.complexity !== 'simple') {
            discoveredAgents.push({
                type: 'system-architect',
                name: 'System Architecture Specialist',
                capabilities: ['design', 'architecture', 'data-modeling', 'system-planning'],
                dependencies: [],
                reasoning: 'Complex tasks require architectural planning',
            });
        }
        // Discover agents based on ServiceNow artifacts
        const artifactAgentMap = {
            widget: [
                { type: 'widget-architect', capabilities: ['widget-design', 'ui-patterns'], dependencies: ['system-architect'] },
                { type: 'html-specialist', capabilities: ['html5', 'accessibility', 'semantic-markup'], dependencies: ['widget-architect'] },
                { type: 'css-artist', capabilities: ['css3', 'animations', 'responsive-design'], dependencies: ['widget-architect'] },
                { type: 'javascript-wizard', capabilities: ['es6+', 'async-patterns', 'dom-manipulation'], dependencies: ['widget-architect'] },
                { type: 'angular-specialist', capabilities: ['angular.js', 'directives', 'data-binding'], dependencies: ['widget-architect'] },
            ],
            flow: [
                { type: 'flow-architect', capabilities: ['flow-design', 'process-optimization'], dependencies: ['system-architect'] },
                { type: 'trigger-engineer', capabilities: ['event-triggers', 'conditions', 'scheduling'], dependencies: ['flow-architect'] },
                { type: 'action-developer', capabilities: ['flow-actions', 'integrations', 'data-transformation'], dependencies: ['flow-architect'] },
                { type: 'decision-specialist', capabilities: ['decision-tables', 'branching-logic'], dependencies: ['flow-architect'] },
            ],
            script: [
                { type: 'glide-expert', capabilities: ['glide-api', 'server-scripting', 'performance'], dependencies: ['system-architect'] },
                { type: 'business-logic-developer', capabilities: ['business-rules', 'calculations', 'validations'], dependencies: [] },
            ],
            integration: [
                { type: 'rest-api-architect', capabilities: ['rest-design', 'openapi', 'versioning'], dependencies: ['system-architect'] },
                { type: 'soap-specialist', capabilities: ['soap', 'wsdl', 'xml-processing'], dependencies: ['system-architect'] },
                { type: 'transform-expert', capabilities: ['data-mapping', 'etl', 'field-transformations'], dependencies: [] },
            ],
            report: [
                { type: 'data-analyst', capabilities: ['sql', 'aggregations', 'kpi-design'], dependencies: [] },
                { type: 'visualization-expert', capabilities: ['charts', 'd3.js', 'dashboards'], dependencies: ['data-analyst'] },
            ],
        };
        // Discover specialized agents based on artifacts
        for (const artifact of task_analysis.service_now_artifacts || []) {
            const specialists = artifactAgentMap[artifact] || [];
            for (const specialist of specialists) {
                if (!discoveredAgents.some(a => a.type === specialist.type)) {
                    discoveredAgents.push({
                        ...specialist,
                        name: this.generateAgentName(specialist.type),
                        reasoning: `Required for ${artifact} development`,
                    });
                    agentDependencies[specialist.type] = specialist.dependencies;
                }
            }
        }
        // Discover agents based on required capabilities
        for (const capability of required_capabilities) {
            const agent = this.discoverAgentForCapability(capability);
            if (agent && !discoveredAgents.some(a => a.type === agent.type)) {
                discoveredAgents.push(agent);
                agentDependencies[agent.type] = agent.dependencies;
            }
        }
        // Add quality assurance agents
        if (task_analysis.complexity !== 'simple') {
            discoveredAgents.push({
                type: 'quality-guardian',
                name: 'Quality Assurance Guardian',
                capabilities: ['testing', 'validation', 'test-automation', 'coverage-analysis'],
                dependencies: discoveredAgents.filter(a => a.capabilities.some(c => c.includes('develop') || c.includes('script'))).map(a => a.type),
                reasoning: 'Ensure quality of all deliverables',
            });
            discoveredAgents.push({
                type: 'performance-optimizer',
                name: 'Performance Optimization Specialist',
                capabilities: ['performance-testing', 'query-optimization', 'caching', 'load-testing'],
                dependencies: discoveredAgents.filter(a => a.capabilities.some(c => c.includes('script') || c.includes('api'))).map(a => a.type),
                reasoning: 'Optimize performance of solutions',
            });
        }
        // Create execution batches based on dependencies
        const batches = this.createAgentBatches(discoveredAgents, agentDependencies);
        // Learn from this discovery for future use
        if (learn_from_history) {
            this.storeAgentDiscovery(task_analysis, discoveredAgents);
        }
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        task_summary: {
                            type: task_analysis.task_type,
                            complexity: task_analysis.complexity,
                            artifacts: task_analysis.service_now_artifacts,
                        },
                        discovered_agents: discoveredAgents.map(agent => ({
                            type: agent.type,
                            name: agent.name,
                            capabilities: agent.capabilities,
                            dependencies: agent.dependencies || [],
                            reasoning: agent.reasoning,
                        })),
                        agent_count: discoveredAgents.length,
                        execution_batches: batches,
                        new_agent_types: include_new_types ? discoveredAgents.filter(a => !baseAgents.includes(a.type)).map(a => a.type) : [],
                        optimization: {
                            sequential_time: discoveredAgents.length,
                            batched_time: batches.length,
                            time_reduction: `${Math.round((1 - batches.length / discoveredAgents.length) * 100)}%`,
                        },
                        recommendations: {
                            primary_coordinator: batches[0]?.[0] || 'system-architect',
                            parallel_opportunities: batches.filter(b => b.length > 1).length,
                            critical_path: this.findCriticalPath(batches),
                        },
                        metadata: {
                            discovery_version: '1.0',
                            timestamp: new Date().toISOString(),
                            ai_powered: true,
                            learned_patterns: learn_from_history,
                        },
                    }, null, 2),
                },
            ],
        };
    },
    getBaseAgentTypes() {
        return [
            'architect', 'app-architect', 'script-writer', 'widget-creator',
            'flow-builder', 'tester', 'integration-specialist', 'database-expert',
        ];
    },
    generateAgentName(type) {
        const words = type.split('-');
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    },
    discoverAgentForCapability(capability) {
        const capabilityAgentMap = {
            'ml': { type: 'ml-specialist', name: 'Machine Learning Specialist', capabilities: ['tensorflow', 'neural-networks', 'predictions'], dependencies: ['system-architect'] },
            'security': { type: 'security-guardian', name: 'Security Guardian', capabilities: ['acls', 'encryption', 'vulnerability-scanning'], dependencies: [] },
            'mobile': { type: 'mobile-developer', name: 'Mobile App Developer', capabilities: ['react-native', 'ios', 'android', 'offline-sync'], dependencies: ['system-architect'] },
            'blockchain': { type: 'blockchain-architect', name: 'Blockchain Integration Specialist', capabilities: ['smart-contracts', 'distributed-ledger'], dependencies: ['system-architect'] },
            'iot': { type: 'iot-specialist', name: 'IoT Integration Specialist', capabilities: ['mqtt', 'sensor-data', 'edge-computing'], dependencies: ['integration-specialist'] },
            'chatbot': { type: 'conversational-ai-expert', name: 'Conversational AI Expert', capabilities: ['nlp', 'dialog-flow', 'intent-recognition'], dependencies: ['system-architect'] },
            'analytics': { type: 'analytics-wizard', name: 'Analytics and BI Wizard', capabilities: ['data-warehousing', 'etl', 'visualization'], dependencies: ['data-analyst'] },
            'compliance': { type: 'compliance-officer', name: 'Compliance and Governance Officer', capabilities: ['gdpr', 'sox', 'hipaa', 'audit-trails'], dependencies: [] },
            'devops': { type: 'devops-engineer', name: 'DevOps Engineer', capabilities: ['ci-cd', 'containerization', 'infrastructure-as-code'], dependencies: ['system-architect'] },
            'accessibility': { type: 'accessibility-champion', name: 'Accessibility Champion', capabilities: ['wcag', 'aria', 'screen-reader-optimization'], dependencies: ['widget-architect'] },
        };
        for (const [key, agent] of Object.entries(capabilityAgentMap)) {
            if (capability.includes(key)) {
                return { ...agent, reasoning: `Capability '${capability}' requires specialized expertise` };
            }
        }
        return null;
    },
    createAgentBatches(agents, dependencies) {
        const batches = [];
        const processed = new Set();
        const canExecute = (agent) => {
            const deps = dependencies[agent.type] || [];
            return deps.every(dep => processed.has(dep));
        };
        while (processed.size < agents.length) {
            const currentBatch = [];
            for (const agent of agents) {
                if (!processed.has(agent.type) && canExecute(agent)) {
                    currentBatch.push(agent.type);
                }
            }
            if (currentBatch.length === 0) {
                // Handle circular dependencies or missing deps
                for (const agent of agents) {
                    if (!processed.has(agent.type)) {
                        currentBatch.push(agent.type);
                    }
                }
            }
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
                currentBatch.forEach(type => processed.add(type));
            }
        }
        return batches;
    },
    findCriticalPath(batches) {
        // Find the longest dependency chain
        const path = [];
        for (const batch of batches) {
            if (batch.length === 1) {
                path.push(batch[0]);
            }
        }
        return path;
    },
    storeAgentDiscovery(taskAnalysis, agents) {
        // Store in memory for future learning
        const key = `agent_discovery_${taskAnalysis.task_type}`;
        const discovery = {
            task_type: taskAnalysis.task_type,
            discovered_agents: agents,
            timestamp: new Date().toISOString(),
        };
        // In real implementation, this would persist to database
        // this.memory.set(key, discovery);
    },
};
//# sourceMappingURL=agent-discovery-methods.js.map