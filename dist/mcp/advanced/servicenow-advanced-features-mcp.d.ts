#!/usr/bin/env node
/**
 * ServiceNow Advanced Features MCP Server
 *
 * Provides 14 AI-powered tools for deep ServiceNow insights, automated documentation,
 * and process mining capabilities that revolutionize ServiceNow management.
 */
import { BaseMCPServer } from '../base-mcp-server.js';
export declare class ServiceNowAdvancedFeaturesMCP extends BaseMCPServer {
    private memoryManager;
    private batchQueue;
    private cacheManager;
    constructor();
    protected setupTools(): void;
    /**
     * Feature 1: Smart Batch API Operations
     * Reduces API calls by 80% through intelligent batching and caching
     */
    private executeBatchApi;
    /**
     * Group operations by type and table for optimization
     */
    private groupOperations;
    /**
     * Calculate optimized API calls based on grouping
     */
    private calculateOptimizedCalls;
    /**
     * Execute operations in parallel
     */
    private executeParallelBatch;
    /**
     * Execute batch query operations
     */
    private executeBatchQuery;
    /**
     * Execute batch insert operations
     */
    private executeBatchInsert;
    /**
     * Execute batch update operations
     */
    private executeBatchUpdate;
    /**
     * Execute batch delete operations
     */
    private executeBatchDelete;
    /**
     * Execute operations in a transaction
     */
    private executeTransactionalBatch;
    /**
     * Execute operations sequentially
     */
    private executeSequentialBatch;
    private executeSingleQuery;
    private executeSingleInsert;
    private executeSingleUpdate;
    private executeSingleDelete;
    private checkCache;
    private getFromCache;
    private setCache;
    private cleanCache;
    private cacheResults;
    private combineFields;
    private groupUpdatesByFields;
    private prepareRollback;
    /**
     * Feature 2: Table Relationship Mapping
     * Maps all dependencies including extensions, references, and common query patterns
     */
    private getTableRelationships;
    /**
     * Get table information including metadata
     */
    private getTableInfo;
    /**
     * Analyze table hierarchy (parent/child relationships)
     */
    private analyzeTableHierarchy;
    /**
     * Get parent tables (tables this table extends from)
     */
    private getParentTables;
    /**
     * Get child tables (tables that extend this table)
     */
    private getChildTables;
    /**
     * Analyze reference fields in the table
     */
    private analyzeReferences;
    /**
     * Find tables that reference this table
     */
    private findReferencingTables;
    /**
     * Analyze common query patterns for the table
     */
    private analyzeQueryPatterns;
    /**
     * Generate human-readable description of query pattern
     */
    private describeQueryPattern;
    /**
     * Get performance tip for query pattern
     */
    private getQueryPerformanceTip;
    /**
     * Discover custom patterns based on table fields
     */
    private discoverCustomPatterns;
    /**
     * Generate relationship statistics
     */
    private generateRelationshipStats;
    /**
     * Generate Mermaid diagram for visualization
     */
    private generateMermaidDiagram;
    /**
     * Feature 3: Query Performance Analyzer
     * Predicts query performance before execution and provides optimization recommendations
     */
    private analyzeQueryPerformance;
    /**
     * Parse ServiceNow encoded query into conditions
     */
    private parseEncodedQuery;
    /**
     * Parse individual condition
     */
    private parseCondition;
    /**
     * Get table schema information
     */
    private getTableSchema;
    /**
     * Analyze individual condition performance
     */
    private analyzeCondition;
    /**
     * Check for missing indexes
     */
    private checkMissingIndexes;
    /**
     * Analyze join performance for dot-walked fields
     */
    private analyzeJoinPerformance;
    /**
     * Suggest alternative query formulations
     */
    private suggestAlternativeQueries;
    /**
     * Calculate risk assessment
     */
    private calculateRiskAssessment;
    /**
     * Estimate query execution time
     */
    private estimateExecutionTime;
    /**
     * Check if field is indexed
     */
    private isFieldIndexed;
    /**
     * Find composite index opportunities
     */
    private findCompositeIndexOpportunities;
    /**
     * Get table indexes
     */
    private getTableIndexes;
    /**
     * Get approximate record count
     */
    private getApproximateRecordCount;
    /**
     * Hash query for caching
     */
    private hashQuery;
    /**
     * Feature 4: Field Usage Intelligence
     * Discovers which fields are actually used across the platform to identify safe-to-deprecate fields
     */
    private analyzeFieldUsage;
    /**
     * Get all fields for a table
     */
    private getTableFields;
    /**
     * Analyze field usage in database queries (business rules, script includes, etc.)
     */
    private analyzeFieldInQueries;
    /**
     * Analyze field usage in views (list views, forms)
     */
    private analyzeFieldInViews;
    /**
     * Analyze field usage in reports
     */
    private analyzeFieldInReports;
    /**
     * Analyze field usage in business rules
     */
    private analyzeFieldInBusinessRules;
    /**
     * Analyze field usage in UI policies
     */
    private analyzeFieldInUIPolicies;
    /**
     * Analyze field usage in workflows and flows
     */
    private analyzeFieldInWorkflows;
    /**
     * Calculate overall usage score for a field
     */
    private calculateFieldUsageScore;
    /**
     * Categorize field based on usage score
     */
    private categorizeFieldUsage;
    /**
     * Perform deprecation analysis
     */
    private performDeprecationAnalysis;
    /**
     * Calculate technical debt score
     */
    private calculateTechnicalDebtScore;
    /**
     * Generate recommendations based on field usage analysis
     */
    private generateFieldUsageRecommendations;
    /**
     * ✨ FEATURE 5: MIGRATION HELPER - Create comprehensive migration plan
     *
     * Creates detailed migration plans for moving data between tables with:
     * - Automatic field mapping with confidence scores
     * - Data transformation detection and scripting
     * - Migration complexity estimation
     * - Risk assessment and warnings
     * - Generated migration scripts (SQL and JavaScript)
     * - Performance optimization suggestions
     */
    private createMigrationPlan;
    /**
     * Analyze schemas for both source and target tables
     */
    private analyzeTableSchemas;
    /**
     * Get detailed schema information for a table
     */
    private getDetailedTableSchema;
    /**
     * Create field mappings between source and target tables with confidence scoring
     */
    private createFieldMappings;
    /**
     * Calculate confidence score for field mapping
     */
    private calculateFieldMappingScore;
    /**
     * Calculate string similarity using Levenshtein distance
     */
    private calculateStringSimilarity;
    /**
     * Calculate data type compatibility score
     */
    private calculateTypeCompatibility;
    /**
     * Determine required transformation for field mapping
     */
    private determineRequiredTransformation;
    /**
     * Get conversion complexity level
     */
    private getConversionComplexity;
    /**
     * Classify mapping type based on confidence score
     */
    private classifyMappingType;
    /**
     * Assess data compatibility between fields
     */
    private assessDataCompatibility;
    /**
     * Identify potential issues with field mapping
     */
    private identifyPotentialIssues;
    /**
     * Generate mapping notes
     */
    private generateMappingNotes;
    /**
     * Identify required data transformations
     */
    private identifyDataTransformations;
    /**
     * Generate transformation description
     */
    private generateTransformationDescription;
    /**
     * Generate transformation script template
     */
    private generateTransformationScript;
    /**
     * Assess transformation risk level
     */
    private assessTransformationRisk;
    /**
     * Identify global transformations needed
     */
    private identifyGlobalTransformations;
    /**
     * Estimate migration complexity and performance
     */
    private estimateMigrationComplexity;
    /**
     * Get base time per record for complexity level
     */
    private getBaseTimePerRecord;
    /**
     * Format duration in human readable format
     */
    private formatDurationMinutes;
    /**
     * Estimate performance impact
     */
    private estimatePerformanceImpact;
    /**
     * Identify risk factors
     */
    private identifyRiskFactors;
    /**
     * Generate migration scripts
     */
    private generateMigrationScripts;
    /**
     * Generate SQL migration script
     */
    private generateSQLMigrationScript;
    /**
     * Generate JavaScript migration script
     */
    private generateJavaScriptMigrationScript;
    /**
     * Generate rollback script
     */
    private generateRollbackScript;
    /**
     * Generate validation script
     */
    private generateValidationScript;
    /**
     * Validate migration plan
     */
    private validateMigrationPlan;
    /**
     * Assess data loss risk
     */
    private assessDataLossRisk;
    /**
     * Recommend migration approach
     */
    private recommendMigrationApproach;
    /**
     * Generate key considerations
     */
    private generateKeyConsiderations;
    /**
     * ✨ FEATURE 6: DEEP TABLE ANALYSIS - Comprehensive table insights
     *
     * Provides comprehensive analysis of ServiceNow tables including:
     * - Detailed table structure and metadata analysis
     * - Data quality metrics and validation
     * - Performance analysis and bottleneck identification
     * - Security and compliance assessment
     * - Usage patterns and statistics
     * - Dependency mapping and impact analysis
     * - Actionable optimization recommendations
     */
    private analyzeTableDeep;
    /**
     * Analyze table structure and metadata
     */
    private analyzeTableStructure;
    /**
     * Analyze data quality metrics
     */
    private analyzeDataQuality;
    /**
     * Analyze table performance
     */
    private analyzeTablePerformance;
    /**
     * Analyze table security
     */
    private analyzeTableSecurity;
    /**
     * Analyze table compliance
     */
    private analyzeTableCompliance;
    /**
     * Analyze usage patterns
     */
    private analyzeUsagePatterns;
    /**
     * Analyze dependencies
     */
    private analyzeTableDependencies;
    private estimateGrowthTrend;
    private assessStructureHealth;
    private generateStructureRecommendations;
    private analyzeCompleteness;
    private analyzeConsistency;
    private analyzeValidity;
    private analyzeUniqueness;
    private identifyDataIssues;
    private calculateQualityScore;
    private estimateQueryPerformance;
    private calculateIndexCoverage;
    private identifyPerformanceBottlenecks;
    private assessOptimizationPotential;
    private getPerformanceRecommendations;
    private calculateSecurityScore;
    private identifyTableSecurityIssues;
    private assessComplianceStatus;
    private analyzeACLCoverage;
    private classifyDataSensitivity;
    private analyzeEncryption;
    private assessAuditRequirements;
    private isAuditRecommended;
    private assessPrivacyCompliance;
    private analyzeRetentionRequirements;
    private calculateTableComplianceScore;
    private identifyComplianceViolations;
    private generateComplianceRecommendations;
    private estimateAccessPatterns;
    private analyzeTemporalPatterns;
    private estimateUserInteractions;
    private analyzeIntegrationUsage;
    private assessCouplingLevel;
    private calculateImpactRadius;
    private analyzeStringFormats;
    private checkDataTypeValidity;
    private generateAnalysisSummary;
    private generateOptimizationRecommendations;
    private calculateRiskScores;
    private calculateOverallRisk;
    private generateTableExecutiveSummary;
    /**
     * ✨ FEATURE 7: CODE PATTERN DETECTOR - AI-powered code analysis
     *
     * Detects anti-patterns, code smells, and optimization opportunities in ServiceNow code:
     * - Anti-pattern detection (N+1 queries, hardcoded values, etc.)
     * - Performance issues (inefficient queries, long-running scripts)
     * - Security vulnerabilities (injection risks, access control bypass)
     * - Maintainability issues (complex functions, duplicate code)
     * - Best practices violations (naming conventions, error handling)
     * - Code complexity analysis (cyclomatic complexity, nesting levels)
     * - Technical debt identification and prioritization
     */
    private detectCodePatterns;
    /**
     * Collect scripts for analysis based on scope and filters
     */
    private collectScriptsForAnalysis;
    /**
     * Collect business rules for analysis
     */
    private collectBusinessRules;
    /**
     * Collect client scripts for analysis
     */
    private collectClientScripts;
    /**
     * Collect script includes for analysis
     */
    private collectScriptIncludes;
    /**
     * Collect UI scripts for analysis
     */
    private collectUIScripts;
    /**
     * Collect workflows for analysis (simplified - would need workflow activities)
     */
    private collectWorkflows;
    /**
     * Collect REST APIs for analysis
     */
    private collectRestAPIs;
    /**
     * Collect scheduled jobs for analysis
     */
    private collectScheduledJobs;
    /**
     * Collect transform maps for analysis (script fields)
     */
    private collectTransformMaps;
    /**
     * Analyze individual script for patterns
     */
    private analyzeScript;
    /**
     * Detect anti-patterns in code
     */
    private detectAntiPatterns;
    /**
     * Detect performance issues
     */
    private detectPerformanceIssues;
    /**
     * Detect security issues
     */
    private detectSecurityIssues;
    /**
     * Detect maintainability issues
     */
    private detectMaintainabilityIssues;
    /**
     * Detect best practice violations
     */
    private detectBestPracticeViolations;
    /**
     * Detect complexity issues
     */
    private detectComplexityIssues;
    /**
     * Detect code smells
     */
    private detectCodeSmells;
    /**
     * Detect technical debt
     */
    private detectTechnicalDebt;
    private detectNPlusOneQuery;
    private detectStringConcatInLoop;
    private findPatternLineRegex;
    private calculateMaxNestingLevel;
    private calculateCyclomaticComplexity;
    private calculateComplexityMetrics;
    private findDuplicateCodeBlocks;
    private chunkArray;
    private filterPatternsBySeverity;
    private analyzeScriptDependencies;
    private generatePatternSummary;
    private generateCodeRecommendations;
    private generateCodeAnalysisReport;
    private calculateOverallCodeHealth;
    private generateNextSteps;
    /**
     * Feature 8: Predictive Impact Analysis
     * Analyzes potential impacts of changes across ServiceNow platform to prevent unintended consequences
     */
    private predictChangeImpact;
    private analyzeChangeDetails;
    private calculateTableChangeComplexity;
    private calculateBusinessRuleComplexity;
    private calculateWorkflowComplexity;
    private calculateScriptComplexity;
    private calculateUIPolicyComplexity;
    private calculateACLComplexity;
    private calculateFieldChangeComplexity;
    private calculateIntegrationComplexity;
    private analyzeChangeDependencies;
    private analyzeTableChangeDependencies;
    private analyzeScriptChangeDependencies;
    private analyzeWorkflowDependencies;
    private analyzeUIPolicyDependencies;
    private analyzeACLDependencies;
    private analyzeGenericDependencies;
    private assessRisk;
    private getActionRiskScore;
    private getTypeRiskScore;
    private predictImpacts;
    private predictDirectImpacts;
    private predictDependencyImpacts;
    private predictSystemImpacts;
    private getSeverityWeight;
    private generateMitigationStrategies;
    private getPriorityWeight;
    private generateImpactRecommendations;
    /**
     * Feature 9: Auto Documentation Generator
     * Automatically generates comprehensive documentation from code, flows, and system behavior
     */
    private generateDocumentation;
    private discoverDocumentationObjects;
    private discoverTables;
    private discoverBusinessRules;
    private discoverWorkflows;
    private discoverFlows;
    private discoverWidgets;
    private discoverScriptIncludes;
    private discoverIntegrations;
    private discoverAPIs;
    private discoverProcesses;
    private discoverArchitecture;
    private analyzeObjectsForDocumentation;
    private analyzeObjectForDocumentation;
    private analyzeTableForDocumentation;
    private analyzeBusinessRuleForDocumentation;
    private analyzeWorkflowForDocumentation;
    private analyzeFlowForDocumentation;
    private analyzeWidgetForDocumentation;
    private analyzeScriptIncludeForDocumentation;
    private analyzeIntegrationForDocumentation;
    private analyzeAPIForDocumentation;
    private generateTableStructureDoc;
    private generateFieldDefinitionsDoc;
    private generateTableRelationshipsDoc;
    private generateBusinessRuleLogicDoc;
    private generateTriggerConditionsDoc;
    private generateWorkflowStepsDoc;
    private generateApprovalProcessDoc;
    private generateFlowDefinitionDoc;
    private generateFlowExecutionDoc;
    private generateWidgetConfigDoc;
    private generateWidgetUsageDoc;
    private generateScriptIncludeAPIDoc;
    private generateCodeExamplesDoc;
    private generateIntegrationConfigDoc;
    private generateDataMappingDoc;
    private generateAPIEndpointsDoc;
    private generateAPIExamplesDoc;
    private analyzeDependenciesForDocumentation;
    private analyzeUsagePatternsForDocumentation;
    private generateDocumentationContent;
    private generateDocumentationTitle;
    private generateTableOfContents;
    private generateDocumentationExecutiveSummary;
    private generateArchitectureOverview;
    private generateObjectDocumentation;
    private generateBestPracticesSection;
    private generateDiagrams;
    private generateArchitectureDiagram;
    private generateERDiagram;
    private generateProcessFlowDiagram;
    private generateAPIDocumentation;
    private generateAPIParameters;
    private generateAPIResponses;
    private generateAPIExamples;
    private formatDocumentation;
    private formatAsMarkdown;
    private formatAsHTML;
    private formatAsConfluence;
    private formatAsJSON;
    private setupAutoUpdate;
    private countWords;
    private calculateCompletenessScore;
    private calculateAccuracyScore;
    private calculateReadabilityScore;
    private calculateCoveragePercentage;
    /**
     * Feature 10: Intelligent Refactoring
     * Automatically refactors ServiceNow code to improve quality, performance, and maintainability
     */
    private refactorCode;
    private discoverCodeForRefactoring;
    private discoverBusinessRulesForRefactoring;
    private discoverClientScriptsForRefactoring;
    private discoverScriptIncludesForRefactoring;
    private discoverUIScriptsForRefactoring;
    private discoverWorkflowsForRefactoring;
    private discoverFlowsForRefactoring;
    private discoverRestApisForRefactoring;
    private discoverScheduledJobsForRefactoring;
    private analyzeCodeForRefactoring;
    private analyzeCodeObject;
    private analyzeBusinessRuleCode;
    private analyzeClientScriptCode;
    private analyzeScriptIncludeCode;
    private analyzeGenericCode;
    private calculateCognitiveComplexity;
    private identifyPerformanceIssues;
    private identifyCodeSecurityIssues;
    private identifyMaintainabilityIssues;
    private identifyReadabilityIssues;
    private identifyClientScriptIssues;
    private identifyDOMManipulationIssues;
    private identifyAPIDesignIssues;
    private identifyErrorHandlingIssues;
    private identifyRefactoringOpportunities;
    private findPatternLineString;
    private generateRefactoringPlan;
    private calculateExpectedPerformanceImprovement;
    private calculateExpectedMaintainabilityImprovement;
    private calculateExpectedQualityImprovement;
    private prioritizeRefactoringActions;
    private generateRefactoredCode;
    private applyRefactoringAction;
    private generateRefactoredCodeSample;
    private updateChangeSummary;
    private validateRefactoredCode;
    private validateCodeObject;
    private generateTestsForRefactoredCode;
    private generateTestFile;
    private createCodeBackup;
    private applyRefactoringChanges;
    private calculateQualityImprovement;
    private calculatePerformanceImprovement;
    private calculateComplexityReduction;
    private calculateMaintainabilityGain;
    private generateRefactoringRecommendations;
    /**
     * Feature 11: Process Mining Engine
     * Discovers actual process flows by analyzing ServiceNow event logs and transactions
     */
    private discoverProcess;
    /**
     * Phase 1: Setup process discovery configuration
     */
    private setupProcessDiscovery;
    /**
     * Phase 2: Collect event logs from ServiceNow tables
     */
    private collectEventLogs;
    /**
     * Collect events from a specific table
     */
    private collectTableEvents;
    /**
     * Collect audit logs for user interactions
     */
    private collectAuditLogs;
    /**
     * Collect workflow execution logs
     */
    private collectWorkflowLogs;
    /**
     * Phase 3: Analyze process patterns from event logs
     */
    private analyzeProcessPatterns;
    /**
     * Phase 4: Generate process models and visualizations
     */
    private generateProcessModels;
    /**
     * Phase 5: Analyze process performance and identify bottlenecks
     */
    private analyzeProcessPerformance;
    /**
     * Phase 6: Analyze process compliance and deviations
     */
    private analyzeProcessCompliance;
    /**
     * Phase 7: Generate process optimization recommendations
     */
    private generateProcessOptimizations;
    /**
     * Phase 8: Export process mining results
     */
    private exportProcessMiningResults;
    private parsePeriodToDays;
    private calculateDataQualityScore;
    private calculateProcessComplexity;
    private formatDuration;
    private generateProcessMap;
    private generateBPMNModel;
    private calculateActivityFrequencies;
    private calculateTransitionProbabilities;
    private calculateResourceUtilization;
    private generatePerformanceRecommendations;
    private identifyBasicDeviations;
    private calculateBasicComplianceScore;
    private parseReferenceModel;
    private performConformanceChecking;
    private calculateConformanceScore;
    private identifyConformanceDeviations;
    private calculateProcessComplianceScore;
    private generateCSVExport;
    private generateHTMLReport;
    private generateProcessMapExport;
    /**
     * Feature 12: Workflow Reality Analyzer
     * Compares actual workflow executions against designed workflows
     */
    private analyzeWorkflowExecution;
    /**
     * Phase 1: Setup workflow analysis configuration
     */
    private setupWorkflowAnalysis;
    /**
     * Phase 2: Collect workflow design information
     */
    private collectWorkflowDesigns;
    /**
     * Get detailed workflow design information
     */
    private getWorkflowDetails;
    /**
     * Phase 3: Collect workflow execution data
     */
    private collectWorkflowExecutions;
    /**
     * Get detailed execution information
     */
    private getExecutionDetails;
    /**
     * Phase 4: Compare design vs reality
     */
    private compareDesignVsReality;
    /**
     * Phase 5: Analyze workflow performance
     */
    private analyzeWorkflowPerformance;
    /**
     * Phase 6: Analyze workflow errors and deviations
     */
    private analyzeWorkflowErrors;
    /**
     * Phase 7: Analyze workflow usage patterns
     */
    private analyzeWorkflowUsagePatterns;
    /**
     * Phase 8: Generate workflow optimization recommendations
     */
    private generateWorkflowOptimizations;
    /**
     * Phase 9: Export workflow analysis results
     */
    private exportWorkflowAnalysis;
    private parseDurationFromString;
    private calculateExecutionDataQuality;
    private calculateDataCompleteness;
    private calculateMedian;
    private calculateStandardDeviation;
    private identifyDesignGaps;
    private aggregateMissingActivities;
    private aggregateUnexpectedActivities;
    private categorizeError;
    private identifyAutomationCandidates;
    private generateWorkflowCSVExport;
    private generateWorkflowHTMLReport;
    private generateWorkflowDiagram;
    private generatePerformanceChart;
    /**
     * Feature 13: Cross Table Process Discovery
     * Analyzes and discovers complex processes that span multiple ServiceNow tables
     */
    private discoverCrossTableProcess;
    private discoverTableRelationships;
    private analyzeCrossTableDataFlow;
    private trackCrossTableProcessInstances;
    private mapCrossTableUserJourneys;
    private recognizeCrossTableProcessPatterns;
    private analyzeCrossTablePerformance;
    private detectCrossTableAutomationOpportunities;
    private getAllSystemTables;
    private getModuleTables;
    private getHighTrafficTables;
    private calculateRelationshipStrength;
    private analyzeDataFlowBetweenTables;
    private calculateDataFlowComplexity;
    private identifyProcessChains;
    private buildProcessChain;
    private getProcessInstancesForChain;
    private calculateJourneyDuration;
    private calculateJourneyComplexity;
    private calculateJourneyEfficiency;
    private extractJourneyPattern;
    private categorizeComplexity;
    private calculateOptimizationPotential;
    private analyzePatternPerformance;
    private calculateAutomationScore;
    private determineAutomationType;
    private calculateAutomationSavings;
    private assessImplementationComplexity;
    private generateAutomationDescription;
    private calculateAutomationROI;
    private generateCrossTableRecommendations;
    private generateMigrationSuggestions;
    private findSimilarPatterns;
    private calculatePatternSimilarity;
    private generateCrossTableJsonExport;
    private generateCrossTableCsvExport;
    private generateCrossTableHtmlReport;
    private generateCrossTableProcessDiagram;
    private generateCrossTableDependencyMap;
    private generateCrossTableOptimizationPlan;
    private groupTablesByModule;
    private countInternalConnections;
    private countExternalConnections;
    private generateOptimizationDescription;
    private calculateOptimizationImpact;
    /**
     * Feature 14: Real Time Process Monitoring
     * Monitors active ServiceNow processes in real-time with live alerting and performance tracking
     */
    private monitorProcess;
    private discoverMonitoringTargets;
    private establishPerformanceBaselines;
    private setupMonitoringLoop;
    private executeLiveMonitoring;
    private processAlertsAndAnomalies;
    private getAllActiveProcesses;
    private getProcessById;
    private getProcessesByCategory;
    private getCriticalProcesses;
    private enrichProcessInformation;
    private calculateProcessPriorities;
    private categorizeProcess;
    private getHistoricalExecutionTimes;
    private getHistoricalThroughput;
    private getHistoricalErrorRate;
    private setupAlertTriggers;
    private setupDataCollectors;
    private collectLiveProcessData;
    private detectRealTimeAnomalies;
    private evaluatePerformanceAlerts;
    private generateAlertRecommendation;
    private analyzeAlertTrends;
    private calculateAlertImpact;
    private generateSuggestedActions;
    private generateRealTimeRecommendations;
    private generateRealTimeDashboard;
    private generateJsonStream;
    private generateCsvLog;
    private generateMonitoringHtmlReport;
    private generateMetricsExport;
    private generateAlertSummary;
    /**
     * Run the MCP server
     */
    run(): Promise<void>;
}
export default ServiceNowAdvancedFeaturesMCP;
//# sourceMappingURL=servicenow-advanced-features-mcp.d.ts.map