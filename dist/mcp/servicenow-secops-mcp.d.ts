#!/usr/bin/env node
/**
 * ServiceNow Security Operations (SecOps) MCP Server
 *
 * Provides comprehensive Security Operations capabilities including:
 * - Security incident management and response
 * - Threat intelligence correlation and analysis
 * - Vulnerability assessment and management
 * - Security playbook automation
 * - SOAR (Security Orchestration, Automation & Response)
 *
 * Critical enterprise security module previously missing from Snow-Flow
 */
import { EnhancedBaseMCPServer } from './shared/enhanced-base-mcp-server.js';
export declare class ServiceNowSecOpsMCP extends EnhancedBaseMCPServer {
    constructor();
    private setupHandlers;
    private createSecurityIncident;
    private analyzeThreatIntelligence;
    private executeSecurityPlaybook;
    private assessVulnerabilityRisk;
    private generateSecurityDashboard;
    private automateThreatResponse;
    private mapPriorityToNumber;
    private calculateImpact;
    private detectIOCType;
}
//# sourceMappingURL=servicenow-secops-mcp.d.ts.map