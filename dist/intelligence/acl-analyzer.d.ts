/**
 * ACL Analyzer for ServiceNow
 * Automatically analyzes and suggests fixes for permission issues
 */
import { Logger } from '../utils/logger';
import { ServiceNowClient } from '../utils/servicenow-client';
export interface ACLAnalysisResult {
    tableName: string;
    operation: string;
    hasAccess: boolean;
    deniedBy: ACLRule[];
    allowedBy: ACLRule[];
    suggestions: ACLSuggestion[];
    autoFixable: boolean;
    manualSteps?: string[];
}
export interface ACLRule {
    sys_id: string;
    name: string;
    operation: string;
    type: string;
    admin_overrides: boolean;
    active: boolean;
    roles: string[];
    condition: string;
    script: string;
}
export interface ACLSuggestion {
    type: 'add_role' | 'modify_acl' | 'create_acl' | 'system_property' | 'oauth_scope';
    description: string;
    risk: 'low' | 'medium' | 'high';
    autoApplicable: boolean;
    implementation?: () => Promise<boolean>;
}
export declare class ACLAnalyzer {
    private logger;
    private client;
    constructor(client: ServiceNowClient, logger: Logger);
    /**
     * Analyze ACLs for a specific table and operation
     */
    analyzeTableAccess(tableName: string, operation?: 'read' | 'write' | 'create' | 'delete'): Promise<ACLAnalysisResult>;
    /**
     * Get current user information including roles
     */
    private getCurrentUserInfo;
    /**
     * Get all ACLs for a specific table and operation
     */
    private getTableACLs;
    /**
     * Parse roles from ACL role field
     */
    private parseRoles;
    /**
     * Evaluate which ACLs allow or deny access
     */
    private evaluateACLs;
    /**
     * Generate suggestions for fixing access issues
     */
    private generateSuggestions;
    /**
     * Check if a role is safe to suggest
     */
    private isSafeRole;
    /**
     * Get risk level for a role
     */
    private getRoleRisk;
    /**
     * Try to enable Service Portal API access
     */
    private enableServicePortalAPIAccess;
    /**
     * Generate manual steps for fixing access
     */
    private generateManualSteps;
    /**
     * Attempt automatic fixes for permission issues
     */
    attemptAutoFix(_analysis: ACLAnalysisResult): Promise<{
        fixed: boolean;
        appliedFixes: string[];
        failedFixes: string[];
    }>;
}
//# sourceMappingURL=acl-analyzer.d.ts.map