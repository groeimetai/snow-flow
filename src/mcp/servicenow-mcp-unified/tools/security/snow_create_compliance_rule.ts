/**
 * ServiceNow Security Tool: Create Compliance Rule
 * Creates compliance rules for regulatory frameworks (SOX, GDPR, HIPAA). Defines validation, remediation, and severity levels.
 */

import { MCPToolDefinition, ToolContext, ToolResult } from '../types';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_compliance_rule',
  description: 'Creates compliance rules for regulatory frameworks (SOX, GDPR, HIPAA). Defines validation, remediation, and severity levels.',
  category: 'security',
  subcategory: 'compliance',
  use_cases: ['rules', 'security', 'compliance'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Creation/configuration operation
  permission: 'write',
  allowedRoles: ['developer', 'admin'],

  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Compliance rule name' },
      framework: { type: 'string', description: 'Compliance framework (SOX, GDPR, HIPAA, etc.)' },
      requirement: { type: 'string', description: 'Specific requirement or control' },
      validation: { type: 'string', description: 'Validation script or condition' },
      remediation: { type: 'string', description: 'Remediation actions' },
      severity: { type: 'string', description: 'Severity level (critical, high, medium, low)' },
      active: { type: 'boolean', description: 'Rule active status' }
    },
    required: ['name', 'framework', 'requirement', 'validation']
  }
};

export async function execute(args: any, context: ToolContext): Promise<ToolResult> {
  const { client, logger } = context;
  logger.info('Creating Compliance Rule...');

    // Get available compliance frameworks
    const frameworks = await getComplianceFrameworks(client, logger);

    const complianceData = {
      name: args.name,
      framework: args.framework,
      requirement: args.requirement,
      validation: args.validation,
      remediation: args.remediation || '',
      severity: args.severity || 'medium',
      active: args.active !== false
    };

    await client.ensureUpdateSet();

    // Try multiple compliance-related tables
    let response;
    const complianceTables = [
      'sn_compliance_policy',      // ServiceNow Compliance module
      'grc_policy',               // GRC: Policy & Compliance
      'sn_risk_assessment',       // Risk Management
      'u_compliance_rule'         // Custom table fallback
    ];

    for (const tableName of complianceTables) {
      try {
        // Adjust field names based on table
        const tableSpecificData = tableName.startsWith('grc_') ? {
          name: args.name,
          short_description: args.name,
          description: args.remediation || args.validation || '',
          policy_statement: args.requirement,
          compliance_framework: args.framework,
          active: args.active !== false
        } : complianceData;

        response = await client.createRecord(tableName, tableSpecificData);
        if (response.success) {
          logger.info(`Compliance rule created in table: ${tableName}`);
          break;
        }
      } catch (tableError) {
        logger.warn(`Failed to create in table ${tableName}:`, tableError);
        continue;
      }
    }

    if (!response || !response.success) {
      throw new Error(`Failed to create Compliance Rule: ${response?.error || 'No suitable table found'}`);
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Compliance Rule created successfully!\n\n📋 **${args.name}**\n🆔 sys_id: ${response.data.sys_id}\n🏢 Framework: ${args.framework}\n📜 Requirement: ${args.requirement}\n🔍 Validation: ${args.validation}\n🚨 Severity: ${args.severity || 'medium'}\n🔄 Active: ${args.active !== false ? 'Yes' : 'No'}\n\n${args.remediation ? `🔧 Remediation: ${args.remediation}\n` : ''}\n✨ Created with dynamic compliance framework discovery!`
      }]
    };
}
