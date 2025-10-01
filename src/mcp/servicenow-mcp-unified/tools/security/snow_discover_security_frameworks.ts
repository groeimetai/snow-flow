/**
 * ServiceNow Security Tool: Discover Security Frameworks
 * Discovers available security and compliance frameworks
 * Source: servicenow-security-compliance-mcp.ts
 */

import { SnowToolConfig } from '../types';

export const snow_discover_security_frameworks: SnowToolConfig = {
  name: 'snow_discover_security_frameworks',
  description: 'Discovers security and compliance frameworks available in the instance for policy creation and auditing.',
  inputSchema: {
    type: 'object',
    properties: {
      type: { type: 'string', description: 'Framework type (security, compliance, audit)' }
    }
  },
  handler: async (args, client, logger) => {
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
};
