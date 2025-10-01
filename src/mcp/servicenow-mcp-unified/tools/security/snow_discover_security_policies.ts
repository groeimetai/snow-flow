/**
 * ServiceNow Security Tool: Discover Security Policies
 * Lists existing security policies with filtering
 * Source: servicenow-security-compliance-mcp.ts
 */

import { SnowToolConfig } from '../types';

export const snow_discover_security_policies: SnowToolConfig = {
  name: 'snow_discover_security_policies',
  description: 'Lists existing security policies and rules with filtering by category and active status.',
  inputSchema: {
    type: 'object',
    properties: {
      category: { type: 'string', description: 'Policy category filter' },
      active: { type: 'boolean', description: 'Filter by active status' }
    }
  },
  handler: async (args, client, logger) => {
    logger.info('Discovering security policies...');

    let query = '';
    if (args?.category) {
      query = `category=${args.category}`;
    }
    if (args?.active !== undefined) {
      query += query ? `^active=${args.active}` : `active=${args.active}`;
    }

    logger.trackAPICall('SEARCH', 'sys_security_policy', 50);
    const policies = await client.searchRecords('sys_security_policy', query, 50);
    if (!policies.success) {
      throw new Error('Failed to discover security policies');
    }

    const policyTypes = ['Access Control', 'Data Protection', 'Network Security', 'Audit', 'Compliance'];
    const categorizedPolicies = policyTypes.map(type => ({
      type,
      policies: policies.data.result.filter((policy: any) =>
        policy.type?.toLowerCase().includes(type.toLowerCase()) ||
        policy.category?.toLowerCase().includes(type.toLowerCase())
      )
    })).filter(cat => cat.policies.length > 0);

    return {
      content: [{
        type: 'text',
        text: `🔒 Discovered Security Policies:\n\n${categorizedPolicies.map(category =>
          `**${category.type} Policies:**\n${category.policies.map((policy: any) =>
            `- ${policy.name} ${policy.active ? '✅' : '❌'}\n  ${policy.description || 'No description'}\n  Enforcement: ${policy.enforcement || 'Not specified'}`
          ).join('\n')}`
        ).join('\n\n')}\n\n✨ Total policies: ${policies.data.result.length}\n🔍 All policies discovered dynamically!`
      }]
    };
  }
};
