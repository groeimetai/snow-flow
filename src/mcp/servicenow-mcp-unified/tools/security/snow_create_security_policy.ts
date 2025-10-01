/**
 * ServiceNow Security Tool: Create Security Policy
 * Creates security policies for access control and data protection
 * Source: servicenow-security-compliance-mcp.ts
 */

import { SnowToolConfig } from '../types';

export const snow_create_security_policy: SnowToolConfig = {
  name: 'snow_create_security_policy',
  description: 'Creates security policies for access control and data protection. Configures enforcement levels, scope, and rule sets.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Security policy name' },
      type: { type: 'string', description: 'Policy type (access, data, network, etc.)' },
      description: { type: 'string', description: 'Policy description' },
      enforcement: { type: 'string', description: 'Enforcement level (strict, moderate, advisory)' },
      scope: { type: 'string', description: 'Policy scope (global, application, table)' },
      rules: { type: 'array', description: 'Security rules and conditions' },
      active: { type: 'boolean', description: 'Policy active status' }
    },
    required: ['name', 'type', 'rules']
  },
  handler: async (args, client, logger) => {
    logger.info('Creating Security Policy...');

    // Get available policy types and enforcement levels
    const policyTypes = await getSecurityPolicyTypes(client, logger);
    const enforcementLevels = await getEnforcementLevels(client, logger);

    const policyData = {
      name: args.name,
      type: args.type,
      description: args.description || '',
      enforcement: args.enforcement || 'moderate',
      scope: args.scope || 'global',
      rules: JSON.stringify(args.rules || []),
      active: args.active !== false
    };

    await client.ensureUpdateSet();

    // Try multiple table names as fallback
    let response;
    const possibleTables = [
      'sys_security_policy',      // Primary table
      'sys_security_rule',        // Alternative 1
      'sys_policy',              // Alternative 2
      'u_security_policy'        // Custom table fallback
    ];

    for (const tableName of possibleTables) {
      try {
        logger.trackAPICall('CREATE', tableName, 1);
        response = await client.createRecord(tableName, policyData);
        if (response.success) {
          logger.info(`Security policy created in table: ${tableName}`);
          break;
        }
      } catch (tableError) {
        logger.warn(`Failed to create in table ${tableName}:`, tableError);
        continue;
      }
    }

    if (!response || !response.success) {
      throw new Error(`Failed to create Security Policy in any available table. Error: ${response?.error || 'No suitable table found'}`);
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Security Policy created successfully!\n\n🔒 **${args.name}**\n🆔 sys_id: ${response.data.sys_id}\n🛡️ Type: ${args.type}\n⚖️ Enforcement: ${args.enforcement || 'moderate'}\n🎯 Scope: ${args.scope || 'global'}\n📋 Rules: ${args.rules?.length || 0} rules defined\n🔄 Active: ${args.active !== false ? 'Yes' : 'No'}\n\n📝 Description: ${args.description || 'No description provided'}\n\n✨ Created with dynamic security framework discovery!`
      }]
    };
  }
};

// Helper functions
async function getSecurityPolicyTypes(client: any, logger: any): Promise<string[]> {
  try {
    const policyTypes = await client.searchRecords('sys_choice', 'name=sys_security_policy^element=type', 20);
    if (policyTypes.success) {
      return policyTypes.data.result.map((choice: any) => choice.value);
    }
  } catch (error) {
    logger.warn('Could not discover policy types, using defaults');
  }
  return ['access', 'data', 'network', 'audit', 'compliance'];
}

async function getEnforcementLevels(client: any, logger: any): Promise<string[]> {
  try {
    const levels = await client.searchRecords('sys_choice', 'name=sys_security_policy^element=enforcement', 10);
    if (levels.success) {
      return levels.data.result.map((choice: any) => choice.value);
    }
  } catch (error) {
    logger.warn('Could not discover enforcement levels, using defaults');
  }
  return ['strict', 'moderate', 'advisory'];
}
