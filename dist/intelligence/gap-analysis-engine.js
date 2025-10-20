"use strict";
/**
 * Intelligent Gap Analysis Engine - The core orchestrator
 *
 * This is the main engine that orchestrates all components to analyze objectives,
 * detect missing ServiceNow configurations beyond MCP tools, and attempt automated
 * resolution with fallback to detailed manual instructions.
 *
 * This fulfills the user's vision: "alle mogelijke soorten handelingen die nodig
 * zouden zijn om een objective te bereiken die vallen buiten de standaard mcps"
 *
 * Usage:
 *   const engine = new GapAnalysisEngine(mcpTools, logger, autoPermissions);
 *   const result = await engine.analyzeAndResolve("create incident widget with charts");
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GapAnalysisEngine = void 0;
exports.analyzeGaps = analyzeGaps;
exports.quickAnalyze = quickAnalyze;
const requirements_analyzer_1 = require("./requirements-analyzer");
const mcp_coverage_analyzer_1 = require("./mcp-coverage-analyzer");
const auto_resolution_engine_1 = require("./auto-resolution-engine");
const manual_instructions_generator_1 = require("./manual-instructions-generator");
class GapAnalysisEngine {
    constructor(mcpTools, logger, autoPermissions = false) {
        this.mcpTools = mcpTools;
        this.logger = logger;
        this.autoResolutionEngine = new auto_resolution_engine_1.AutoResolutionEngine(mcpTools, logger, autoPermissions);
    }
    /**
     * Main entry point - analyze objective and resolve all gaps
     */
    async analyzeAndResolve(objective, options = {}) {
        const startTime = Date.now();
        const analysisId = `gap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.logger.info(`🧠 Starting Intelligent Gap Analysis for: "${objective}"`);
        this.logger.info(`📊 Analysis ID: ${analysisId}`);
        try {
            // Step 1: Analyze requirements from natural language objective
            this.logger.info('🔍 Step 1: Analyzing requirements...');
            const requirementsAnalysis = requirements_analyzer_1.RequirementsAnalyzer.analyzeObjective(objective);
            if (requirementsAnalysis.requirements.length === 0) {
                this.logger.warn('⚠️ No specific ServiceNow requirements detected');
                return this.createEmptyResult(objective, analysisId, startTime);
            }
            this.logger.info(`📋 Detected ${requirementsAnalysis.requirements.length} requirements`);
            // Step 2: Analyze MCP coverage vs gaps
            this.logger.info('🎯 Step 2: Analyzing MCP coverage...');
            const mcpCoverage = mcp_coverage_analyzer_1.McpCoverageAnalyzer.analyzeCoverage(requirementsAnalysis.requirements);
            this.logger.info(`✅ MCP Coverage: ${mcpCoverage.coveragePercentage}% (${mcpCoverage.covered.length}/${requirementsAnalysis.requirements.length})`);
            this.logger.info(`❌ Gaps requiring attention: ${mcpCoverage.gaps.length}`);
            this.logger.info(`⚠️ Partial coverage items: ${mcpCoverage.partialCoverage.length}`);
            // Step 3: Attempt automated resolution for gaps
            let automationResults;
            if (options.enableAutomation !== false && !options.dryRun) {
                this.logger.info('🤖 Step 3: Attempting automated resolution...');
                automationResults = await this.autoResolutionEngine.resolveBulk(mcpCoverage.gaps);
                this.logger.info(`🚀 Automation complete: ${automationResults.successRate}% success rate`);
                this.logger.info(`✅ Automated: ${automationResults.successful.length}`);
                this.logger.info(`❌ Failed: ${automationResults.failed.length}`);
                this.logger.info(`📋 Manual: ${automationResults.manual.length}`);
            }
            else {
                // Dry run or automation disabled
                automationResults = {
                    successful: [],
                    failed: [],
                    manual: mcpCoverage.gaps.map(req => ({
                        requirement: req,
                        status: 'manual_required',
                        manualSteps: ['Automation disabled - manual configuration required']
                    })),
                    totalTime: 0,
                    successRate: 0,
                    recommendations: ['Enable automation to attempt automatic resolution']
                };
            }
            // Step 4: Generate manual guides for remaining gaps
            let manualGuides = null;
            const manualRequirements = [
                ...automationResults.failed.map(r => r.requirement),
                ...automationResults.manual.map(r => r.requirement)
            ];
            if (manualRequirements.length > 0 && options.includeManualGuides !== false) {
                this.logger.info(`📚 Step 4: Generating manual guides for ${manualRequirements.length} items...`);
                manualGuides = manual_instructions_generator_1.ManualInstructionsGenerator.generateBulkInstructions(manualRequirements);
            }
            // Step 5: Build comprehensive result
            const totalTime = Date.now() - startTime;
            const result = this.buildGapAnalysisResult(objective, analysisId, startTime, requirementsAnalysis, mcpCoverage, automationResults, manualGuides, totalTime);
            this.logger.info(`🎉 Gap Analysis complete in ${totalTime}ms`);
            this.logger.info(`📊 Final Summary:`);
            this.logger.info(`  • Total Requirements: ${result.totalRequirements}`);
            this.logger.info(`  • MCP Coverage: ${result.mcpCoverage.coveragePercentage}%`);
            this.logger.info(`  • Automation Rate: ${result.summary.automationRate}%`);
            this.logger.info(`  • Manual Work Required: ${result.summary.requiresManualWork} items`);
            return result;
        }
        catch (error) {
            this.logger.error('❌ Gap Analysis failed:', error);
            throw new Error(`Gap Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Quick _analysis without resolution - useful for planning
     */
    async analyzeOnly(objective) {
        this.logger.info(`🔍 Quick _analysis for: "${objective}"`);
        const _analysis = requirements_analyzer_1.RequirementsAnalyzer.analyzeObjective(objective);
        const coverage = mcp_coverage_analyzer_1.McpCoverageAnalyzer.analyzeCoverage(_analysis.requirements);
        let canAutomate = coverage.covered.length;
        let requiresManual = coverage.gaps.length;
        // Check automation capabilities for gaps
        for (const gap of coverage.gaps) {
            if (this.autoResolutionEngine.canAutoResolve(gap)) {
                canAutomate++;
                requiresManual--;
            }
        }
        const estimatedTime = this.estimateTotalTime(_analysis.requirements, canAutomate, requiresManual);
        return {
            requirements: _analysis.requirements,
            coverage,
            canAutomate,
            requiresManual,
            estimatedTime
        };
    }
    /**
     * Get detailed _analysis for a specific requirement type
     */
    analyzeRequirementType(requirementType) {
        const mcpTools = mcp_coverage_analyzer_1.McpCoverageAnalyzer.getAvailableTools(requirementType);
        const automationStrategies = this.autoResolutionEngine.getResolutionStrategies(requirementType);
        return {
            mcpTools: mcpTools.map(tool => tool.tool),
            automationStrategies: automationStrategies.map(strategy => strategy.automationMethod),
            manualSteps: automationStrategies.flatMap(strategy => strategy.fallbackInstructions),
            riskLevel: automationStrategies[0]?.riskLevel || 'medium'
        };
    }
    // Private helper methods
    createEmptyResult(objective, analysisId, startTime) {
        return {
            objective,
            analysisId,
            timestamp: startTime,
            requirements: [],
            totalRequirements: 0,
            mcpCoverage: {
                covered: [],
                gaps: [],
                partialCoverage: [],
                coveragePercentage: 100,
                recommendations: ['No specific ServiceNow requirements detected in objective']
            },
            automationResults: {
                successful: [],
                failed: [],
                manual: [],
                totalTime: 0,
                successRate: 100,
                recommendations: ['Consider more specific ServiceNow requirements']
            },
            manualGuides: null,
            summary: {
                totalTime: Date.now() - startTime,
                automationRate: 100,
                successfulAutomation: 0,
                requiresManualWork: 0,
                completionPercentage: 100
            },
            nextSteps: {
                automated: [],
                manual: ['Refine objective with specific ServiceNow requirements'],
                recommendations: ['Use more specific ServiceNow terminology in objective'],
                risks: []
            },
            executionPlan: []
        };
    }
    buildGapAnalysisResult(objective, analysisId, startTime, requirementsAnalysis, mcpCoverage, automationResults, manualGuides, totalTime) {
        const totalRequirements = requirementsAnalysis.requirements.length;
        const automationRate = totalRequirements > 0
            ? Math.round(((automationResults.successful.length) / totalRequirements) * 100)
            : 100;
        const completionPercentage = totalRequirements > 0
            ? Math.round(((mcpCoverage.covered.length + automationResults.successful.length) / totalRequirements) * 100)
            : 100;
        return {
            objective,
            analysisId,
            timestamp: startTime,
            requirements: requirementsAnalysis.requirements,
            totalRequirements,
            mcpCoverage,
            automationResults,
            manualGuides,
            summary: {
                totalTime,
                automationRate,
                successfulAutomation: automationResults.successful.length,
                requiresManualWork: automationResults.failed.length + automationResults.manual.length,
                completionPercentage
            },
            nextSteps: this.generateNextSteps(mcpCoverage, automationResults, manualGuides),
            executionPlan: this.generateExecutionPlan(mcpCoverage, automationResults, manualGuides)
        };
    }
    generateNextSteps(mcpCoverage, automationResults, manualGuides) {
        const automated = [];
        const manual = [];
        const recommendations = [];
        const risks = [];
        // MCP-covered items
        if (mcpCoverage.covered.length > 0) {
            automated.push(`✅ ${mcpCoverage.covered.length} items fully covered by MCP tools`);
        }
        // Successfully automated items
        if (automationResults.successful.length > 0) {
            automated.push(`🤖 ${automationResults.successful.length} gaps automatically resolved`);
        }
        // Failed automation items
        if (automationResults.failed.length > 0) {
            manual.push(`❌ ${automationResults.failed.length} automation attempts failed - manual setup required`);
            recommendations.push('Review failed automation attempts and adjust permissions or configurations');
        }
        // Manual-only items
        if (automationResults.manual.length > 0) {
            manual.push(`📋 ${automationResults.manual.length} items require manual configuration`);
        }
        // Manual guides available
        if (manualGuides) {
            manual.push(`📚 Detailed manual guides available for ${manualGuides.guides.length} configurations`);
        }
        // Recommendations from sub-systems
        recommendations.push(...mcpCoverage.recommendations);
        recommendations.push(...automationResults.recommendations);
        // Risk identification
        if (manualGuides?.overallRisks) {
            risks.push(...manualGuides.overallRisks);
        }
        // Add strategic recommendations
        const automationRate = automationResults.successful.length /
            (automationResults.successful.length + automationResults.failed.length + automationResults.manual.length);
        if (automationRate < 0.5) {
            recommendations.push('💡 Consider enabling auto-permissions to increase automation success rate');
        }
        if (manual.length > automated.length) {
            recommendations.push('🔧 Significant manual work required - consider phased implementation approach');
        }
        return { automated, manual, recommendations, risks };
    }
    generateExecutionPlan(mcpCoverage, automationResults, manualGuides) {
        const plan = [];
        // Phase 1: MCP Tool Deployment
        if (mcpCoverage.covered.length > 0) {
            plan.push({
                phase: 'Phase 1: MCP Tool Deployment',
                description: 'Deploy artifacts using standard MCP tools',
                estimatedTime: `${mcpCoverage.covered.length * 3} minutes`,
                status: 'pending',
                actions: mcpCoverage.covered.map(req => `Deploy ${req.type}: ${req.name}`)
            });
        }
        // Phase 2: Automated Gap Resolution
        if (automationResults.successful.length > 0) {
            plan.push({
                phase: 'Phase 2: Automated Gap Resolution',
                description: 'Automatically resolve configuration gaps',
                estimatedTime: `${automationResults.totalTime}ms`,
                status: 'completed',
                actions: automationResults.successful.map(res => `✅ Automated: ${res.requirement.type} - ${res.requirement.name}`)
            });
        }
        // Phase 3: Manual Configuration
        const manualItems = automationResults.failed.length + automationResults.manual.length;
        if (manualItems > 0) {
            plan.push({
                phase: 'Phase 3: Manual Configuration',
                description: 'Complete remaining configurations manually',
                estimatedTime: manualGuides?.executionOrder.reduce((total, phase) => total + parseInt(phase.estimatedTime.match(/\d+/)?.[0] || '10'), 0) + ' minutes' || `${manualItems * 15} minutes`,
                status: 'manual_required',
                actions: [
                    ...automationResults.failed.map(res => `❌ Manual fix needed: ${res.requirement.name}`),
                    ...automationResults.manual.map(res => `📋 Manual setup: ${res.requirement.name}`)
                ]
            });
        }
        return plan;
    }
    estimateTotalTime(requirements, canAutomate, requiresManual) {
        const automationTime = canAutomate * 2; // 2 minutes per automated item
        const manualTime = requiresManual * 15; // 15 minutes per manual item
        const totalMinutes = automationTime + manualTime;
        if (totalMinutes < 60) {
            return `${totalMinutes} minutes`;
        }
        else {
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return `${hours}h ${minutes}m`;
        }
    }
}
exports.GapAnalysisEngine = GapAnalysisEngine;
/**
 * Convenience function for quick gap analysis
 */
async function analyzeGaps(objective, mcpTools, logger, options = {}) {
    const engine = new GapAnalysisEngine(mcpTools, logger, options.autoPermissions);
    return engine.analyzeAndResolve(objective, options);
}
/**
 * Quick _analysis without resolution
 */
function quickAnalyze(objective) {
    const _analysis = requirements_analyzer_1.RequirementsAnalyzer.analyzeObjective(objective);
    const coverage = mcp_coverage_analyzer_1.McpCoverageAnalyzer.analyzeCoverage(_analysis.requirements);
    let estimatedComplexity = 'simple';
    if (_analysis.requirements.length > 10 || coverage.coveragePercentage < 50) {
        estimatedComplexity = 'complex';
    }
    else if (_analysis.requirements.length > 5 || coverage.coveragePercentage < 80) {
        estimatedComplexity = 'moderate';
    }
    return {
        requirements: _analysis.requirements,
        coverage,
        estimatedComplexity
    };
}
//# sourceMappingURL=gap-analysis-engine.js.map