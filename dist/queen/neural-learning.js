"use strict";
/**
 * ServiceNow Queen Neural Learning System
 * Pattern recognition and adaptive learning from deployment history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NeuralLearning = void 0;
class NeuralLearning {
    constructor(memory) {
        this.memory = memory;
        this.learningWeights = new Map();
        this.initializeLearningWeights();
    }
    initializeLearningWeights() {
        // Simple neural weights for pattern recognition
        this.learningWeights.set('widget', [
            { factor: 'frontend_complexity', weight: 0.3, confidence: 0.8 },
            { factor: 'backend_complexity', weight: 0.25, confidence: 0.8 },
            { factor: 'chart_integration', weight: 0.2, confidence: 0.9 },
            { factor: 'data_sources', weight: 0.15, confidence: 0.7 },
            { factor: 'responsive_design', weight: 0.1, confidence: 0.6 }
        ]);
        this.learningWeights.set('flow', [
            { factor: 'approval_steps', weight: 0.4, confidence: 0.9 },
            { factor: 'integration_points', weight: 0.25, confidence: 0.8 },
            { factor: 'conditional_logic', weight: 0.2, confidence: 0.7 },
            { factor: 'notification_complexity', weight: 0.15, confidence: 0.8 }
        ]);
        this.learningWeights.set('application', [
            { factor: 'table_complexity', weight: 0.35, confidence: 0.9 },
            { factor: 'business_rules', weight: 0.25, confidence: 0.8 },
            { factor: 'ui_components', weight: 0.2, confidence: 0.7 },
            { factor: 'integration_scope', weight: 0.2, confidence: 0.8 }
        ]);
    }
    // Analyze task objective and suggest optimal approach
    analyzeTask(objective) {
        const taskType = this.classifyTask(objective);
        const complexity = this.estimateComplexity(objective, taskType);
        const requiredAgents = this.suggestAgents(objective, taskType, complexity);
        const dependencies = this.identifyDependencies(objective);
        const bestPattern = this.memory.getBestPattern(taskType);
        return {
            type: taskType,
            requiredAgents,
            estimatedComplexity: complexity,
            suggestedPattern: bestPattern,
            dependencies
        };
    }
    // Classify task type using learned patterns
    classifyTask(objective) {
        const lowerObjective = objective.toLowerCase();
        // Priority-based pattern matching - check most specific patterns first
        const patterns = [
            // Check for specific flow indicators first (highest priority)
            { type: 'flow', keywords: ['workflow', 'flow', 'approval', 'process'], priority: 100 },
            { type: 'integration', keywords: ['integration', 'api', 'sync', 'connect'], priority: 90 },
            { type: 'script', keywords: ['script', 'rule', 'function'], priority: 80 },
            { type: 'application', keywords: ['application', 'app', 'system', 'module'], priority: 70 },
            // Widget patterns last (lowest priority) to avoid conflicts
            { type: 'widget', keywords: ['widget', 'dashboard', 'chart', 'display', 'portal', 'ui'], priority: 60 }
        ];
        // Find best match based on both keyword presence and priority
        let bestMatch = null;
        for (const pattern of patterns) {
            const matchCount = pattern.keywords.filter(keyword => lowerObjective.includes(keyword)).length;
            if (matchCount > 0) {
                // Score combines match count, priority, and keyword density
                const keywordDensity = matchCount / pattern.keywords.length;
                const score = (matchCount * pattern.priority) + (keywordDensity * 50);
                if (!bestMatch || score > bestMatch.score) {
                    bestMatch = { type: pattern.type, score };
                }
            }
        }
        if (bestMatch) {
            // Store learning about classification confidence
            const confidence = Math.min(1, bestMatch.score / 200); // Normalize score to 0-1
            this.memory.storeLearning(`classification_${bestMatch.type}`, objective, confidence);
            return bestMatch.type;
        }
        return 'unknown';
    }
    // Estimate task complexity using neural weights
    estimateComplexity(objective, taskType) {
        const weights = this.learningWeights.get(taskType);
        if (!weights)
            return 0.5; // Default medium complexity
        let totalComplexity = 0;
        let totalWeight = 0;
        for (const weight of weights) {
            const factorComplexity = this.evaluateComplexityFactor(objective, weight.factor);
            totalComplexity += factorComplexity * weight.weight * weight.confidence;
            totalWeight += weight.weight * weight.confidence;
        }
        return totalWeight > 0 ? Math.min(1, totalComplexity / totalWeight) : 0.5;
    }
    // Evaluate individual complexity factors
    evaluateComplexityFactor(objective, factor) {
        const lowerObjective = objective.toLowerCase();
        switch (factor) {
            case 'frontend_complexity':
                return this.countKeywords(lowerObjective, ['chart', 'graph', 'responsive', 'mobile', 'animation']) * 0.2;
            case 'backend_complexity':
                return this.countKeywords(lowerObjective, ['calculation', 'aggregation', 'api', 'database', 'query']) * 0.25;
            case 'chart_integration':
                return this.countKeywords(lowerObjective, ['chart', 'graph', 'visualization', 'metrics']) * 0.3;
            case 'approval_steps':
                return this.countKeywords(lowerObjective, ['approval', 'review', 'escalation', 'multi-step']) * 0.3;
            case 'integration_points':
                return this.countKeywords(lowerObjective, ['external', 'api', 'third-party', 'sync']) * 0.35;
            case 'table_complexity':
                return this.countKeywords(lowerObjective, ['table', 'relationship', 'hierarchy', 'custom']) * 0.25;
            default:
                return 0.2; // Default factor complexity
        }
    }
    countKeywords(text, keywords) {
        return Math.min(1, keywords.filter(keyword => text.includes(keyword)).length / keywords.length);
    }
    // Suggest optimal agent sequence based on learned patterns
    suggestAgents(objective, taskType, complexity) {
        const baseAgents = {
            widget: complexity > 0.7
                ? ['researcher', 'widget-creator', 'tester']
                : ['widget-creator', 'tester'],
            flow: complexity > 0.6
                ? ['researcher', 'flow-builder', 'integration-specialist', 'tester']
                : ['flow-builder', 'tester'],
            script: ['script-writer', 'tester'],
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
            unknown: ['researcher', 'widget-creator'] // Default fallback
        };
        // Add catalog manager if catalog-related
        const agents = [...baseAgents[taskType]];
        if (objective.toLowerCase().includes('catalog') || objective.toLowerCase().includes('request')) {
            agents.splice(-1, 0, 'catalog-manager'); // Add before tester
        }
        return agents;
    }
    // Identify task dependencies
    identifyDependencies(objective) {
        const dependencies = [];
        const lowerObjective = objective.toLowerCase();
        if (lowerObjective.includes('chart') || lowerObjective.includes('graph')) {
            dependencies.push('Chart.js library');
        }
        if (lowerObjective.includes('approval') || lowerObjective.includes('workflow')) {
            dependencies.push('Approval engine configuration');
        }
        if (lowerObjective.includes('catalog')) {
            dependencies.push('Service catalog setup');
        }
        if (lowerObjective.includes('integration') || lowerObjective.includes('api')) {
            dependencies.push('External API configuration');
        }
        return dependencies;
    }
    // Learn from successful deployment
    learnFromSuccess(task, duration, agentsUsed) {
        const pattern = {
            taskType: task.type,
            successRate: this.calculateNewSuccessRate(task.type, true),
            agentSequence: agentsUsed,
            mcpSequence: this.inferMcpSequence(task.type),
            avgDuration: duration,
            lastUsed: new Date()
        };
        this.memory.storePattern(pattern);
        // Learn specific insights
        this.memory.storeLearning(`success_pattern_${task.type}`, `Successful ${task.type} with agents: ${agentsUsed.join(', ')}`, 0.9);
        // Adjust neural weights based on success
        this.adjustWeightsFromSuccess(task.type, task.objective);
    }
    // Learn from failed deployment
    learnFromFailure(task, error, agentsUsed) {
        this.memory.storeLearning(`failure_pattern_${task.type}`, `Failed ${task.type}: ${error}. Agents used: ${agentsUsed.join(', ')}`, 0.8);
        // Adjust success rates
        this.calculateNewSuccessRate(task.type, false);
        // Learn what NOT to do
        this.adjustWeightsFromFailure(task.type, error);
    }
    calculateNewSuccessRate(taskType, success) {
        const currentRate = this.memory.getSuccessRate(taskType);
        const adjustment = success ? 0.1 : -0.1;
        return Math.max(0, Math.min(1, currentRate + adjustment));
    }
    inferMcpSequence(taskType) {
        const mcpSequences = {
            widget: ['snow_deploy', 'snow_preview_widget', 'snow_widget_test'],
            flow: ['snow_create_flow', 'snow_test_flow_with_mock', 'snow_comprehensive_flow_test'],
            script: ['snow_create_script_include', 'snow_create_business_rule'],
            application: ['snow_deploy', 'snow_create_table', 'snow_create_ui_policy'],
            integration: ['snow_create_rest_message', 'snow_test_integration'],
            portal_page: ['snow_deploy', 'snow_preview_widget', 'snow_widget_test'],
            workspace: ['snow_create_complete_workspace', 'snow_create_ux_app_route', 'snow_create_uib_page'],
            unknown: ['snow_find_artifact', 'snow_analyze_requirements']
        };
        return mcpSequences[taskType];
    }
    adjustWeightsFromSuccess(taskType, objective) {
        const weights = this.learningWeights.get(taskType);
        if (!weights)
            return;
        // Increase confidence in successful patterns
        weights.forEach(weight => {
            if (this.evaluateComplexityFactor(objective, weight.factor) > 0.5) {
                weight.confidence = Math.min(1, weight.confidence + 0.05);
            }
        });
    }
    adjustWeightsFromFailure(taskType, error) {
        const weights = this.learningWeights.get(taskType);
        if (!weights)
            return;
        // Decrease confidence in failed patterns
        const lowerError = error.toLowerCase();
        weights.forEach(weight => {
            if (lowerError.includes(weight.factor.replace('_', ' '))) {
                weight.confidence = Math.max(0.1, weight.confidence - 0.1);
            }
        });
    }
    // Get learning insights for debugging
    getLearningInsights() {
        return {
            weights: Array.from(this.learningWeights.entries()),
            recentPatterns: this.memory.getBestPattern('widget'),
            confidenceLevels: this.calculateOverallConfidence()
        };
    }
    calculateOverallConfidence() {
        const confidence = {};
        for (const [taskType, weights] of Array.from(this.learningWeights.entries())) {
            const avgConfidence = weights.reduce((sum, w) => sum + w.confidence, 0) / weights.length;
            confidence[taskType] = avgConfidence;
        }
        return confidence;
    }
}
exports.NeuralLearning = NeuralLearning;
//# sourceMappingURL=neural-learning.js.map