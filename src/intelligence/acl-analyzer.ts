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

export class ACLAnalyzer {
  private logger: Logger;
  private client: ServiceNowClient;

  constructor(client: ServiceNowClient, logger: Logger) {
    this.client = client;
    this.logger = logger;
  }

  /**
   * Analyze ACLs for a specific table and operation
   */
  async analyzeTableAccess(
    tableName: string, 
    operation: 'read' | 'write' | 'create' | 'delete' = 'write'
  ): Promise<ACLAnalysisResult> {
    this.logger.info(`Analyzing ACLs for ${tableName}.${operation}`);

    try {
      // 1. Get current user info
      const userInfo = await this.getCurrentUserInfo();
      
      // 2. Get all ACLs for the table
      const acls = await this.getTableACLs(tableName, operation);
      
      // 3. Evaluate which ACLs allow/deny access
      const evaluation = await this.evaluateACLs(acls, userInfo);
      
      // 4. Generate suggestions for fixing access
      const suggestions = await this.generateSuggestions(
        tableName, 
        operation, 
        evaluation,
        userInfo
      );

      return {
        tableName,
        operation,
        hasAccess: evaluation.allowed.length > 0 && evaluation.denied.length === 0,
        deniedBy: evaluation.denied,
        allowedBy: evaluation.allowed,
        suggestions,
        autoFixable: suggestions.some(s => s.autoApplicable),
        manualSteps: this.generateManualSteps(tableName, operation, suggestions)
      };

    } catch (error) {
      this.logger.error('ACL _analysis failed:', error);
      throw error;
    }
  }

  /**
   * Get current user information including roles
   */
  private async getCurrentUserInfo(): Promise<any> {
    try {
      // Get current user
      const userResponse = await this.client.makeRequest('/api/now/ui/user/current');
      if (!userResponse.success) {
        throw new Error('Failed to get current user info');
      }

      const userId = userResponse.data.result.sys_id;

      // Get user roles
      const rolesResponse = await this.client.searchRecords(
        'sys_user_has_role',
        `user=${userId}^role.active=true`,
        100
      );

      const roles = rolesResponse.success && rolesResponse.data ? 
        rolesResponse.data.map((r: any) => r.role.name) : [];

      return {
        ...userResponse.data.result,
        roles
      };

    } catch (error) {
      this.logger.error('Failed to get user info:', error);
      return { roles: [] };
    }
  }

  /**
   * Get all ACLs for a specific table and operation
   */
  private async getTableACLs(tableName: string, operation: string): Promise<ACLRule[]> {
    try {
      // Search for ACLs on this table
      const query = `name=${tableName}^operation=${operation}^ORoperation=*^active=true`;
      
      const response = await this.client.searchRecords('sys_security_acl', query, 100);
      
      if (!response.success || !response.data) {
        this.logger.warn(`No ACLs found for ${tableName}.${operation}`);
        return [];
      }

      return response.data.map((acl: any) => ({
        sys_id: acl.sys_id,
        name: acl.name,
        operation: acl.operation,
        type: acl.type,
        admin_overrides: acl.admin_overrides === 'true',
        active: acl.active === 'true',
        roles: this.parseRoles(acl.roles),
        condition: acl.condition || '',
        script: acl.script || ''
      }));

    } catch (error) {
      this.logger.error('Failed to fetch ACLs:', error);
      return [];
    }
  }

  /**
   * Parse roles from ACL role field
   */
  private parseRoles(roleField: string): string[] {
    if (!roleField) return [];
    return roleField.split(',').map(r => r.trim()).filter(r => r);
  }

  /**
   * Evaluate which ACLs allow or deny access
   */
  private async evaluateACLs(
    acls: ACLRule[], 
    userInfo: any
  ): Promise<{ allowed: ACLRule[], denied: ACLRule[] }> {
    const allowed: ACLRule[] = [];
    const denied: ACLRule[] = [];

    for (const acl of acls) {
      // Check if user has admin role and admin_overrides is true
      if (acl.admin_overrides && userInfo.roles.includes('admin')) {
        allowed.push(acl);
        continue;
      }

      // Check if user has any of the required roles
      const hasRequiredRole = acl.roles.length === 0 || 
        acl.roles.some(role => userInfo.roles.includes(role));

      if (hasRequiredRole) {
        // If there's a condition or script, we can't evaluate it here
        // Assume it passes for now
        if (acl.condition || acl.script) {
          this.logger.warn(`ACL ${acl.sys_id} has condition/script - assuming pass`);
        }
        allowed.push(acl);
      } else {
        denied.push(acl);
      }
    }

    return { allowed, denied };
  }

  /**
   * Generate suggestions for fixing access issues
   */
  private async generateSuggestions(
    tableName: string,
    operation: string,
    evaluation: { allowed: ACLRule[], denied: ACLRule[] },
    userInfo: any
  ): Promise<ACLSuggestion[]> {
    const suggestions: ACLSuggestion[] = [];

    // If denied by ACLs, suggest role additions
    if (evaluation.denied.length > 0) {
      const missingRoles = new Set<string>();
      
      evaluation.denied.forEach(acl => {
        acl.roles.forEach(role => {
          if (!userInfo.roles.includes(role)) {
            missingRoles.add(role);
          }
        });
      });

      // Suggest adding specific roles
      for (const role of missingRoles) {
        if (this.isSafeRole(role)) {
          suggestions.push({
            type: 'add_role',
            description: `Add role '${role}' to your user account`,
            risk: this.getRoleRisk(role),
            autoApplicable: false // Roles usually can't be auto-added
          });
        }
      }
    }

    // For sp_widget specifically, check system properties
    if (tableName === 'sp_widget') {
      suggestions.push({
        type: 'system_property',
        description: 'Enable Service Portal API access via system property',
        risk: 'low',
        autoApplicable: true,
        implementation: async () => {
          return await this.enableServicePortalAPIAccess();
        }
      });

      suggestions.push({
        type: 'oauth_scope',
        description: 'Update OAuth application to allow cross-scope access',
        risk: 'medium',
        autoApplicable: false
      });
    }

    // If no ACLs exist, suggest creating one
    if (evaluation.allowed.length === 0 && evaluation.denied.length === 0) {
      suggestions.push({
        type: 'create_acl',
        description: `Create ACL for ${tableName}.${operation} with appropriate roles`,
        risk: 'high',
        autoApplicable: false
      });
    }

    return suggestions;
  }

  /**
   * Check if a role is safe to suggest
   */
  private isSafeRole(role: string): boolean {
    const unsafeRoles = ['security_admin', 'maint'];
    return !unsafeRoles.includes(role);
  }

  /**
   * Get risk level for a role
   */
  private getRoleRisk(role: string): 'low' | 'medium' | 'high' {
    const highRiskRoles = ['admin', 'security_admin'];
    const mediumRiskRoles = ['sp_admin', 'app_creator'];
    
    if (highRiskRoles.includes(role)) return 'high';
    if (mediumRiskRoles.includes(role)) return 'medium';
    return 'low';
  }

  /**
   * Try to enable Service Portal API access
   */
  private async enableServicePortalAPIAccess(): Promise<boolean> {
    try {
      const propertyUpdate = await this.client.updateRecord(
        'sys_properties',
        'glide.service_portal.enable_api_access',
        { value: 'true' }
      );

      return propertyUpdate.success;
    } catch (error) {
      this.logger.error('Failed to enable SP API access:', error);
      return false;
    }
  }

  /**
   * Generate manual steps for fixing access
   */
  private generateManualSteps(
    tableName: string,
    operation: string,
    suggestions: ACLSuggestion[]
  ): string[] {
    const steps: string[] = [];

    steps.push(`1. Navigate to System Security > Access Control (ACL)`);
    steps.push(`2. Search for ACLs where Name = '${tableName}' and Operation = '${operation}'`);
    steps.push(`3. Review the roles required by each ACL`);

    if (suggestions.some(s => s.type === 'add_role')) {
      steps.push(`4. To add roles to your user:`);
      steps.push(`   - Navigate to User Administration > Users`);
      steps.push(`   - Find your user record`);
      steps.push(`   - Use the Roles related list to add required roles`);
    }

    if (tableName === 'sp_widget') {
      steps.push(`5. For Service Portal widgets:`);
      steps.push(`   - Check System Properties > Service Portal`);
      steps.push(`   - Ensure 'glide.service_portal.enable_api_access' is true`);
      steps.push(`   - Check OAuth application has 'All application scopes' access`);
    }

    return steps;
  }

  /**
   * Attempt automatic fixes for permission issues
   */
  async attemptAutoFix(_analysis: ACLAnalysisResult): Promise<{
    fixed: boolean;
    appliedFixes: string[];
    failedFixes: string[];
  }> {
    const appliedFixes: string[] = [];
    const failedFixes: string[] = [];

    for (const suggestion of _analysis.suggestions) {
      if (suggestion.autoApplicable && suggestion.implementation) {
        try {
          this.logger.info(`Attempting auto-fix: ${suggestion.description}`);
          const success = await suggestion.implementation();
          
          if (success) {
            appliedFixes.push(suggestion.description);
          } else {
            failedFixes.push(suggestion.description);
          }
        } catch (error) {
          this.logger.error(`Auto-fix failed: ${suggestion.description}`, error);
          failedFixes.push(suggestion.description);
        }
      }
    }

    return {
      fixed: appliedFixes.length > 0 && failedFixes.length === 0,
      appliedFixes,
      failedFixes
    };
  }
}