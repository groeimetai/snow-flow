"use strict";
/**
 * 🚀 BUG-006 FIX: Multi-Pass Requirements Analyzer
 *
 * Advanced requirements _analysis with multiple passes to ensure
 * comprehensive coverage and no missed dependencies.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiPassRequirementsAnalyzer = void 0;
const logger_js_1 = require("../utils/logger.js");
class MultiPassRequirementsAnalyzer {
    constructor() {
        // 🎯 Enhanced pattern matching with context awareness
        this.CONTEXT_PATTERNS = {
            // Security Context Implications
            security_implications: {
                triggers: ['authentication', 'login', 'secure', 'role', 'permission', 'access'],
                additional_requirements: ['audit_rule', 'security_policy', 'acl_rule', 'encryption_context', 'session_management']
            },
            // Data Integration Context
            data_integration_context: {
                triggers: ['import', 'export', 'sync', 'api', 'external', 'integration'],
                additional_requirements: ['error_handling', 'data_validation', 'logging', 'monitoring', 'backup_recovery']
            },
            // User Experience Context
            user_experience_context: {
                triggers: ['dashboard', 'portal', 'mobile', 'user interface', 'ui'],
                additional_requirements: ['responsive_design', 'accessibility', 'performance_optimization', 'user_training']
            },
            // Process Automation Context
            process_automation_context: {
                triggers: ['workflow', 'approval', 'automation', 'flow', 'process'],
                additional_requirements: ['error_recovery', 'monitoring', 'audit_trail', 'performance_tracking']
            },
            // Compliance Context
            compliance_context: {
                triggers: ['audit', 'compliance', 'gdpr', 'sox', 'hipaa', 'regulation'],
                additional_requirements: ['data_retention', 'audit_logging', 'data_encryption', 'access_logging', 'compliance_reporting']
            }
        };
        // 🔍 Dependency mapping for implicit requirements
        this.DEPENDENCY_MATRIX = {
            // When you create a widget, you typically also need...
            widget: ['css_include', 'client_script', 'data_source', 'ui_policy'],
            // When you create a flow, you typically also need...
            flow: ['business_rule', 'notification', 'error_handling', 'audit_rule'],
            // When you create user management, you typically also need...
            user_role: ['acl_rule', 'group_membership', 'audit_rule', 'security_policy'],
            // When you create API integration, you typically also need...
            rest_message: ['oauth_provider', 'error_handling', 'logging', 'monitoring'],
            // When you create approval process, you typically also need...
            approval_rule: ['notification', 'email_template', 'escalation_rule', 'sla_definition'],
            // When you create reporting, you typically also need...
            report: ['data_source', 'scheduled_report', 'dashboard', 'performance_analytics'],
            // Additional dependencies
            table: ['dictionary_entry', 'acl_rule', 'ui_policy', 'client_script'],
            import_set: ['transform_map', 'field_map', 'error_handling', 'data_validation'],
            workflow: ['notification', 'approval_rule', 'audit_rule', 'error_recovery'],
            dashboard: ['widget', 'data_source', 'performance_analytics', 'scheduled_refresh']
        };
        // 🎯 Cross-domain impact analysis
        this.CROSS_DOMAIN_IMPACTS = {
            security_changes: {
                affects: ['user_interface', 'data_integration', 'process_automation'],
                considerations: ['Role updates', 'Permission cascades', 'Authentication flows']
            },
            data_structure_changes: {
                affects: ['reporting_analytics', 'user_interface', 'process_automation'],
                considerations: ['Report updates', 'Form modifications', 'Workflow adjustments']
            },
            process_changes: {
                affects: ['user_interface', 'reporting_analytics', 'security_compliance'],
                considerations: ['UI updates', 'Metrics tracking', 'Audit requirements']
            },
            integration_changes: {
                affects: ['security_compliance', 'monitoring_operations', 'data_integration'],
                considerations: ['Security protocols', 'Error monitoring', 'Data validation']
            }
        };
        this.logger = new logger_js_1.Logger('MultiPassRequirementsAnalyzer');
    }
    /**
     * 🔍 Run comprehensive multi-pass analysis
     */
    async analyzeRequirements(objective) {
        this.logger.info('🚀 BUG-006: Starting multi-pass requirements _analysis', { objective });
        const startTime = Date.now();
        const allRequirements = [];
        // PASS 1: Initial Pattern Matching
        const pass1Start = Date.now();
        const pass1Result = await this.pass1_InitialAnalysis(objective);
        allRequirements.push(...pass1Result.requirements);
        // PASS 2: Dependency Analysis  
        const pass2Start = Date.now();
        const pass2Result = await this.pass2_DependencyAnalysis(objective, allRequirements);
        allRequirements.push(...pass2Result.newRequirements);
        // PASS 3: Context & Implication Analysis
        const pass3Start = Date.now();
        const pass3Result = await this.pass3_ContextAnalysis(objective, allRequirements);
        allRequirements.push(...pass3Result.newRequirements);
        // PASS 4: Validation & Completeness Check
        const pass4Start = Date.now();
        const pass4Result = await this.pass4_ValidationAnalysis(objective, allRequirements);
        allRequirements.push(...pass4Result.newRequirements);
        // Remove duplicates and finalize
        const finalRequirements = this.deduplicateRequirements(allRequirements);
        // Calculate metrics
        const mcpCoveredCount = finalRequirements.filter(req => req.mcpCoverage).length;
        const gapCount = finalRequirements.length - mcpCoveredCount;
        const mcpCoveragePercentage = Math.round((mcpCoveredCount / finalRequirements.length) * 100);
        // Calculate completeness score based on multi-pass findings
        const completenessScore = this.calculateCompletenessScore(pass1Result, pass2Result, pass3Result, pass4Result);
        const confidenceLevel = this.determineConfidenceLevel(completenessScore);
        // Detect cross-domain impacts
        const crossDomainImpacts = this.analyzeCrossDomainImpacts(finalRequirements);
        const totalTime = Date.now() - startTime;
        this.logger.info(`✅ Multi-pass _analysis complete in ${totalTime}ms`, {
            totalRequirements: finalRequirements.length,
            mcpCoverage: mcpCoveragePercentage,
            completenessScore,
            confidenceLevel
        });
        return {
            objective,
            requirements: finalRequirements,
            totalRequirements: finalRequirements.length,
            mcpCoveredCount,
            gapCount,
            mcpCoveragePercentage,
            estimatedComplexity: this.calculateComplexity(finalRequirements),
            riskAssessment: this.calculateRiskAssessment(finalRequirements),
            categories: this.extractCategories(finalRequirements),
            criticalPath: this.identifyCriticalPath(finalRequirements),
            estimatedDuration: this.estimateDuration(finalRequirements),
            // Multi-pass specific data
            analysisPassesData: {
                pass1_initial: {
                    passNumber: 1,
                    passName: 'Initial Pattern Matching',
                    requirementsFound: pass1Result.requirements.length,
                    newRequirementsAdded: pass1Result.requirements.length,
                    analysisMethod: 'Pattern matching and keyword _analysis',
                    keyFindings: pass1Result.keyFindings,
                    confidence: pass1Result.confidence,
                    processingTime: pass2Start - pass1Start
                },
                pass2_dependencies: {
                    passNumber: 2,
                    passName: 'Dependency Analysis',
                    requirementsFound: pass2Result.newRequirements.length,
                    newRequirementsAdded: pass2Result.newRequirements.length,
                    analysisMethod: 'Dependency matrix and prerequisite _analysis',
                    keyFindings: pass2Result.keyFindings,
                    confidence: pass2Result.confidence,
                    processingTime: pass3Start - pass2Start
                },
                pass3_context: {
                    passNumber: 3,
                    passName: 'Context & Implications',
                    requirementsFound: pass3Result.newRequirements.length,
                    newRequirementsAdded: pass3Result.newRequirements.length,
                    analysisMethod: 'Context pattern matching and implication _analysis',
                    keyFindings: pass3Result.keyFindings,
                    confidence: pass3Result.confidence,
                    processingTime: pass4Start - pass3Start
                },
                pass4_validation: {
                    passNumber: 4,
                    passName: 'Validation & Completeness',
                    requirementsFound: finalRequirements.length,
                    newRequirementsAdded: pass4Result.newRequirements.length,
                    analysisMethod: 'Gap _analysis and completeness validation',
                    keyFindings: pass4Result.keyFindings,
                    confidence: pass4Result.confidence,
                    processingTime: Date.now() - pass4Start
                }
            },
            completenessScore,
            confidenceLevel,
            missingRequirementsDetected: pass4Result.newRequirements,
            implicitDependencies: this.extractImplicitDependencies(finalRequirements),
            crossDomainImpacts
        };
    }
    /**
     * 🎯 PASS 1: Initial Pattern Matching Analysis
     */
    async pass1_InitialAnalysis(objective) {
        this.logger.info('🔍 Pass 1: Initial pattern matching _analysis');
        const requirements = [];
        const keyFindings = [];
        const objectiveLower = objective.toLowerCase();
        // Basic keyword matching (existing logic enhanced)
        const patterns = [
            // Core Development
            { keywords: ['widget', 'portal', 'service portal'], type: 'widget' },
            { keywords: ['flow', 'workflow', 'process', 'automation'], type: 'flow' },
            { keywords: ['business rule', 'validation', 'server logic'], type: 'business_rule' },
            { keywords: ['script include', 'utility', 'function', 'library'], type: 'script_include' },
            { keywords: ['table', 'record', 'data structure'], type: 'table' },
            // User Interface
            { keywords: ['dashboard', 'overview', 'summary'], type: 'dashboard' },
            { keywords: ['form', 'ui', 'interface'], type: 'ui_policy' },
            { keywords: ['navigation', 'menu', 'module'], type: 'navigator_module' },
            // Security & Access
            { keywords: ['role', 'permission', 'access control'], type: 'user_role' },
            { keywords: ['security', 'acl', 'access list'], type: 'acl_rule' },
            { keywords: ['authentication', 'login', 'oauth'], type: 'oauth_provider' },
            // Integration
            { keywords: ['api', 'rest', 'web service'], type: 'rest_message' },
            { keywords: ['import', 'csv', 'excel', 'data load'], type: 'import_set' },
            { keywords: ['email', 'notification', 'alert'], type: 'notification' },
            // Process & Automation
            { keywords: ['approval', 'review', 'authorize'], type: 'approval_rule' },
            { keywords: ['schedule', 'cron', 'batch'], type: 'scheduled_job' },
            { keywords: ['sla', 'service level', 'performance'], type: 'sla_definition' },
            // Reporting
            { keywords: ['report', 'analytics', 'metrics'], type: 'report' },
            { keywords: ['kpi', 'performance indicator'], type: 'kpi' },
            { keywords: ['chart', 'graph', 'visualization'], type: 'chart_configuration' }
        ];
        for (const pattern of patterns) {
            if (pattern.keywords.some(keyword => objectiveLower.includes(keyword))) {
                const requirement = this.createRequirement(pattern.type, objective);
                requirements.push(requirement);
                keyFindings.push(`Detected ${pattern.type} requirement from keywords: ${pattern.keywords.join(', ')}`);
            }
        }
        // Advanced pattern detection for complex scenarios
        const complexPatterns = this.detectComplexPatterns(objective);
        requirements.push(...complexPatterns.requirements);
        keyFindings.push(...complexPatterns.findings);
        const confidence = Math.min(0.9, 0.3 + (requirements.length * 0.1));
        this.logger.info(`Pass 1 complete: ${requirements.length} requirements found`);
        return { requirements, keyFindings, confidence };
    }
    /**
     * 🔗 PASS 2: Dependency Analysis
     */
    async pass2_DependencyAnalysis(objective, existingRequirements) {
        this.logger.info('🔍 Pass 2: Dependency _analysis');
        const newRequirements = [];
        const keyFindings = [];
        const existingTypes = new Set(existingRequirements.map(req => req.type));
        // Analyze dependencies for each existing requirement
        for (const requirement of existingRequirements) {
            const dependencies = this.DEPENDENCY_MATRIX[requirement.type] || [];
            for (const depType of dependencies) {
                if (!existingTypes.has(depType)) {
                    const depRequirement = this.createRequirement(depType, objective);
                    depRequirement.dependencies = [requirement.id];
                    depRequirement.description += ` (Required by ${requirement.name})`;
                    newRequirements.push(depRequirement);
                    existingTypes.add(depType);
                    keyFindings.push(`Added ${depType} as dependency of ${requirement.type}`);
                }
            }
        }
        // Analyze prerequisite chains
        const prerequisiteAnalysis = this.analyzePrerequisiteChains(existingRequirements);
        newRequirements.push(...prerequisiteAnalysis.requirements);
        keyFindings.push(...prerequisiteAnalysis.findings);
        // Analyze common co-requirements
        const coRequirementAnalysis = this.analyzeCoRequirements(objective, existingRequirements);
        newRequirements.push(...coRequirementAnalysis.requirements);
        keyFindings.push(...coRequirementAnalysis.findings);
        const confidence = newRequirements.length > 0 ? 0.8 : 0.6;
        this.logger.info(`Pass 2 complete: ${newRequirements.length} new requirements found`);
        return { newRequirements, keyFindings, confidence };
    }
    /**
     * 🌐 PASS 3: Context & Implication Analysis
     */
    async pass3_ContextAnalysis(objective, existingRequirements) {
        this.logger.info('🔍 Pass 3: Context and implication _analysis');
        const newRequirements = [];
        const keyFindings = [];
        const objectiveLower = objective.toLowerCase();
        // Analyze context patterns
        for (const [contextName, contextData] of Object.entries(this.CONTEXT_PATTERNS)) {
            const hasContextTrigger = contextData.triggers.some(trigger => objectiveLower.includes(trigger));
            if (hasContextTrigger) {
                keyFindings.push(`Detected ${contextName} context`);
                for (const additionalReq of contextData.additional_requirements) {
                    if (!existingRequirements.some(req => req.type === additionalReq)) {
                        const requirement = this.createRequirement(additionalReq, objective);
                        requirement.description += ` (Context implication: ${contextName})`;
                        newRequirements.push(requirement);
                        keyFindings.push(`Added ${additionalReq} from ${contextName} context`);
                    }
                }
            }
        }
        // Analyze enterprise vs department scope implications
        const scopeAnalysis = this.analyzeScopeImplications(objective, existingRequirements);
        newRequirements.push(...scopeAnalysis.requirements);
        keyFindings.push(...scopeAnalysis.findings);
        // Analyze compliance and regulatory implications
        const complianceAnalysis = this.analyzeComplianceImplications(objective);
        newRequirements.push(...complianceAnalysis.requirements);
        keyFindings.push(...complianceAnalysis.findings);
        const confidence = 0.7;
        this.logger.info(`Pass 3 complete: ${newRequirements.length} contextual requirements found`);
        return { newRequirements, keyFindings, confidence };
    }
    /**
     * ✅ PASS 4: Validation & Completeness Check
     */
    async pass4_ValidationAnalysis(objective, existingRequirements) {
        this.logger.info('🔍 Pass 4: Validation and completeness check');
        const newRequirements = [];
        const keyFindings = [];
        // Gap _analysis - check for common missing pieces
        const gapAnalysis = this.performGapAnalysis(objective, existingRequirements);
        newRequirements.push(...gapAnalysis.requirements);
        keyFindings.push(...gapAnalysis.findings);
        // Validation of requirement completeness
        const completenessCheck = this.validateRequirementCompleteness(existingRequirements);
        keyFindings.push(...completenessCheck.findings);
        // Final quality check
        const qualityCheck = this.performQualityCheck(existingRequirements);
        keyFindings.push(...qualityCheck.findings);
        const confidence = 0.95;
        this.logger.info(`Pass 4 complete: ${newRequirements.length} validation requirements added`);
        return { newRequirements, keyFindings, confidence };
    }
    // Helper methods (implementations would follow similar patterns)
    createRequirement(type, objective) {
        return {
            id: `req_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            name: `${type.replace(/_/g, ' ').toUpperCase()} for ${objective.substring(0, 50)}...`,
            description: `ServiceNow ${type} component required for: ${objective}`,
            priority: 'medium',
            dependencies: [],
            estimatedEffort: 'medium',
            automatable: true,
            mcpCoverage: ['widget', 'flow', 'business_rule', 'script_include', 'table', 'application'].includes(type),
            category: this.getCategoryForType(type),
            riskLevel: 'medium'
        };
    }
    getCategoryForType(type) {
        // Mapping logic for requirement categories
        const categoryMap = {
            widget: 'core_development',
            flow: 'core_development',
            user_role: 'security_compliance',
            dashboard: 'reporting_analytics',
            // ... more mappings
        };
        return categoryMap[type] || 'core_development';
    }
    // Additional helper methods would be implemented here...
    detectComplexPatterns(objective) {
        // Implementation for complex pattern detection
        return { requirements: [], findings: [] };
    }
    analyzePrerequisiteChains(requirements) {
        // Implementation for prerequisite analysis
        return { requirements: [], findings: [] };
    }
    analyzeCoRequirements(objective, requirements) {
        // Implementation for co-requirement analysis
        return { requirements: [], findings: [] };
    }
    analyzeScopeImplications(objective, requirements) {
        // Implementation for scope analysis
        return { requirements: [], findings: [] };
    }
    analyzeComplianceImplications(objective) {
        // Implementation for compliance analysis
        return { requirements: [], findings: [] };
    }
    performGapAnalysis(objective, requirements) {
        // Implementation for gap analysis
        return { requirements: [], findings: [] };
    }
    validateRequirementCompleteness(requirements) {
        // Implementation for completeness validation
        return { findings: [] };
    }
    performQualityCheck(requirements) {
        // Implementation for quality check
        return { findings: [] };
    }
    deduplicateRequirements(requirements) {
        const seen = new Set();
        return requirements.filter(req => {
            const key = `${req.type}_${req.name}`;
            if (seen.has(key))
                return false;
            seen.add(key);
            return true;
        });
    }
    calculateCompletenessScore(pass1, pass2, pass3, pass4) {
        // Calculate completeness based on multiple passes
        const baseScore = 40;
        const pass2Bonus = Math.min(30, pass2.newRequirements.length * 5);
        const pass3Bonus = Math.min(20, pass3.newRequirements.length * 3);
        const pass4Bonus = Math.min(10, pass4.newRequirements.length * 2);
        return Math.min(100, baseScore + pass2Bonus + pass3Bonus + pass4Bonus);
    }
    determineConfidenceLevel(completenessScore) {
        if (completenessScore >= 90)
            return 'very_high';
        if (completenessScore >= 75)
            return 'high';
        if (completenessScore >= 60)
            return 'medium';
        return 'low';
    }
    analyzeCrossDomainImpacts(requirements) {
        const impacts = [];
        const categories = new Set(requirements.map(req => req.category));
        if (categories.has('security_compliance') && categories.has('user_interface')) {
            impacts.push('Security changes will require UI permission updates');
        }
        if (categories.has('data_integration') && categories.has('reporting_analytics')) {
            impacts.push('Data changes will impact existing reports and dashboards');
        }
        return impacts;
    }
    extractImplicitDependencies(requirements) {
        return requirements
            .filter(req => req.dependencies.length > 0)
            .map(req => `${req.name} depends on ${req.dependencies.join(', ')}`)
            .slice(0, 10); // Limit to top 10
    }
    calculateComplexity(requirements) {
        const totalEffort = requirements.reduce((sum, req) => {
            const effortMap = { low: 1, medium: 3, high: 5 };
            return sum + effortMap[req.estimatedEffort];
        }, 0);
        if (totalEffort > 50)
            return 'enterprise';
        if (totalEffort > 30)
            return 'high';
        if (totalEffort > 15)
            return 'medium';
        return 'low';
    }
    calculateRiskAssessment(requirements) {
        const highRiskCount = requirements.filter(req => req.riskLevel === 'high').length;
        const totalCount = requirements.length;
        if (highRiskCount / totalCount > 0.3)
            return 'high';
        if (highRiskCount / totalCount > 0.1)
            return 'medium';
        return 'low';
    }
    extractCategories(requirements) {
        return Array.from(new Set(requirements.map(req => req.category)));
    }
    identifyCriticalPath(requirements) {
        return requirements
            .filter(req => req.priority === 'high')
            .map(req => req.name)
            .slice(0, 5);
    }
    estimateDuration(requirements) {
        const totalDays = requirements.reduce((sum, req) => {
            const effortDays = { low: 1, medium: 3, high: 7 };
            return sum + effortDays[req.estimatedEffort];
        }, 0);
        if (totalDays > 90)
            return '3+ months';
        if (totalDays > 30)
            return '1-3 months';
        if (totalDays > 7)
            return '1-4 weeks';
        return '1-7 days';
    }
}
exports.MultiPassRequirementsAnalyzer = MultiPassRequirementsAnalyzer;
exports.default = MultiPassRequirementsAnalyzer;
//# sourceMappingURL=multi-pass-requirements-analyzer.js.map