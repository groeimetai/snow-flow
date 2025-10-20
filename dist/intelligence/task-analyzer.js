"use strict";
/**
 * Task Analysis Engine - AI-powered _analysis of unknown requirements
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskAnalyzer = void 0;
const logger_js_1 = require("../utils/logger.js");
class TaskAnalyzer {
    constructor() {
        this.knowledgeBase = new Map();
        this.patternLibrary = [];
        this.logger = new logger_js_1.Logger('TaskAnalyzer');
        this.initializeKnowledgeBase();
        this.initializePatternLibrary();
    }
    /**
     * Analyze task type and requirements from natural language
     */
    async analyzeTaskType(request) {
        this.logger.info('Analyzing task type', { description: request.description });
        try {
            const description = request.description.toLowerCase();
            const context = request.context || {};
            // Step 1: Determine primary task type
            const taskType = this.identifyTaskType(description);
            // Step 2: Assess complexity
            const complexity = this.assessComplexity(description, context);
            // Step 3: Identify required components
            const components = this.identifyRequiredComponents(description);
            // Step 4: Extract key entities
            const keyEntities = this.extractKeyEntities(description);
            // Step 5: Determine parallelization potential
            const canParallelize = this.canTaskParallelize(description, taskType);
            // Step 6: Assess dependencies
            const hasStrictDependencies = this.hasStrictDependencies(description, taskType);
            // Step 7: Calculate risk level
            const riskLevel = this.calculateRiskLevel(complexity, components, taskType);
            // Step 8: Generate recommendations
            const recommendations = this.generateRecommendations(taskType, complexity, components);
            // Step 9: Estimate duration
            const estimatedDuration = this.estimateTaskDuration(taskType, complexity, components);
            // Step 10: Determine business impact
            const businessImpact = this.assessBusinessImpact(description, taskType);
            const _analysis = {
                taskType,
                complexity,
                requiredSkills: [], // Will be populated by identifyRequiredSkills
                estimatedDuration,
                hasServiceNowComponents: components.servicenow,
                requiresDataProcessing: components.data,
                requiresIntegration: components.integration,
                requiresUserInterface: components.ui,
                requiresAutomation: components.automation,
                requiresReporting: components.reporting,
                requiresSecurity: components.security,
                canParallelize,
                hasStrictDependencies,
                riskLevel,
                recommendations,
                successRate: this.estimateSuccessRate(taskType, complexity),
                priority: request.priority || 'medium',
                keyEntities,
                businessImpact
            };
            this.logger.info('Task _analysis completed', {
                taskType: _analysis.taskType,
                complexity: _analysis.complexity,
                riskLevel: _analysis.riskLevel
            });
            return _analysis;
        }
        catch (error) {
            this.logger.error('Task _analysis failed', error);
            throw new Error(`Task _analysis failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Identify required skills based on task analysis
     */
    async identifyRequiredSkills(_analysis) {
        const skills = [];
        // Core ServiceNow skills
        if (_analysis.hasServiceNowComponents) {
            skills.push({
                type: 'servicenow-specialist',
                importance: 'primary',
                complexity: _analysis.complexity,
                estimatedTime: _analysis.estimatedDuration * 0.3
            });
        }
        // Data processing skills
        if (_analysis.requiresDataProcessing) {
            skills.push({
                type: 'data-specialist',
                importance: 'primary',
                complexity: _analysis.complexity,
                estimatedTime: _analysis.estimatedDuration * 0.25
            });
        }
        // Integration skills
        if (_analysis.requiresIntegration) {
            skills.push({
                type: 'integration-specialist',
                importance: 'primary',
                complexity: _analysis.complexity,
                estimatedTime: _analysis.estimatedDuration * 0.35
            });
        }
        // UI development skills
        if (_analysis.requiresUserInterface) {
            skills.push({
                type: 'frontend-specialist',
                importance: 'primary',
                complexity: _analysis.complexity,
                estimatedTime: _analysis.estimatedDuration * 0.4
            });
        }
        // Automation skills
        if (_analysis.requiresAutomation) {
            skills.push({
                type: 'automation-specialist',
                importance: 'primary',
                complexity: _analysis.complexity,
                estimatedTime: _analysis.estimatedDuration * 0.3
            });
        }
        // Reporting skills
        if (_analysis.requiresReporting) {
            skills.push({
                type: 'reporting-specialist',
                importance: 'secondary',
                complexity: _analysis.complexity,
                estimatedTime: _analysis.estimatedDuration * 0.2
            });
        }
        // Security skills
        if (_analysis.requiresSecurity || _analysis.riskLevel === 'high') {
            skills.push({
                type: 'security-specialist',
                importance: 'secondary',
                complexity: _analysis.complexity,
                estimatedTime: _analysis.estimatedDuration * 0.15
            });
        }
        // Add specialized skills based on task type
        switch (_analysis.taskType) {
            case 'workflow_automation':
                skills.push({
                    type: 'workflow-designer',
                    importance: 'primary',
                    complexity: _analysis.complexity,
                    estimatedTime: _analysis.estimatedDuration * 0.5
                });
                break;
            case 'dashboard_creation':
                skills.push({
                    type: 'ui-designer',
                    importance: 'primary',
                    complexity: _analysis.complexity,
                    estimatedTime: _analysis.estimatedDuration * 0.6
                });
                break;
            case 'api_development':
                skills.push({
                    type: 'api-developer',
                    importance: 'primary',
                    complexity: _analysis.complexity,
                    estimatedTime: _analysis.estimatedDuration * 0.7
                });
                break;
        }
        return skills;
    }
    /**
     * Suggest optimal team composition
     */
    async suggestTeamComposition(skills) {
        const primarySpecialists = skills
            .filter(skill => skill.importance === 'primary')
            .map(skill => skill.type);
        const secondarySpecialists = skills
            .filter(skill => skill.importance === 'secondary')
            .map(skill => skill.type);
        const estimatedTeamSize = Math.min(Math.max(primarySpecialists.length + Math.ceil(secondarySpecialists.length / 2), 2), 8);
        let recommendedStructure = 'flat';
        if (estimatedTeamSize > 5) {
            recommendedStructure = 'hierarchical';
        }
        else if (primarySpecialists.length > 3 && secondarySpecialists.length > 2) {
            recommendedStructure = 'matrix';
        }
        return {
            coordinatorRole: 'adaptive-coordinator',
            primarySpecialists,
            secondarySpecialists,
            estimatedTeamSize,
            recommendedStructure
        };
    }
    /**
     * Identify task type from description
     */
    identifyTaskType(description) {
        const typePatterns = {
            'data_integration': ['data', 'integration', 'sync', 'etl', 'import', 'export'],
            'workflow_automation': ['workflow', 'automation', 'process', 'flow', 'approval'],
            'ui_development': ['widget', 'ui', 'interface', 'dashboard', 'portal', 'form'],
            'reporting_analytics': ['report', 'analytics', 'chart', 'graph', 'metrics', 'kpi'],
            'security_compliance': ['security', 'compliance', 'audit', 'access', 'permission'],
            'system_integration': ['api', 'rest', 'soap', 'integration', 'external', 'third-party'],
            'custom_development': ['custom', 'script', 'development', 'code', 'programming'],
            'process_optimization': ['optimize', 'improve', 'enhance', 'streamline'],
            'incident_management': ['incident', 'problem', 'issue', 'ticket', 'support'],
            'catalog_management': ['catalog', 'service', 'item', 'offering', 'request'],
            'user_provisioning': ['user', 'provisioning', 'account', 'access', 'identity'],
            'notification_system': ['notification', 'alert', 'email', 'message', 'notify'],
            'approval_workflow': ['approval', 'approve', 'review', 'authorize'],
            'dashboard_creation': ['dashboard', 'visualization', 'chart', 'report', 'view'],
            'api_development': ['api', 'endpoint', 'service', 'rest', 'web service'],
            'migration_task': ['migrate', 'migration', 'move', 'transfer', 'upgrade'],
            'configuration_management': ['config', 'configuration', 'setting', 'setup'],
            'testing_validation': ['test', 'testing', 'validation', 'verify', 'check'],
            'documentation': ['document', 'documentation', 'guide', 'manual'],
            'monitoring_alerting': ['monitor', 'monitoring', 'alert', 'watch', 'track'],
            'unknown': []
        };
        let bestMatch = 'unknown';
        let maxScore = 0;
        for (const [taskType, patterns] of Object.entries(typePatterns)) {
            const score = patterns.reduce((sum, pattern) => {
                return sum + (description.includes(pattern) ? 1 : 0);
            }, 0);
            if (score > maxScore) {
                maxScore = score;
                bestMatch = taskType;
            }
        }
        return bestMatch;
    }
    /**
     * Assess task complexity
     */
    assessComplexity(description, context) {
        let complexityScore = 0;
        // Keyword-based complexity indicators
        const highComplexityKeywords = ['complex', 'advanced', 'enterprise', 'integration', 'multiple', 'custom'];
        const mediumComplexityKeywords = ['workflow', 'automation', 'report', 'dashboard', 'api'];
        highComplexityKeywords.forEach(keyword => {
            if (description.includes(keyword))
                complexityScore += 2;
        });
        mediumComplexityKeywords.forEach(keyword => {
            if (description.includes(keyword))
                complexityScore += 1;
        });
        // Length-based complexity
        if (description.length > 200)
            complexityScore += 1;
        if (description.length > 500)
            complexityScore += 2;
        // Context-based complexity
        if (context.multipleIntegrations)
            complexityScore += 2;
        if (context.realTimeRequirements)
            complexityScore += 2;
        if (context.highAvailability)
            complexityScore += 1;
        if (complexityScore >= 4)
            return 'high';
        if (complexityScore >= 2)
            return 'medium';
        return 'low';
    }
    /**
     * Identify required components
     */
    identifyRequiredComponents(description) {
        return {
            servicenow: /servicenow|snow|platform|instance/i.test(description),
            data: /data|database|record|table|field/i.test(description),
            integration: /integration|api|rest|soap|external|third-party/i.test(description),
            ui: /ui|interface|widget|portal|form|dashboard/i.test(description),
            automation: /automation|workflow|process|flow|trigger/i.test(description),
            reporting: /report|analytics|chart|graph|metrics/i.test(description),
            security: /security|compliance|audit|access|permission/i.test(description)
        };
    }
    /**
     * Extract key entities from description
     */
    extractKeyEntities(description) {
        const entities = [];
        // Common ServiceNow entities
        const serviceNowEntities = ['incident', 'problem', 'change', 'user', 'group', 'role', 'catalog', 'workflow', 'script', 'table'];
        serviceNowEntities.forEach(entity => {
            if (description.includes(entity)) {
                entities.push(entity);
            }
        });
        // Extract quoted terms
        const quotedTerms = description.match(/["']([^"']+)["']/g);
        if (quotedTerms) {
            quotedTerms.forEach(term => {
                entities.push(term.replace(/["']/g, ''));
            });
        }
        // Extract capitalized terms (likely proper nouns)
        const capitalizedTerms = description.match(/\b[A-Z][a-z]+\b/g);
        if (capitalizedTerms) {
            entities.push(...capitalizedTerms);
        }
        return [...new Set(entities)]; // Remove duplicates
    }
    /**
     * Determine if task can be parallelized
     */
    canTaskParallelize(description, taskType) {
        // Tasks that typically can't be parallelized
        const sequentialTasks = ['approval_workflow', 'migration_task', 'configuration_management'];
        if (sequentialTasks.includes(taskType))
            return false;
        // Check for sequential indicators
        const sequentialIndicators = ['sequential', 'step by step', 'order', 'dependency', 'after', 'then', 'once'];
        if (sequentialIndicators.some(indicator => description.includes(indicator)))
            return false;
        // Tasks that can often be parallelized
        const parallelizableTasks = ['data_integration', 'ui_development', 'reporting_analytics', 'testing_validation'];
        if (parallelizableTasks.includes(taskType))
            return true;
        // Check for parallel indicators
        const parallelIndicators = ['parallel', 'concurrent', 'simultaneously', 'multiple', 'batch'];
        return parallelIndicators.some(indicator => description.includes(indicator));
    }
    /**
     * Determine if task has strict dependencies
     */
    hasStrictDependencies(description, taskType) {
        const dependencyIndicators = ['depend', 'require', 'prerequisite', 'after', 'once', 'before', 'first'];
        const hasDependencyLanguage = dependencyIndicators.some(indicator => description.includes(indicator));
        // Certain task types inherently have dependencies
        const dependentTasks = ['approval_workflow', 'migration_task', 'user_provisioning'];
        return hasDependencyLanguage || dependentTasks.includes(taskType);
    }
    /**
     * Calculate risk level
     */
    calculateRiskLevel(complexity, components, taskType) {
        let riskScore = 0;
        // Complexity risk
        if (complexity === 'high')
            riskScore += 3;
        else if (complexity === 'medium')
            riskScore += 1;
        // Component risk
        if (components.integration)
            riskScore += 2;
        if (components.security)
            riskScore += 2;
        if (components.data)
            riskScore += 1;
        // Task type risk
        const highRiskTasks = ['system_integration', 'migration_task', 'security_compliance'];
        if (highRiskTasks.includes(taskType))
            riskScore += 2;
        if (riskScore >= 5)
            return 'high';
        if (riskScore >= 3)
            return 'medium';
        return 'low';
    }
    /**
     * Generate recommendations
     */
    generateRecommendations(taskType, complexity, components) {
        const recommendations = [];
        if (complexity === 'high') {
            recommendations.push('Consider breaking down this complex task into smaller components');
            recommendations.push('Ensure thorough planning and risk assessment');
        }
        if (components.integration) {
            recommendations.push('Plan for integration testing and error handling');
        }
        if (components.security) {
            recommendations.push('Include security review in the development process');
        }
        if (taskType === 'unknown') {
            recommendations.push('Provide more specific requirements for better _analysis');
        }
        return recommendations;
    }
    /**
     * Estimate task duration in milliseconds
     */
    estimateTaskDuration(taskType, complexity, components) {
        const baseDurations = {
            'data_integration': 3600000, // 1 hour
            'workflow_automation': 7200000, // 2 hours
            'ui_development': 14400000, // 4 hours
            'reporting_analytics': 5400000, // 1.5 hours
            'security_compliance': 10800000, // 3 hours
            'system_integration': 18000000, // 5 hours
            'custom_development': 21600000, // 6 hours
            'process_optimization': 7200000, // 2 hours
            'incident_management': 1800000, // 30 minutes
            'catalog_management': 3600000, // 1 hour
            'user_provisioning': 5400000, // 1.5 hours
            'notification_system': 3600000, // 1 hour
            'approval_workflow': 5400000, // 1.5 hours
            'dashboard_creation': 10800000, // 3 hours
            'api_development': 14400000, // 4 hours
            'migration_task': 28800000, // 8 hours
            'configuration_management': 3600000, // 1 hour
            'testing_validation': 7200000, // 2 hours
            'documentation': 5400000, // 1.5 hours
            'monitoring_alerting': 5400000, // 1.5 hours
            'unknown': 7200000 // 2 hours default
        };
        let duration = baseDurations[taskType] || baseDurations['unknown'];
        // Complexity multiplier
        if (complexity === 'high')
            duration *= 2;
        else if (complexity === 'medium')
            duration *= 1.5;
        // Component multipliers
        if (components.integration)
            duration *= 1.3;
        if (components.security)
            duration *= 1.2;
        if (components.ui)
            duration *= 1.4;
        return Math.round(duration);
    }
    /**
     * Estimate success rate based on task characteristics
     */
    estimateSuccessRate(taskType, complexity) {
        let baseRate = 0.85; // 85% base success rate
        // Adjust based on complexity
        if (complexity === 'high')
            baseRate -= 0.2;
        else if (complexity === 'medium')
            baseRate -= 0.1;
        // Adjust based on task type
        const reliableTaskTypes = ['configuration_management', 'documentation', 'catalog_management'];
        const challengingTaskTypes = ['system_integration', 'migration_task', 'custom_development'];
        if (reliableTaskTypes.includes(taskType))
            baseRate += 0.1;
        if (challengingTaskTypes.includes(taskType))
            baseRate -= 0.15;
        return Math.max(0.3, Math.min(0.95, baseRate));
    }
    /**
     * Assess business impact
     */
    assessBusinessImpact(description, taskType) {
        const highImpactKeywords = ['critical', 'urgent', 'production', 'enterprise', 'business-critical'];
        const highImpactTasks = ['system_integration', 'migration_task', 'security_compliance'];
        if (highImpactKeywords.some(keyword => description.includes(keyword)) ||
            highImpactTasks.includes(taskType)) {
            return 'high';
        }
        const mediumImpactKeywords = ['important', 'workflow', 'automation', 'user'];
        if (mediumImpactKeywords.some(keyword => description.includes(keyword))) {
            return 'medium';
        }
        return 'low';
    }
    /**
     * Initialize knowledge base with patterns and learnings
     */
    initializeKnowledgeBase() {
        // This would typically be loaded from a database or configuration
        this.knowledgeBase.set('task_patterns', {
        // Common task patterns and their characteristics
        });
        this.knowledgeBase.set('skill_mappings', {
        // Mapping of task types to required skills
        });
        this.knowledgeBase.set('historical_data', {
        // Historical task performance data
        });
    }
    /**
     * Initialize pattern library
     */
    initializePatternLibrary() {
        // This would typically be loaded from a configuration file
        this.patternLibrary = [
        // Common task execution patterns
        ];
    }
}
exports.TaskAnalyzer = TaskAnalyzer;
//# sourceMappingURL=task-analyzer.js.map