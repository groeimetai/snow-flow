"use strict";
/**
 * Intelligent Agent Detection System
 * Dynamically determines which agents to spawn based on task analysis
 *
 * NOTE: This system now integrates with the Snow-Flow MCP task_categorize tool
 * for dynamic AI-based categorization instead of static patterns.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentDetector = void 0;
class AgentDetector {
    /**
     * Set the MCP client for dynamic categorization
     */
    static setMCPClient(client) {
        this.mcpClient = client;
    }
    /**
     * Analyze task using MCP dynamic categorization or fallback to static patterns
     */
    static async analyzeTaskDynamic(objective, userMaxAgents) {
        // Try to use MCP task_categorize first
        if (this.mcpClient) {
            try {
                const response = await this.mcpClient.callTool({
                    name: 'task_categorize',
                    arguments: {
                        objective,
                        context: {
                            language: 'auto',
                            maxAgents: userMaxAgents || 8,
                            environment: 'development',
                        },
                    },
                });
                if (response && response.content && response.content[0]) {
                    const result = JSON.parse(response.content[0].text);
                    // Now discover dynamic agents based on the task analysis
                    const agentDiscoveryResponse = await this.discoverDynamicAgents(result.categorization, result.intent_analysis);
                    // Map MCP response to TaskAnalysis interface with dynamic agents
                    return {
                        primaryAgent: agentDiscoveryResponse.primaryAgent || result.categorization.primary_agent,
                        supportingAgents: agentDiscoveryResponse.supportingAgents || result.categorization.supporting_agents,
                        complexity: result.categorization.complexity,
                        estimatedAgentCount: agentDiscoveryResponse.agentCount || result.categorization.estimated_agent_count,
                        requiresUpdateSet: result.categorization.requires_update_set,
                        requiresApplication: result.categorization.requires_application,
                        taskType: result.categorization.task_type,
                        serviceNowArtifacts: result.categorization.service_now_artifacts,
                        confidence: result.categorization.confidence_score,
                        neuralConfidence: result.metadata.neural_confidence,
                        intentAnalysis: result.intent_analysis,
                        approach: {
                            recommendedStrategy: result.approach.recommended_strategy,
                            executionMode: result.approach.execution_mode,
                            parallelOpportunities: result.approach.parallel_opportunities,
                            riskFactors: result.approach.risk_factors,
                            optimizationHints: result.approach.optimization_hints,
                        },
                    };
                }
            }
            catch (error) {
                console.warn('MCP task_categorize failed, falling back to static patterns:', error);
            }
        }
        // Fallback to static analysis
        return this.analyzeTask(objective, userMaxAgents);
    }
    /**
     * Discover dynamic agents using MCP agent_discover
     */
    static async discoverDynamicAgents(categorization, intentAnalysis) {
        if (!this.mcpClient) {
            return {
                primaryAgent: categorization.primary_agent,
                supportingAgents: categorization.supporting_agents,
                agentCount: categorization.estimated_agent_count,
            };
        }
        try {
            const response = await this.mcpClient.callTool({
                name: 'agent_discover',
                arguments: {
                    task_analysis: {
                        task_type: categorization.task_type,
                        complexity: categorization.complexity,
                        service_now_artifacts: categorization.service_now_artifacts,
                    },
                    required_capabilities: this.extractCapabilitiesFromIntent(intentAnalysis),
                    context: {
                        max_agents: categorization.estimated_agent_count || 8,
                        include_new_types: true,
                        learn_from_history: true,
                    },
                },
            });
            if (response && response.content && response.content[0]) {
                const result = JSON.parse(response.content[0].text);
                // Map discovered agents to our format
                const discoveredAgents = result.discovered_agents || [];
                const primaryAgent = result.recommendations.primary_coordinator || categorization.primary_agent;
                const supportingAgents = discoveredAgents
                    .filter((a) => a.type !== primaryAgent)
                    .map((a) => a.type);
                return {
                    primaryAgent,
                    supportingAgents,
                    agentCount: discoveredAgents.length,
                    discoveredAgents,
                    executionBatches: result.execution_batches,
                    newAgentTypes: result.new_agent_types,
                };
            }
        }
        catch (error) {
            console.warn('MCP agent_discover failed, using static agents:', error);
        }
        // Fallback to original agents
        return {
            primaryAgent: categorization.primary_agent,
            supportingAgents: categorization.supporting_agents,
            agentCount: categorization.estimated_agent_count,
        };
    }
    /**
     * Extract required capabilities from intent analysis
     */
    static extractCapabilitiesFromIntent(intentAnalysis) {
        const capabilities = [];
        // Extract from action verbs
        const verbCapabilityMap = {
            'integrate': 'integration',
            'optimize': 'performance',
            'secure': 'security',
            'analyze': 'analytics',
            'visualize': 'visualization',
            'automate': 'automation',
            'deploy': 'devops',
            'test': 'testing',
            'document': 'documentation',
        };
        for (const verb of intentAnalysis.action_verbs || []) {
            if (verbCapabilityMap[verb]) {
                capabilities.push(verbCapabilityMap[verb]);
            }
        }
        // Extract from target objects
        const objectCapabilityMap = {
            'mobile': 'mobile',
            'chatbot': 'chatbot',
            'ml': 'ml',
            'ai': 'ml',
            'blockchain': 'blockchain',
            'iot': 'iot',
            'compliance': 'compliance',
            'accessibility': 'accessibility',
        };
        for (const obj of intentAnalysis.target_objects || []) {
            if (objectCapabilityMap[obj]) {
                capabilities.push(objectCapabilityMap[obj]);
            }
        }
        return [...new Set(capabilities)]; // Remove duplicates
    }
    static analyzeTask(objective, userMaxAgents) {
        const lowerObjective = objective.toLowerCase();
        const words = lowerObjective.split(/\s+/);
        // Check for data generation FIRST - before any other analysis
        const dataGenerationPatterns = [
            // Pattern for "create/make X incidents/changes" with flexible word order
            /\b(create|generate|make|maak|genereer|aanmaken)\b.*\b\d+\b.*(incident|change|request|problem|task|record|item)/i,
            // Pattern for "data set" with numbers anywhere
            /\bdata\s*set\b.*\b\d{3,}/i, // data set with 3+ digit numbers
            // Pattern for various test/mock/sample data keywords
            /\b(test\s+data|mock\s+data|sample\s+data|training\s+data)\b/i,
            // Pattern for populate/seed/fill operations
            /\b(populate|seed|fill)\s+(with\s+)?(test|sample|random|mock)\s+(data|incident|change|record)/i,
            // Pattern for seed database with numbers
            /\b(seed|populate|fill)\s+(database|db|table)\s+with\s+\d+/i,
            // Pattern for ML training data
            /\b(ML|machine\s+learning|training)\b.*\bdata/i,
            // Pattern for random/test with large numbers
            /\b(random|test|mock|sample)\b.*\b\d{3,}\b.*(incident|change|request|problem)/i,
            // Pattern for Dutch data set creation
            /\bdata\s*set\s+(aan\s+)?van\s+\d+/i
        ];
        const isDataGeneration = dataGenerationPatterns.some(pattern => pattern.test(objective));
        if (isDataGeneration) {
            return {
                primaryAgent: 'script-writer',
                supportingAgents: ['tester'], // Minimal support
                complexity: 'simple',
                estimatedAgentCount: 2,
                requiresUpdateSet: false, // Usually no update set needed for data generation
                requiresApplication: false,
                taskType: 'data_generation',
                serviceNowArtifacts: ['script']
            };
        }
        // Check for simple operations
        const simpleOperationPatterns = [
            /\b(update|change|modify|delete|remove)\s+(the\s+)?(field|record|value|property)\b/i,
            /\b(wijzig|verander|verwijder|pas\s+aan)\s+(het\s+)?(veld|record|waarde)\b/i
        ];
        const isSimpleOperation = simpleOperationPatterns.some(pattern => pattern.test(objective));
        if (isSimpleOperation) {
            return {
                primaryAgent: 'script-writer',
                supportingAgents: ['tester'],
                complexity: 'simple',
                estimatedAgentCount: 2,
                requiresUpdateSet: false,
                requiresApplication: false,
                taskType: 'simple_operation',
                serviceNowArtifacts: ['script']
            };
        }
        // Determine task type for other cases
        const taskType = this.determineTaskType(lowerObjective, this.detectServiceNowArtifacts(lowerObjective));
        // Detect agent capabilities
        const agentCapabilities = this.detectAgentCapabilities(lowerObjective);
        // Determine primary agent
        const primaryAgent = this.determinePrimaryAgent(agentCapabilities);
        // Determine supporting agents
        const supportingAgents = this.determineSupportingAgents(agentCapabilities, primaryAgent, userMaxAgents);
        // Assess complexity
        const complexity = this.assessComplexity(objective, agentCapabilities);
        // Determine ServiceNow artifacts
        const serviceNowArtifacts = this.detectServiceNowArtifacts(lowerObjective);
        // Determine if Update Set is required
        const requiresUpdateSet = this.requiresUpdateSet(lowerObjective, serviceNowArtifacts);
        // Determine if new Application is required
        const requiresApplication = this.requiresApplication(lowerObjective, serviceNowArtifacts);
        // 🚀 NEW: Accurate agent count for parallel system
        const isDevelopmentTask = ['widget-creator', 'flow-builder', 'script-writer', 'app-architect'].includes(primaryAgent) ||
            supportingAgents.some(agent => ['css-specialist', 'backend-specialist', 'frontend-specialist'].includes(agent));
        const estimatedAgentCount = isDevelopmentTask
            ? Math.max(supportingAgents.length + 1, 6) // 6+ agents for development (1 primary + 5+ specialists)
            : Math.min(Math.max(supportingAgents.length + 1, 2), 8); // Original logic for non-development
        return {
            primaryAgent,
            supportingAgents,
            complexity,
            estimatedAgentCount,
            requiresUpdateSet,
            requiresApplication,
            taskType,
            serviceNowArtifacts
        };
    }
    static detectAgentCapabilities(objective) {
        const capabilities = [];
        for (const [agentType, config] of Object.entries(this.AGENT_PATTERNS)) {
            let matchCount = 0;
            const totalKeywords = config.keywords.length;
            for (const keyword of config.keywords) {
                if (objective.includes(keyword)) {
                    matchCount++;
                }
            }
            if (matchCount > 0) {
                const confidence = (matchCount / totalKeywords) * config.confidence;
                capabilities.push({
                    type: agentType,
                    confidence,
                    requiredFor: config.requiredFor,
                    description: config.description
                });
            }
        }
        return capabilities.sort((a, b) => b.confidence - a.confidence);
    }
    static determinePrimaryAgent(capabilities) {
        if (capabilities.length === 0)
            return 'queen-coordinator';
        // Map detected types to new parallel agent types
        const convertToParallelType = (detectedType) => {
            const mapping = {
                'widget_builder': 'widget-creator',
                'flow_designer': 'flow-builder',
                'integration_specialist': 'integration-specialist',
                'database_expert': 'app-architect',
                'coder': 'script-writer',
                'architect': 'app-architect',
                'tester': 'tester',
                'data_generator': 'script-writer' // Data generation uses script-writer
            };
            return mapping[detectedType] || detectedType;
        };
        // Convert all capability types to parallel agent types
        const parallelCapabilities = capabilities.map(c => ({
            ...c,
            type: convertToParallelType(c.type)
        }));
        // Special logic for ServiceNow-specific tasks - use new parallel agent types
        const serviceNowAgents = parallelCapabilities.filter(c => ['flow-builder', 'widget-creator', 'integration-specialist', 'app-architect'].includes(c.type));
        if (serviceNowAgents.length > 0) {
            return serviceNowAgents[0].type;
        }
        return parallelCapabilities[0].type;
    }
    static determineSupportingAgents(capabilities, primaryAgent, userMaxAgents) {
        // 🚀 NEW: Parallel Agent System - Show 6+ specialized agents for development tasks
        const isWidgetDevelopment = primaryAgent === 'widget-creator' || capabilities.some(c => c.type === 'widget-creator');
        const isFlowDevelopment = primaryAgent === 'flow-builder' || capabilities.some(c => c.type === 'flow-builder');
        const isDevelopmentTask = isWidgetDevelopment || isFlowDevelopment ||
            capabilities.some(c => ['widget-creator', 'flow-builder', 'script-writer', 'app-architect'].includes(c.type));
        if (isDevelopmentTask) {
            // 🚀 Widget development gets full specialized team (6+ agents)
            if (isWidgetDevelopment) {
                return ['css-specialist', 'backend-specialist', 'frontend-specialist', 'integration-specialist', 'performance-specialist', 'tester'];
            }
            // 🚀 Flow development gets flow-specific team
            if (isFlowDevelopment) {
                return ['trigger-specialist', 'action-specialist', 'approval-specialist', 'integration-specialist', 'error-handler', 'tester'];
            }
            // 🚀 General development gets adaptive specialized team
            return ['script-writer', 'css-specialist', 'integration-specialist', 'security-specialist', 'performance-specialist', 'tester'];
        }
        // 🚀 For non-development tasks, use smart agent selection based on capabilities
        const requestedSupportingCount = userMaxAgents ? Math.max(userMaxAgents - 1, 1) : 5;
        // Start with high-confidence agents (confidence > 0.3)
        let supportingAgents = capabilities
            .filter(c => c.type !== primaryAgent && c.confidence > 0.3)
            .slice(0, requestedSupportingCount)
            .map(c => c.type);
        // If we need more agents, add specialized agents based on task context
        if (supportingAgents.length < requestedSupportingCount) {
            const remainingSlots = requestedSupportingCount - supportingAgents.length;
            const specializedAgents = ['integration-specialist', 'security-specialist', 'tester', 'performance-specialist']
                .filter(agent => !supportingAgents.includes(agent))
                .slice(0, remainingSlots);
            supportingAgents = [...supportingAgents, ...specializedAgents];
        }
        // Ensure we don't exceed the requested count
        if (userMaxAgents && supportingAgents.length > requestedSupportingCount) {
            supportingAgents = supportingAgents.slice(0, requestedSupportingCount);
        }
        return supportingAgents;
    }
    static assessComplexity(objective, capabilities) {
        const wordCount = objective.split(/\s+/).length;
        const agentCount = capabilities.length;
        // Complex indicators
        const complexKeywords = ['integrate', 'multiple', 'complex', 'advanced', 'system', 'architecture', 'enterprise'];
        const hasComplexKeywords = complexKeywords.some(keyword => objective.toLowerCase().includes(keyword));
        if (wordCount > 20 || agentCount > 4 || hasComplexKeywords) {
            return 'complex';
        }
        else if (wordCount > 10 || agentCount > 2) {
            return 'medium';
        }
        else {
            return 'simple';
        }
    }
    static detectServiceNowArtifacts(objective) {
        const artifacts = [];
        const lowerObjective = objective.toLowerCase();
        // Enhanced artifact detection with Dutch support and context
        const artifactPatterns = {
            'widget': [
                'widget', 'widgets',
                'service portal', 'portal component', 'dashboard component',
                'ui component', 'interface', 'display', 'homepage'
            ],
            'flow': [
                'flow', 'flows', 'workflow', 'workflows',
                'process', 'processes', 'automation', 'automate',
                'approval', 'approvals', 'routing', 'trigger'
            ],
            'application': [
                'application', 'applications', 'app', 'apps',
                'applicatie', 'applicaties', 'system', 'systeem',
                'complete', 'comprehensive', 'full solution'
            ],
            'script': [
                'script', 'scripts', 'code', 'function', 'functions',
                'business rule', 'business rules', 'client script', 'server script',
                'script include', 'javascript', 'logic', 'programmeer'
            ],
            'business_rule': [
                'business rule', 'business rules', 'business_rule',
                'rule', 'rules', 'validation', 'trigger logic',
                'bedrijfsregel', 'regel', 'regels'
            ],
            'integration': [
                'integration', 'integrations', 'api', 'apis',
                'rest', 'soap', 'webhook', 'external', 'third party',
                'integratie', 'koppeling', 'verbinding'
            ],
            'table': [
                'table', 'tables', 'database', 'data',
                'record', 'records', 'field', 'fields',
                'tabel', 'tabellen', 'gegevens'
            ],
            'report': [
                'report', 'reports', 'reporting', 'analytics',
                'dashboard', 'chart', 'graph', 'metrics',
                'rapport', 'rapporten', 'rapportage'
            ]
        };
        // Check each artifact type with enhanced patterns
        for (const [artifactType, patterns] of Object.entries(artifactPatterns)) {
            for (const pattern of patterns) {
                if (lowerObjective.includes(pattern)) {
                    if (!artifacts.includes(artifactType)) {
                        artifacts.push(artifactType);
                    }
                    break; // Found one pattern for this type, move to next type
                }
            }
        }
        // Context-based detection for common development terms
        const developmentContext = {
            'widget': ['voor', 'voor een', 'show', 'display', 'interface', 'homepage', 'portal'],
            'flow': ['goedkeuring', 'approval', 'proces', 'automatiseer', 'trigger', 'wanneer'],
            'script': ['implementeer', 'implement', 'schrijf', 'write', 'code', 'function'],
            'table': ['opslaan', 'save', 'store', 'data', 'informatie', 'gegevens'],
            'report': ['analyse', 'analyze', 'overview', 'overzicht', 'statistieken', 'metrics']
        };
        // Add context-based detection
        for (const [artifactType, contextWords] of Object.entries(developmentContext)) {
            for (const contextWord of contextWords) {
                if (lowerObjective.includes(contextWord) && !artifacts.includes(artifactType)) {
                    // Only add if we have creation/development intent
                    const creationWords = ['create', 'maak', 'bouw', 'build', 'develop', 'implementeer', 'schrijf', 'write'];
                    if (creationWords.some(word => lowerObjective.includes(word))) {
                        artifacts.push(artifactType);
                        break;
                    }
                }
            }
        }
        // Remove duplicates and return
        return Array.from(new Set(artifacts));
    }
    static requiresUpdateSet(objective, artifacts) {
        const lowerObjective = objective.toLowerCase();
        // Always require Update Set for development tasks
        const developmentKeywords = [
            'create', 'build', 'implement', 'develop', 'make', 'generate', 'add',
            'bouw', 'maak', 'schrijf', 'write', 'update', 'modify', 'change',
            'implementeer', 'ontwikkel', 'codeer', 'programmeer', 'stel', 'wijzig',
            'business rule', 'script', 'flow', 'widget', 'workflow', 'client script',
            'ui action', 'scheduled job', 'transform', 'integration',
            'bedrijfsregel', 'proces', 'goedkeuring', 'automatisering'
        ];
        const hasDevelopmentKeywords = developmentKeywords.some(keyword => lowerObjective.includes(keyword));
        // Or if ServiceNow artifacts are involved
        const hasServiceNowArtifacts = artifacts.length > 0;
        // Or if task type indicates development
        const developmentTaskTypes = [
            'widget_development', 'flow_development', 'script_development',
            'application_development', 'integration_development', 'database_development',
            'reporting_development', 'general_development'
        ];
        const taskType = this.determineTaskType(objective, artifacts);
        const isDevelopmentTask = developmentTaskTypes.includes(taskType);
        return hasDevelopmentKeywords || hasServiceNowArtifacts || isDevelopmentTask;
    }
    static requiresApplication(objective, artifacts) {
        // Require new application for comprehensive systems
        const applicationKeywords = [
            'application', 'app', 'system', 'complete', 'full', 'comprehensive',
            'applicatie', 'applicaties', 'systeem', 'volledig', 'compleet',
            'totaal', 'geheel', 'pakket', 'oplossing', 'solution'
        ];
        const hasApplicationKeywords = applicationKeywords.some(keyword => objective.toLowerCase().includes(keyword));
        // Or if multiple complex artifacts are involved
        const hasMultipleArtifacts = artifacts.length >= 3;
        return hasApplicationKeywords || hasMultipleArtifacts;
    }
    static determineTaskType(objective, artifacts) {
        const lowerObjective = objective.toLowerCase();
        // FIRST: Check for data generation requests
        const dataGenerationPatterns = [
            /\b(create|generate|make|maak)\s+\d+\s+(random\s+)?(incident|change|request|problem|task|record|item)/i,
            /\b(genereer|aanmaken)\s+\d+\s+(willekeurige\s+)?(incident|change|request|problem|task|record|item)/i,
            /\bdata\s*set\s*(van|of|with)\s*\d+/i,
            /\b(test\s+data|mock\s+data|sample\s+data|training\s+data)\b/i,
            /\b(populate|seed|fill)\s+(with\s+)?(test|sample|random)\s+data/i
        ];
        const isDataGeneration = dataGenerationPatterns.some(pattern => pattern.test(objective));
        if (isDataGeneration)
            return 'data_generation';
        // Check for simple operations (update, delete, modify single things)
        const simpleOperationPatterns = [
            /\b(update|change|modify|delete|remove)\s+(the\s+)?(field|record|value|property)\b/i,
            /\b(wijzig|verander|verwijder|pas\s+aan)\s+(het\s+)?(veld|record|waarde)\b/i
        ];
        const isSimpleOperation = simpleOperationPatterns.some(pattern => pattern.test(objective));
        if (isSimpleOperation)
            return 'simple_operation';
        // Determine based on detected artifacts and keywords
        // Check flow FIRST as it's often confused with widget when both are present
        if (artifacts.includes('flow') || artifacts.includes('workflow'))
            return 'flow_development';
        if (artifacts.includes('widget'))
            return 'widget_development';
        if (artifacts.includes('application'))
            return 'application_development';
        if (artifacts.includes('script') || artifacts.includes('business_rule'))
            return 'script_development';
        if (artifacts.includes('integration') || artifacts.includes('api'))
            return 'integration_development';
        if (artifacts.includes('table') || artifacts.includes('database'))
            return 'database_development';
        if (artifacts.includes('report') || artifacts.includes('dashboard'))
            return 'reporting_development';
        // Fallback to general development
        const developmentKeywords = [
            'create', 'build', 'implement', 'develop', 'make', 'generate',
            'bouw', 'maak', 'schrijf', 'implementeer', 'ontwikkel', 'codeer'
        ];
        const hasDevelopmentKeywords = developmentKeywords.some(keyword => lowerObjective.includes(keyword));
        if (hasDevelopmentKeywords)
            return 'general_development';
        // Research or _analysis tasks
        const researchKeywords = [
            'research', 'analyze', 'investigate', 'study', 'explore',
            'onderzoek', 'analyseer', 'bestudeer', 'ontdek'
        ];
        const hasResearchKeywords = researchKeywords.some(keyword => lowerObjective.includes(keyword));
        if (hasResearchKeywords)
            return 'research_task';
        return 'orchestration_task';
    }
    static generateAgentPrompt(agentType, objective, _analysis) {
        const agentConfig = this.AGENT_PATTERNS[agentType];
        const basePrompt = `You are a specialized ${agentType} agent in a ServiceNow multi-agent development swarm.

🎯 **Your Role**: ${agentConfig?.description || 'Specialized agent'}

🔍 **Task Context**: ${objective}

🏗️ **Project Setup**:
${_analysis.requiresUpdateSet ? '- ✅ Update Set will be automatically created' : '- ⚠️ No Update Set required'}
${_analysis.requiresApplication ? '- ✅ New Application will be automatically created' : '- ⚠️ Using existing application context'}

🤖 **ML Capabilities Available**:
- 🧠 Neural Networks: Incident classification, change risk prediction, anomaly detection
- 📊 Performance Analytics ML: KPI forecasting, trend analysis (when PA plugin active)
- 🔮 Predictive Intelligence: Clustering, similarity matching (when PI plugin active)
- 🎯 Hybrid ML: Combine ServiceNow native ML with custom TensorFlow models

🤖 **Team Coordination**:
- Primary Agent: ${_analysis.primaryAgent}
- Supporting Agents: ${_analysis.supportingAgents.join(', ')}
- Task Complexity: ${_analysis.complexity}
- ServiceNow Artifacts: ${_analysis.serviceNowArtifacts.join(', ')}

📋 **Your Responsibilities**:`;
        // Add agent-specific responsibilities
        switch (agentType) {
            case 'architect':
                return basePrompt + `
- Design system architecture and data models
- Define relationships between ServiceNow components
- Create technical specifications
- Ensure scalability and best practices
- Coordinate with other agents on implementation approach`;
            case 'coder':
                return basePrompt + `
- Implement code based on architectural designs
- Write ServiceNow scripts, business rules, and functions
- Ensure code quality and maintainability
- Follow ServiceNow development best practices
- Collaborate with testers on code validation
- Implement ML-powered features:
  * mcp__servicenow-machine-learning__ml_train_incident_classifier - Train classification models
  * mcp__servicenow-machine-learning__ml_classify_incident - Auto-classify incidents
  * mcp__servicenow-machine-learning__ml_predictive_intelligence - Add PI capabilities`;
            case 'flow_designer':
                return basePrompt + `
- Design and implement ServiceNow flows and workflows
- Configure approval processes and routing logic
- Set up triggers and conditions
- Ensure proper integration with other system components
- Test flow execution and error handling`;
            case 'widget_builder':
                return basePrompt + `
- Design and implement Service Portal widgets
- Create HTML templates and CSS styling
- Develop client-side and server-side scripts
- Ensure responsive design and accessibility
- Integrate with ServiceNow APIs and data sources`;
            case 'tester':
                return basePrompt + `
- Develop and execute test plans
- Validate functionality and performance
- Identify and report bugs and issues
- Ensure quality standards are met
- Coordinate with development agents on fixes`;
            case 'researcher':
                return basePrompt + `
- Research ServiceNow best practices and patterns
- Analyze requirements and gather information
- Provide insights and recommendations
- Study existing implementations and solutions
- Document findings and share knowledge
- Use ML for data-driven insights:
  * mcp__servicenow-machine-learning__ml_forecast_incidents - Predict future trends
  * mcp__servicenow-machine-learning__ml_detect_anomalies - Find unusual patterns
  * mcp__servicenow-machine-learning__ml_performance_analytics - Analyze KPIs with ML`;
            case 'orchestrator':
                return basePrompt + `
- Coordinate activities between all agents
- Manage task priorities and dependencies
- Ensure project timeline and milestones
- Facilitate communication and collaboration
- Monitor progress and address blockers
- Leverage ML for intelligent orchestration:
  * mcp__servicenow-machine-learning__ml_agent_intelligence - AI work assignment
  * mcp__servicenow-machine-learning__ml_process_optimization - Optimize workflows
  * mcp__servicenow-machine-learning__ml_hybrid_recommendation - Combined ML insights`;
            default:
                return basePrompt + `
- Provide specialized expertise in your domain
- Collaborate effectively with other agents
- Ensure quality and best practices
- Contribute to overall project success`;
        }
    }
}
exports.AgentDetector = AgentDetector;
// MCP integration for dynamic categorization
AgentDetector.mcpClient = null;
AgentDetector.AGENT_PATTERNS = {
    // Development agents
    architect: {
        keywords: ['design', 'architecture', 'structure', 'database', 'schema', 'model', 'entity', 'relationship', 'system'],
        confidence: 0.9,
        description: 'System architecture and design',
        requiredFor: ['applications', 'complex_systems', 'integrations']
    },
    coder: {
        keywords: ['implement', 'code', 'script', 'function', 'api', 'endpoint', 'logic', 'algorithm', 'business_rule', 'schrijf', 'write', 'develop', 'programmeer', 'implementeer', 'maak', 'bouw', 'build', 'create', 'codeer'],
        confidence: 0.8,
        description: 'Code implementation and development',
        requiredFor: ['scripts', 'functions', 'business_rules', 'apis']
    },
    researcher: {
        keywords: ['research', 'analyze', 'investigate', 'study', 'explore', 'understand', 'learn', 'discover', 'onderzoek', 'analyseer', 'bestudeer', 'ontdek', 'begrijp'],
        confidence: 0.7,
        description: 'Research and _analysis',
        requiredFor: ['requirements', 'best_practices', 'patterns']
    },
    tester: {
        keywords: ['test', 'verify', 'validate', 'check', 'ensure', 'quality', 'bug', 'debug', 'controleer', 'valideer', 'kwaliteit', 'testen'],
        confidence: 0.8,
        description: 'Testing and quality assurance',
        requiredFor: ['validation', 'quality_control', 'debugging']
    },
    reviewer: {
        keywords: ['review', 'audit', 'examine', 'evaluate', 'assess', 'approve', 'feedback'],
        confidence: 0.7,
        description: 'Code and process review',
        requiredFor: ['code_review', 'approval_process', 'quality_gates']
    },
    documenter: {
        keywords: ['document', 'documentation', 'guide', 'manual', 'readme', 'help', 'instructions'],
        confidence: 0.6,
        description: 'Documentation and guides',
        requiredFor: ['documentation', 'user_guides', 'api_docs']
    },
    orchestrator: {
        keywords: ['coordinate', 'manage', 'orchestrate', 'organize', 'plan', 'schedule', 'oversee'],
        confidence: 0.9,
        description: 'Task coordination and management',
        requiredFor: ['complex_tasks', 'multi_agent_coordination', 'project_management']
    },
    // ServiceNow specific agents
    flow_designer: {
        keywords: ['flow', 'workflow', 'process', 'automation', 'approval', 'routing', 'trigger', 'proces', 'goedkeuring', 'automatisering', 'automatiseer', 'doorloop', 'stroom'],
        confidence: 0.9,
        description: 'ServiceNow Flow Designer specialist',
        requiredFor: ['flows', 'workflows', 'approvals', 'automation']
    },
    widget_builder: {
        keywords: ['widget', 'portal', 'dashboard', 'ui', 'interface', 'frontend', 'display', 'weergave', 'scherm', 'component', 'homepage'],
        confidence: 0.9,
        description: 'Service Portal widget development',
        requiredFor: ['widgets', 'portals', 'dashboards', 'ui_components']
    },
    integration_specialist: {
        keywords: ['integration', 'api', 'rest', 'soap', 'webhook', 'external', 'third_party'],
        confidence: 0.8,
        description: 'System integration and APIs',
        requiredFor: ['integrations', 'apis', 'webhooks', 'external_systems']
    },
    database_expert: {
        keywords: ['database', 'table', 'field', 'record', 'data', 'schema', 'query', 'report'],
        confidence: 0.8,
        description: 'Database and data management',
        requiredFor: ['tables', 'databases', 'reports', 'data_management']
    }
};
// 🚀 ENHANCED: Updated to use new specialized agents for parallel execution (v1.1.92)
AgentDetector.SERVICENOW_ARTIFACTS = {
    'widget': [
        'widget-creator', // HTML structure specialist
        'css-specialist', // Styling and responsive design specialist  
        'backend-specialist', // Server script specialist
        'frontend-specialist', // Client script specialist
        'integration-specialist', // API integration specialist
        'ui-ux-specialist', // User experience specialist
        'performance-specialist', // Performance optimization
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
    'workflow': [
        'flow-builder', 'trigger-specialist', 'action-specialist', 'approval-specialist', 'tester'
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
        'documentation-specialist' // Documentation
    ],
    'script': ['script-writer', 'security-specialist', 'tester'],
    'business_rule': ['script-writer', 'security-specialist', 'tester'],
    'integration': [
        'integration-specialist', // API integration specialist
        'api-specialist', // API development specialist
        'transform-specialist', // Data transformation specialist
        'monitoring-specialist', // Integration monitoring
        'security-specialist', // Security implementation
        'tester' // Integration testing
    ],
    'api': ['api-specialist', 'integration-specialist', 'security-specialist', 'tester'],
    'table': ['database_expert', 'architect', 'script-writer'],
    'report': ['database_expert', 'analyst', 'performance-specialist'],
    'dashboard': ['widget-creator', 'css-specialist', 'database_expert', 'performance-specialist']
};
//# sourceMappingURL=agent-detector.js.map