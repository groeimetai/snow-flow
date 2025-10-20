"use strict";
/**
 * ServiceNow Agent Factory
 * Dynamic agent spawning based on task analysis
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
exports.AgentFactory = void 0;
const crypto = __importStar(require("crypto"));
class AgentFactory {
    constructor(memory) {
        this.memory = memory;
        this.activeAgents = new Map();
        this.messageQueue = [];
        this.agentBlueprints = new Map();
        this.initializeBlueprints();
    }
    initializeBlueprints() {
        // Widget Creator Agent - Simple but effective
        this.agentBlueprints.set('widget-creator', {
            type: 'widget-creator',
            capabilities: [
                'HTML template creation',
                'CSS styling and responsive design',
                'Client-side JavaScript',
                'Server-side data processing',
                'Chart.js integration',
                'ServiceNow widget deployment'
            ],
            mcpTools: [
                'snow_deploy',
                'snow_preview_widget',
                'snow_widget_test',
                'snow_catalog_item_search'
            ],
            personality: 'Focused, detail-oriented, user experience focused',
            coordination: 'collaborative'
        });
        // Flow Builder Agent - Process automation specialist
        this.agentBlueprints.set('flow-builder', {
            type: 'flow-builder',
            capabilities: [
                'Business process design',
                'Flow Designer expertise',
                'Approval workflow creation',
                'Integration flow building',
                'Condition and trigger logic'
            ],
            mcpTools: [
                'snow_create_flow',
                'snow_test_flow_with_mock',
                'snow_link_catalog_to_flow',
                'snow_comprehensive_flow_test'
            ],
            personality: 'Process-oriented, logical, systematic',
            coordination: 'dependent'
        });
        // Script Writer Agent - Backend logic specialist
        this.agentBlueprints.set('script-writer', {
            type: 'script-writer',
            capabilities: [
                'Business rule creation',
                'Script include development',
                'Client script implementation',
                'Data transformation scripts',
                'Performance optimization'
            ],
            mcpTools: [
                'snow_create_script_include',
                'snow_create_business_rule',
                'snow_create_client_script'
            ],
            personality: 'Technical, efficient, security-conscious',
            coordination: 'independent'
        });
        // Application Architect Agent - System design specialist
        this.agentBlueprints.set('app-architect', {
            type: 'app-architect',
            capabilities: [
                'System architecture design',
                'Table structure planning',
                'Module organization',
                'Security model design',
                'Performance architecture'
            ],
            mcpTools: [
                'snow_deploy',
                'snow_discover_platform_tables',
                'snow_table_schema_discovery',
                'snow_create_ui_policy'
            ],
            personality: 'Strategic, thorough, architecture-focused',
            coordination: 'collaborative'
        });
        // Integration Specialist Agent - API and integration expert
        this.agentBlueprints.set('integration-specialist', {
            type: 'integration-specialist',
            capabilities: [
                'REST API integration',
                'Data transformation',
                'External system connectivity',
                'Import/export processes',
                'Authentication handling'
            ],
            mcpTools: [
                'snow_create_rest_message',
                'snow_create_transform_map',
                'snow_test_integration',
                'snow_discover_data_sources'
            ],
            personality: 'Integration-focused, problem-solving, connectivity expert',
            coordination: 'independent'
        });
        // Catalog Manager Agent - Service catalog specialist
        this.agentBlueprints.set('catalog-manager', {
            type: 'catalog-manager',
            capabilities: [
                'Catalog item creation',
                'Variable set design',
                'Workflow integration',
                'Fulfillment automation',
                'User experience optimization'
            ],
            mcpTools: [
                'snow_catalog_item_manager',
                'snow_catalog_item_search',
                'snow_link_catalog_to_flow'
            ],
            personality: 'User-focused, service-oriented, detail-oriented',
            coordination: 'collaborative'
        });
        // Researcher Agent - Discovery and _analysis specialist
        this.agentBlueprints.set('researcher', {
            type: 'researcher',
            capabilities: [
                'Requirement _analysis',
                'Best practice research',
                'Existing artifact discovery',
                'Dependency identification',
                'Solution architecture'
            ],
            mcpTools: [
                'snow_find_artifact',
                'snow_comprehensive_search',
                'snow_analyze_requirements',
                'snow_discover_existing_flows'
            ],
            personality: 'Analytical, thorough, knowledge-gathering',
            coordination: 'independent'
        });
        // Tester Agent - Quality assurance specialist
        this.agentBlueprints.set('tester', {
            type: 'tester',
            capabilities: [
                'Test scenario creation',
                'Mock data generation',
                'Integration testing',
                'Performance validation',
                'Quality assurance'
            ],
            mcpTools: [
                'snow_test_flow_with_mock',
                'snow_widget_test',
                'snow_comprehensive_flow_test',
                'snow_cleanup_test_artifacts'
            ],
            personality: 'Quality-focused, systematic, thorough',
            coordination: 'dependent'
        });
    }
    // Spawn agent based on type and task requirements
    spawnAgent(type, taskId) {
        const blueprint = this.agentBlueprints.get(type);
        if (!blueprint) {
            throw new Error(`Unknown agent type: ${type}`);
        }
        const agent = {
            id: this.generateAgentId(type),
            type,
            status: 'idle',
            task: taskId,
            capabilities: [...blueprint.capabilities],
            mcpTools: [...blueprint.mcpTools]
        };
        this.activeAgents.set(agent.id, agent);
        // Store agent creation in memory for learning
        this.memory.storeLearning(`agent_spawn_${type}`, `Spawned ${type} agent for task: ${taskId || 'general'}`, 0.8);
        return agent;
    }
    // Spawn multiple agents for complex task
    spawnAgentSwarm(agentTypes, taskId) {
        const agents = [];
        for (const type of agentTypes) {
            const agent = this.spawnAgent(type, taskId);
            agents.push(agent);
        }
        // Create coordination channels between collaborative agents
        this.setupAgentCoordination(agents);
        return agents;
    }
    setupAgentCoordination(agents) {
        const collaborativeAgents = agents.filter(agent => {
            const blueprint = this.agentBlueprints.get(agent.type);
            return blueprint?.coordination === 'collaborative';
        });
        // Enable message passing between collaborative agents
        for (let i = 0; i < collaborativeAgents.length; i++) {
            for (let j = i + 1; j < collaborativeAgents.length; j++) {
                this.memory.storeLearning(`coordination_${collaborativeAgents[i].type}_${collaborativeAgents[j].type}`, 'Enabled collaborative coordination channel', 0.9);
            }
        }
    }
    // Get optimal agent sequence for task
    getOptimalAgentSequence(taskType, complexity) {
        // Check memory for successful patterns first
        const bestPattern = this.memory.getBestPattern(taskType);
        if (bestPattern && bestPattern.successRate > 0.7) {
            return bestPattern.agentSequence;
        }
        // Default sequences based on task type and complexity
        const sequences = {
            widget: complexity > 0.7
                ? ['researcher', 'widget-creator', 'tester']
                : ['widget-creator', 'tester'],
            flow: complexity > 0.6
                ? ['researcher', 'flow-builder', 'catalog-manager', 'tester']
                : ['flow-builder', 'tester'],
            script: complexity > 0.5
                ? ['researcher', 'script-writer', 'tester']
                : ['script-writer'],
            application: complexity > 0.8
                ? ['researcher', 'app-architect', 'script-writer', 'widget-creator', 'tester']
                : ['app-architect', 'script-writer', 'tester'],
            integration: ['researcher', 'integration-specialist', 'tester'],
            portal_page: complexity > 0.7
                ? ['researcher', 'widget-creator', 'page-designer', 'tester']
                : ['widget-creator', 'page-designer', 'tester'],
            workspace: complexity > 0.7
                ? ['researcher', 'workspace-specialist', 'ui-builder-expert', 'tester']
                : ['workspace-specialist', 'ui-builder-expert'],
            unknown: ['researcher', 'widget-creator'] // Safe default
        };
        return sequences[taskType] || ['researcher'];
    }
    // Execute agent task with specific MCP tools
    async executeAgentTask(agentId, instruction) {
        const agent = this.activeAgents.get(agentId);
        if (!agent) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        agent.status = 'working';
        try {
            // Get agent blueprint for MCP tool selection
            const blueprint = this.agentBlueprints.get(agent.type);
            if (!blueprint) {
                throw new Error(`No blueprint for agent type: ${agent.type}`);
            }
            // Execute with appropriate MCP tools based on agent type
            const result = await this.executeWithMcpTools(agent, instruction, blueprint.mcpTools);
            agent.status = 'completed';
            return result;
        }
        catch (error) {
            agent.status = 'failed';
            throw error;
        }
    }
    async executeWithMcpTools(agent, instruction, mcpTools) {
        // This is where the agent would use specific MCP tools
        // The Queen will orchestrate the actual MCP calls based on agent recommendations
        return {
            agentId: agent.id,
            agentType: agent.type,
            instruction,
            recommendedMcpTools: mcpTools,
            executionPlan: this.generateExecutionPlan(agent.type, instruction)
        };
    }
    generateExecutionPlan(agentType, instruction) {
        const plans = {
            'widget-creator': (instr) => [
                'DEEP ANALYZE: What is the core business problem this widget solves? What user pain points?',
                'HOLISTIC VIEW: How does this widget fit into the broader ServiceNow ecosystem and user journey?',
                'STRATEGIC QUESTIONS: What are the potential edge cases, scalability concerns, and integration points?',
                'RISK ASSESSMENT: What could go wrong? What are the dependency risks and failure modes?',
                'SOLUTION ARCHITECTURE: Design widget with proper structure, considering performance and maintainability',
                'IMPLEMENTATION: Create HTML template with accessibility, responsiveness, and user experience in mind',
                'ROBUST DEVELOPMENT: Implement client/server scripts with error handling, validation, and edge case coverage',
                'DEPLOYMENT STRATEGY: Deploy using snow_deploy with rollback plan and monitoring',
                'COMPREHENSIVE TESTING: Test functionality, performance, cross-browser compatibility, and user scenarios',
                'REFLECTION: What lessons learned? How can this approach be improved for future widgets?'
            ],
            'flow-builder': (instr) => [
                'PROCESS INTELLIGENCE: What is the complete end-to-end business process? Who are all stakeholders?',
                'ROOT CAUSE ANALYSIS: Why does this process need automation? What inefficiencies exist?',
                'ECOSYSTEM MAPPING: How does this flow integrate with existing workflows, approvals, and systems?',
                'FAILURE MODE ANALYSIS: What can go wrong at each step? How do we handle exceptions and edge cases?',
                'STRATEGIC DESIGN: Design flow structure considering scalability, maintainability, and user experience',
                'IMPLEMENTATION: Create flow using best practices, proper error handling, and clear logic paths',
                'INTEGRATION STRATEGY: Configure triggers, conditions, and integrate with catalog/notifications as needed',
                'COMPREHENSIVE TESTING: Test with real data scenarios, edge cases, and failure conditions',
                'PROCESS OPTIMIZATION: Identify improvement opportunities and performance optimizations'
            ],
            'script-writer': (instr) => [
                'REQUIREMENTS DEEP DIVE: What is the exact business requirement? Why is custom code needed?',
                'ARCHITECTURE ASSESSMENT: Should this be a business rule, script include, or something else? What\'s the optimal approach?',
                'DEPENDENCY ANALYSIS: What other systems, tables, or processes will this impact? What are the risks?',
                'ERROR SCENARIO PLANNING: What can go wrong? How do we handle failures gracefully?',
                'SOLUTION DESIGN: Design script with proper error handling, logging, and performance considerations',
                'ROBUST IMPLEMENTATION: Implement with ES5 compatibility, proper validation, and edge case handling',
                'DEPLOYMENT STRATEGY: Deploy using appropriate MCP tool with testing and rollback plan',
                'VALIDATION & MONITORING: Validate functionality and establish monitoring for ongoing health'
            ],
            'catalog-manager': (instr) => [
                'BUSINESS CONTEXT ANALYSIS: What business need does this catalog item fulfill? Who are the end users?',
                'EXISTING SOLUTION AUDIT: Search for existing catalog items - can we reuse or improve existing?',
                'USER EXPERIENCE DESIGN: What is the optimal user journey from request to fulfillment?',
                'INTEGRATION COMPLEXITY: What backend systems need integration? What are the failure points?',
                'FULFILLMENT STRATEGY: Design efficient fulfillment process with proper approvals and notifications',
                'SOLUTION ARCHITECTURE: Create catalog item with optimal variables, validations, and user guidance',
                'PROCESS IMPLEMENTATION: Implement fulfillment workflow with error handling and monitoring',
                'END-TO-END TESTING: Test complete request flow including approvals, fulfillment, and notifications',
                'CONTINUOUS IMPROVEMENT: Establish feedback mechanisms and optimization opportunities'
            ],
            'researcher': (instr) => [
                'COMPREHENSIVE DISCOVERY: Search ALL existing artifacts and solutions - what already exists?',
                'PATTERN RECOGNITION: What patterns exist in similar implementations? What can we learn?',
                'GAP ANALYSIS: What gaps exist between current state and desired outcome?',
                'RISK & CONSTRAINT MAPPING: What technical, business, and regulatory constraints must we consider?',
                'STAKEHOLDER IMPACT: Who will be affected by this change? What are their concerns?',
                'SOLUTION OPTIONS: Generate multiple solution approaches with pros/cons analysis',
                'RECOMMENDATION SYNTHESIS: Provide strategic recommendations with rationale and risk assessment',
                'IMPLEMENTATION ROADMAP: Suggest phased implementation approach with milestones and success criteria'
            ],
            'tester': (instr) => [
                'TESTING STRATEGY: What are ALL the ways this solution could fail? What are the critical user paths?',
                'RISK-BASED APPROACH: What are the highest risk areas that need thorough testing?',
                'REAL-WORLD SCENARIOS: Design test scenarios based on actual user behavior, not just happy paths',
                'DATA STRATEGY: Generate realistic test data that covers edge cases and boundary conditions',
                'COMPREHENSIVE EXECUTION: Execute tests covering functionality, performance, security, and integration points',
                'FAILURE ANALYSIS: When tests fail, dig deep - is it the test, the requirement, or the implementation?',
                'REGRESSION IMPACT: How do changes affect existing functionality? What regression tests are needed?',
                'QUALITY METRICS: Establish clear quality gates and success criteria for release readiness',
                'CLEANUP & DOCUMENTATION: Clean up test artifacts and document test results for future reference'
            ],
            // Enhanced strategic plans for other agent types  
            'app-architect': (instr) => [
                'BUSINESS ARCHITECTURE: What business capabilities does this app enable? How does it fit the enterprise strategy?',
                'TECHNICAL ARCHITECTURE: Design scalable, maintainable system structure with proper separation of concerns',
                'INTEGRATION LANDSCAPE: Map all integration points, data flows, and system dependencies',
                'RISK MITIGATION: Identify architectural risks and design mitigation strategies',
                'DEPLOYMENT STRATEGY: Create phased deployment plan with rollback capabilities and monitoring'
            ],
            'integration-specialist': (instr) => [
                'INTEGRATION ECOSYSTEM: Map ALL systems involved - what talks to what? What are the data flows?',
                'FAILURE MODE ANALYSIS: What happens when integrations fail? How do we ensure data consistency?',
                'PERFORMANCE IMPACT: How will this integration affect system performance? What are the bottlenecks?',
                'SECURITY CONSIDERATIONS: What are the security implications? How do we secure data in transit?',
                'MONITORING STRATEGY: How do we monitor integration health and detect issues proactively?'
            ],
            'ui-ux-specialist': (instr) => [
                'USER JOURNEY MAPPING: What is the complete user experience from start to finish?',
                'ACCESSIBILITY FIRST: Design for ALL users including those with disabilities',
                'PERFORMANCE UX: How do loading times and performance affect user experience?',
                'MOBILE RESPONSIVENESS: Ensure optimal experience across all devices and screen sizes',
                'USABILITY VALIDATION: Test with real users to validate design decisions and identify pain points'
            ],
            'approval-specialist': (instr) => [
                'APPROVAL ECOSYSTEM: Who needs to approve what? What are the business rules and exceptions?',
                'DELEGATION PATTERNS: How do approvals work when people are unavailable? What are escalation paths?',
                'COMPLIANCE REQUIREMENTS: What regulatory or policy requirements must the approval process meet?',
                'AUDIT TRAIL: How do we maintain complete audit trail for compliance and troubleshooting?',
                'EXCEPTION HANDLING: What happens when approval processes break down or need emergency overrides?'
            ],
            'security-specialist': (instr) => [
                'THREAT MODELING: What are ALL the ways this solution could be compromised or misused?',
                'DATA PROTECTION: How do we protect sensitive data throughout its lifecycle?',
                'ACCESS CONTROLS: Who should have access to what? How do we enforce least privilege?',
                'COMPLIANCE ALIGNMENT: Does this solution meet all regulatory and policy requirements?',
                'INCIDENT RESPONSE: How do we detect, respond to, and recover from security incidents?'
            ],
            'css-specialist': (instr) => [
                'DESIGN SYSTEM ALIGNMENT: How does this CSS fit into the broader design system and brand guidelines?',
                'RESPONSIVE STRATEGY: Ensure optimal display across all devices, screen sizes, and orientations',
                'PERFORMANCE OPTIMIZATION: Minimize CSS footprint while maintaining visual quality',
                'ACCESSIBILITY COMPLIANCE: Ensure styles support screen readers and accessibility requirements',
                'MAINTAINABILITY: Structure CSS for easy maintenance and future modifications'
            ],
            'backend-specialist': (instr) => [
                'DATA ARCHITECTURE: How should data be structured, stored, and accessed for optimal performance?',
                'API DESIGN: Create robust APIs with proper error handling, validation, and documentation',
                'SCALABILITY PLANNING: How will this backend handle increased load and data growth?',
                'SECURITY HARDENING: Implement proper authentication, authorization, and data protection',
                'MONITORING & LOGGING: Establish comprehensive logging and monitoring for operational health'
            ],
            'frontend-specialist': (instr) => [
                'USER EXPERIENCE OPTIMIZATION: Create intuitive, efficient interfaces that users love to use',
                'PERFORMANCE FIRST: Optimize loading times, responsiveness, and smooth interactions',
                'CROSS-BROWSER COMPATIBILITY: Ensure consistent experience across all browsers and versions',
                'PROGRESSIVE ENHANCEMENT: Build robust solutions that work even when things go wrong',
                'ACCESSIBILITY COMPLIANCE: Make interfaces usable by everyone, including assistive technologies'
            ],
            'performance-specialist': (instr) => [
                'PERFORMANCE BASELINE: Establish current performance metrics and identify bottlenecks',
                'HOLISTIC OPTIMIZATION: Look at database, network, client-side, and server-side performance',
                'SCALABILITY ANALYSIS: How will performance change as data and users grow?',
                'MONITORING STRATEGY: Implement continuous performance monitoring and alerting',
                'OPTIMIZATION VALIDATION: Measure and validate that optimizations actually improve performance'
            ],
            'page-designer': (instr) => [
                'USER JOURNEY ANALYSIS: What is the user trying to accomplish on this page? What is their context and mindset?',
                'INFORMATION ARCHITECTURE: How should information be organized and prioritized for optimal user flow?',
                'PORTAL ECOSYSTEM: How does this page fit into the broader portal navigation and user experience?',
                'RESPONSIVE DESIGN STRATEGY: Ensure optimal experience across desktop, tablet, and mobile devices',
                'ACCESSIBILITY COMPLIANCE: Design for all users including screen readers and keyboard navigation',
                'PERFORMANCE OPTIMIZATION: Balance visual appeal with fast loading times and smooth interactions',
                'CONTENT STRATEGY: Place widgets and content strategically based on user priorities and business goals',
                'NAVIGATION INTEGRATION: Ensure clear navigation paths and consistent user experience',
                'CROSS-BROWSER TESTING: Validate consistent experience across all browsers and device types',
                'USABILITY VALIDATION: Test with real users to ensure the page meets their needs effectively'
            ],
            'workspace-specialist': (instr) => [
                'WORKSPACE REQUIREMENTS: Analyze workspace needs and user workflows',
                'UX FRAMEWORK DESIGN: Plan Now Experience Framework architecture',
                'COMPONENT DESIGN: Design workspace components and data integration',
                'IMPLEMENTATION: Create workspace using appropriate MCP tools',
                'VALIDATION: Test workspace functionality and user experience'
            ],
            'ui-builder-expert': (instr) => [
                'UI BUILDER ANALYSIS: Determine required UI Builder components',
                'PAGE DESIGN: Design page layout and component structure',
                'DATA INTEGRATION: Configure data brokers and connections',
                'IMPLEMENTATION: Create UI Builder pages with proper configuration',
                'TESTING: Validate functionality and user experience'
            ],
            'deployment-specialist': (instr) => [
                'DEPLOYMENT PLANNING: Analyze artifacts and plan deployment',
                'DEPENDENCY CHECK: Verify all prerequisites and dependencies',
                'DEPLOYMENT EXECUTION: Execute deployment using MCP tools',
                'VALIDATION: Test deployed artifacts thoroughly',
                'MONITORING: Ensure deployment success and establish monitoring'
            ]
        };
        return plans[agentType]?.(instruction) || [
            'STRATEGIC ANALYSIS: What is the core objective and how does it fit the bigger picture?',
            'STAKEHOLDER MAPPING: Who is affected and what are their needs and constraints?',
            'SOLUTION ARCHITECTURE: Design approach considering scalability, maintainability, and risk',
            'IMPLEMENTATION STRATEGY: Execute with proper error handling, validation, and monitoring',
            'VALIDATION & OPTIMIZATION: Test thoroughly and optimize based on real-world performance'
        ];
    }
    // Send message between agents
    sendAgentMessage(from, to, type, content) {
        const message = {
            from,
            to,
            type,
            content,
            timestamp: new Date()
        };
        this.messageQueue.push(message);
        // Store coordination pattern for learning
        this.memory.storeLearning(`agent_coordination_${from}_${to}`, `Message of type ${type}`, 0.7);
    }
    // Get pending messages for agent
    getAgentMessages(agentId) {
        return this.messageQueue.filter(msg => msg.to === agentId);
    }
    // Mark agent messages as processed
    markMessagesProcessed(agentId) {
        this.messageQueue = this.messageQueue.filter(msg => msg.to !== agentId);
    }
    // Get agent status
    getAgentStatus(agentId) {
        return this.activeAgents.get(agentId) || null;
    }
    // Terminate agent
    terminateAgent(agentId) {
        const agent = this.activeAgents.get(agentId);
        if (agent) {
            // Store agent performance data for learning
            this.memory.storeLearning(`agent_performance_${agent.type}`, `Agent ${agentId} terminated with status: ${agent.status}`, agent.status === 'completed' ? 0.9 : 0.3);
            this.activeAgents.delete(agentId);
        }
    }
    // Get all active agents
    getActiveAgents() {
        return Array.from(this.activeAgents.values());
    }
    // Clean up completed agents
    cleanupCompletedAgents() {
        let cleaned = 0;
        for (const [id, agent] of Array.from(this.activeAgents.entries())) {
            if (agent.status === 'completed' || agent.status === 'failed') {
                this.terminateAgent(id);
                cleaned++;
            }
        }
        return cleaned;
    }
    generateAgentId(type) {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(4).toString('hex');
        return `${type}_${timestamp}_${random}`;
    }
    // Get agent blueprint for inspection
    getAgentBlueprint(type) {
        return this.agentBlueprints.get(type) || null;
    }
    // Get factory statistics
    getStatistics() {
        const agentTypeCounts = {};
        const agentStatusCounts = {};
        for (const agent of Array.from(this.activeAgents.values())) {
            agentTypeCounts[agent.type] = (agentTypeCounts[agent.type] || 0) + 1;
            agentStatusCounts[agent.status] = (agentStatusCounts[agent.status] || 0) + 1;
        }
        return {
            totalActiveAgents: this.activeAgents.size,
            agentTypeCounts,
            agentStatusCounts,
            pendingMessages: this.messageQueue.length,
            availableAgentTypes: Array.from(this.agentBlueprints.keys())
        };
    }
    // Create dynamic agent instance (no concrete classes needed)
    async createDynamicAgent(type, taskId) {
        try {
            // Get the agent blueprint
            const blueprint = this.agentBlueprints.get(type);
            if (!blueprint) {
                console.log(`Creating new dynamic agent type: ${type}`);
                // Create agent dynamically without a concrete class
                const dynamicBlueprint = this.createDynamicBlueprint(type);
                this.agentBlueprints.set(type, dynamicBlueprint);
            }
            // Create dynamic agent representation
            const agentId = this.generateAgentId(type);
            const dynamicAgent = {
                id: agentId,
                type: type,
                status: 'idle',
                capabilities: blueprint?.capabilities || [],
                mcpTools: blueprint?.mcpTools || [],
                task: taskId
            };
            // Track in active agents
            this.activeAgents.set(agentId, dynamicAgent);
            // Store creation in memory
            this.memory.storeLearning(`dynamic_agent_spawn_${type}`, `Created dynamic ${type} agent for task: ${taskId || 'general'}`, 0.9);
            return dynamicAgent;
        }
        catch (error) {
            console.error(`Failed to create dynamic agent ${type}:`, error);
            return null;
        }
    }
    // Create dynamic blueprint for new agent types
    createDynamicBlueprint(type) {
        // Generate capabilities based on agent type name
        const capabilities = this.inferCapabilitiesFromType(type);
        const mcpTools = this.inferMCPToolsFromType(type);
        return {
            type,
            capabilities,
            mcpTools,
            personality: `Dynamic ${type} specialist`,
            coordination: 'collaborative'
        };
    }
    // Infer capabilities from agent type name
    inferCapabilitiesFromType(type) {
        const capabilities = [];
        // Common patterns
        if (type.includes('architect'))
            capabilities.push('design', 'architecture', 'planning');
        if (type.includes('developer'))
            capabilities.push('coding', 'implementation', 'debugging');
        if (type.includes('specialist'))
            capabilities.push('expertise', 'analysis', 'optimization');
        if (type.includes('engineer'))
            capabilities.push('engineering', 'building', 'testing');
        if (type.includes('analyst'))
            capabilities.push('analysis', 'reporting', 'insights');
        return capabilities.length > 0 ? capabilities : ['general-purpose'];
    }
    // Infer MCP tools from agent type
    inferMCPToolsFromType(type) {
        const tools = [];
        // Common tool patterns
        if (type.includes('widget'))
            tools.push('snow_deploy', 'snow_preview_widget');
        if (type.includes('ml'))
            tools.push('snow_ml_train', 'snow_ml_predict');
        if (type.includes('security'))
            tools.push('snow_security_scan', 'snow_create_access_control');
        return tools.length > 0 ? tools : ['snow_deploy'];
    }
    // Execute task with specialized agent
    async executeWithSpecializedAgent(type, instruction, context) {
        const agent = await this.createDynamicAgent(type);
        if (!agent) {
            throw new Error(`Failed to create specialized agent of type ${type}`);
        }
        try {
            // Dynamic execution via MCP tools or direct operation
            const result = {
                success: true,
                message: `Dynamic ${type} agent executed: ${instruction}`,
                data: context
            };
            // Store execution result in memory
            this.memory.storeLearning(`specialized_execution_${type}`, JSON.stringify({
                instruction,
                success: result.success,
                timestamp: new Date()
            }), result.success ? 0.9 : 0.3);
            return result;
        }
        finally {
            // Clean up agent from tracking
            this.terminateAgent(agent.id);
        }
    }
}
exports.AgentFactory = AgentFactory;
//# sourceMappingURL=agent-factory.js.map