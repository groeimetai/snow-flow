/**
 * ServiceNow Security Tool: Discover Security Frameworks
 * Discovers security and compliance frameworks available in the instance for policy creation and auditing.
 */

import { MCPToolDefinition, ToolContext, ToolResult } from '../types';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_discover_security_frameworks',
  description: 'Discovers security and compliance frameworks available in the instance for policy creation and auditing.',
  category: 'security',
  subcategory: 'frameworks',
  use_cases: ['discovery', 'security', 'compliance'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: READ - Discovery/analysis operation
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],

  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Framework type (security, compliance, audit)' }
    }
  }
};

export async function execute(args: any, context: ToolContext): Promise<ToolResult> {
  const { client, logger } = context;
  logger.info('Discovering security frameworks...');

    const type = args?.type || 'all';
    const frameworks: Array<{category: string, items: any[]}> = [];

    // Discover Security Frameworks
    if (type === 'all' || type === 'security') {
      logger.trackAPICall('SEARCH', 'sys_security_framework', 50);
      const securityFrameworks = await client.searchRecords('sys_security_framework', '', 50);
      if (securityFrameworks.success) {
        frameworks.push({
          category: 'Security Frameworks',
          items: securityFrameworks.data.result.map((fw: any) => ({
            name: fw.name,
            type: fw.type,
            description: fw.description,
            version: fw.version
          }))
        });
      }
    }

    // Discover Compliance Frameworks
    if (type === 'all' || type === 'compliance') {
      logger.trackAPICall('SEARCH', 'sys_compliance_framework', 50);
      const complianceFrameworks = await client.searchRecords('sys_compliance_framework', '', 50);
      if (complianceFrameworks.success) {
        frameworks.push({
          category: 'Compliance Frameworks',
          items: complianceFrameworks.data.result.map((fw: any) => ({
            name: fw.name,
            standard: fw.standard,
            description: fw.description,
            controls: fw.control_count
          }))
        });
      }
    }

    return {
      content: [{
        type: 'text',
        text: `🔍 Discovered Security Frameworks:\n\n${frameworks.map(category =>
          `**${category.category}:**\n${category.items.map(item =>
            `- ${item.name}${item.standard ? ` (${item.standard})` : ''}${item.type ? ` - ${item.type}` : ''}\n  ${item.description || 'No description'}`
          ).join('\n')}`
        ).join('\n\n')}\n\n✨ Total frameworks: ${frameworks.reduce((sum, cat) => sum + cat.items.length, 0)}\n🔍 All frameworks discovered dynamically!`
      }]
    };
}
