/**
 * 🔐 Advanced Compliance System for Autonomous Compliance Monitoring
 *
 * Enterprise-grade autonomous compliance system that continuously monitors,
 * detects violations, implements corrective actions, and maintains
 * comprehensive audit trails without manual intervention.
 */
import { ServiceNowClient } from '../utils/servicenow-client.js';
import { MemorySystem } from '../memory/memory-system.js';
export interface ComplianceProfile {
    id: string;
    organizationName: string;
    assessmentDate: string;
    frameworks: ComplianceFramework[];
    overallScore: number;
    violations: ComplianceViolation[];
    correctives: CorrectiveAction[];
    auditTrail: AuditEntry[];
    riskMatrix: RiskMatrix;
    certifications: ComplianceCertification[];
    recommendations: ComplianceRecommendation[];
    metadata: ComplianceMetadata;
}
export interface ComplianceFramework {
    id: string;
    name: 'SOX' | 'GDPR' | 'HIPAA' | 'PCI-DSS' | 'ISO-27001' | 'NIST' | 'CUSTOM';
    version: string;
    enabled: boolean;
    controls: ComplianceControl[];
    score: number;
    status: 'compliant' | 'non-compliant' | 'partial' | 'unknown';
    lastAssessment: string;
    nextAssessment: string;
}
export interface ComplianceControl {
    id: string;
    controlId: string;
    title: string;
    description: string;
    category: string;
    criticality: 'critical' | 'high' | 'medium' | 'low';
    status: 'passed' | 'failed' | 'partial' | 'not-applicable';
    evidence: Evidence[];
    testResults: TestResult[];
    automationLevel: 'full' | 'partial' | 'manual';
    lastTested: string;
    nextTest: string;
}
export interface Evidence {
    id: string;
    type: 'document' | 'log' | 'screenshot' | 'report' | 'configuration';
    title: string;
    description: string;
    location: string;
    timestamp: string;
    hash: string;
    verified: boolean;
    expiryDate?: string;
}
export interface TestResult {
    id: string;
    testName: string;
    executionTime: string;
    status: 'passed' | 'failed' | 'skipped';
    details: string;
    findings: Finding[];
    automated: boolean;
}
export interface Finding {
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    impact: string;
    recommendation: string;
    evidence?: string;
}
export interface ComplianceViolation {
    id: string;
    frameworkId: string;
    controlId: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    detectedAt: string;
    status: 'open' | 'remediated' | 'accepted' | 'false-positive';
    remediationDeadline: string;
    assignedTo?: string;
    correctiveActions: string[];
    businessImpact: BusinessImpact;
}
export interface BusinessImpact {
    financial: number;
    operational: 'minimal' | 'moderate' | 'significant' | 'severe';
    reputational: 'minimal' | 'moderate' | 'significant' | 'severe';
    legal: 'minimal' | 'moderate' | 'significant' | 'severe';
    dataPrivacy: boolean;
    affectedSystems: string[];
    affectedUsers: number;
}
export interface CorrectiveAction {
    id: string;
    violationId: string;
    type: 'automated' | 'semi-automated' | 'manual';
    title: string;
    description: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    automationScript?: string;
    executionSteps: ExecutionStep[];
    startTime?: string;
    endTime?: string;
    result?: ActionResult;
    rollbackPlan?: string;
}
export interface ExecutionStep {
    order: number;
    action: string;
    automated: boolean;
    status: 'pending' | 'completed' | 'failed' | 'skipped';
    result?: string;
    error?: string;
}
export interface ActionResult {
    success: boolean;
    message: string;
    evidenceGenerated: string[];
    systemsUpdated: string[];
    verificationRequired: boolean;
}
export interface AuditEntry {
    id: string;
    timestamp: string;
    action: string;
    actor: string;
    target: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    result: 'success' | 'failure';
    framework?: string;
    controlId?: string;
}
export interface RiskMatrix {
    overallRisk: 'low' | 'medium' | 'high' | 'critical';
    categories: RiskCategory[];
    heatMap: HeatMapCell[];
    trends: RiskTrend[];
    mitigations: RiskMitigation[];
}
export interface RiskCategory {
    name: string;
    score: number;
    level: 'low' | 'medium' | 'high' | 'critical';
    violations: number;
    controls: number;
    trend: 'improving' | 'stable' | 'deteriorating';
}
export interface HeatMapCell {
    likelihood: number;
    impact: number;
    riskScore: number;
    controls: string[];
    violations: string[];
}
export interface RiskTrend {
    date: string;
    overallScore: number;
    byCategory: Record<string, number>;
    significantEvents: string[];
}
export interface RiskMitigation {
    risk: string;
    strategy: string;
    implementation: string;
    priority: 'immediate' | 'high' | 'medium' | 'low';
    owner: string;
    deadline: string;
    status: 'planned' | 'in-progress' | 'completed';
}
export interface ComplianceCertification {
    framework: string;
    certificateId: string;
    issuedDate: string;
    expiryDate: string;
    scope: string[];
    auditor: string;
    status: 'active' | 'expired' | 'pending-renewal';
    documentUrl: string;
}
export interface ComplianceRecommendation {
    id: string;
    category: 'process' | 'technical' | 'administrative' | 'physical';
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    benefit: string;
    effort: 'minimal' | 'moderate' | 'significant' | 'major';
    automatable: boolean;
    relatedControls: string[];
    estimatedCompletion: number;
}
export interface ComplianceMetadata {
    lastFullAssessment: string;
    nextScheduledAssessment: string;
    continuousMonitoring: boolean;
    automationCoverage: number;
    dataRetentionDays: number;
    encryptionEnabled: boolean;
    integrations: string[];
}
export interface ComplianceRequest {
    frameworks?: string[];
    scope?: 'full' | 'incremental' | 'specific-controls';
    includeEvidence?: boolean;
    autoRemediate?: boolean;
    generateReport?: boolean;
}
export interface ComplianceResult {
    success: boolean;
    profile: ComplianceProfile;
    violationsFound: number;
    violationsRemediated: number;
    reportGenerated?: string;
    nextSteps: string[];
    warnings: string[];
}
export declare class AdvancedComplianceSystem {
    private logger;
    private client;
    private memory;
    private complianceProfiles;
    private activeMonitoring;
    private frameworks;
    private auditTrail;
    constructor(client: ServiceNowClient, memory: MemorySystem);
    /**
     * Perform comprehensive compliance assessment
     */
    assessCompliance(request?: ComplianceRequest): Promise<ComplianceResult>;
    /**
     * Start continuous compliance monitoring
     */
    startContinuousMonitoring(options?: {
        frameworks?: string[];
        checkInterval?: number;
        autoRemediate?: boolean;
        alertThreshold?: string;
    }): Promise<void>;
    /**
     * Get real-time compliance dashboard
     */
    getComplianceDashboard(): Promise<{
        overallStatus: string;
        complianceScore: number;
        activeFrameworks: ComplianceFramework[];
        recentViolations: ComplianceViolation[];
        pendingActions: CorrectiveAction[];
        riskLevel: string;
        certifications: ComplianceCertification[];
        upcomingAudits: string[];
    }>;
    /**
     * Manually trigger corrective action
     */
    executeCorrectiveAction(actionId: string, options?: {
        verifyFirst?: boolean;
        generateEvidence?: boolean;
    }): Promise<{
        success: boolean;
        result: ActionResult;
        evidenceGenerated: string[];
    }>;
    /**
     * Generate compliance report
     */
    generateComplianceReport(profileId: string, format?: 'pdf' | 'html' | 'json'): Promise<string>;
    /**
     * Private helper methods
     */
    private initializeFrameworks;
    private getSOXControls;
    private getGDPRControls;
    private getHIPAAControls;
    private getActiveFrameworks;
    private runComplianceChecks;
    private testControl;
    private calculateFrameworkScore;
    private determineFrameworkStatus;
    private detectViolations;
    private calculateRemediationDeadline;
    private generateCorrectiveActions;
    private generateExecutionSteps;
    private autoRemediate;
    private executeActionSteps;
    private generateRiskMatrix;
    private generateHeatMap;
    private generateRiskTrends;
    private generateMitigations;
    private createAuditTrail;
    private generateRecommendations;
    private calculateOverallScore;
    private getCertifications;
    private generateNextSteps;
    private generateWarnings;
    private getLatestComplianceProfile;
    private generateDashboard;
    private handleCriticalViolations;
    private updateMonitoringStatus;
    private getCorrectiveAction;
    private verifyActionSafety;
    private generateActionEvidence;
    private auditAction;
    private renderComplianceReport;
    private saveReport;
    private startContinuousCompliance;
}
export default AdvancedComplianceSystem;
//# sourceMappingURL=advanced-compliance-system.d.ts.map