import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceNowClient } from '../../utils/servicenow-client.js';
import type { MCPLogger } from '../../shared/mcp-logger.js';

export interface CreateAuditRuleArgs {
  name: string;
  table: string;
  events: string[];
  fields?: string[];
  retention?: number;
  filter?: string;
  active?: boolean;
}

export async function createAuditRule(
  args: CreateAuditRuleArgs,
  client: ServiceNowClient,
  logger: MCPLogger
) {
  try {
    logger.info('Creating Audit Rule...');
    
    const auditData = {
      tablename: args.table,
      fieldname: args.fields ? args.fields.join(',') : '*',
      reason: args.name,
      user: 'system',
      record_checkpoint: JSON.stringify({ filter: args.filter || '' })
    };

    await client.ensureUpdateSet();
    const response = await client.createRecord('sys_audit', auditData);

    if (!response.success) {
      throw new Error(`Failed to create Audit Rule: ${response.error}`);
    }

    return {
      content: [{
        type: 'text' as const,
        text: `✅ Audit Rule created: ${args.name}\nsys_id: ${response.data.sys_id}\nTable: ${args.table}\nEvents: ${args.events.join(', ')}\nRetention: ${args.retention || 365} days`
      }]
    };
  } catch (error) {
    logger.error('Failed to create Audit Rule:', error);
    throw new McpError(ErrorCode.InternalError, `Failed to create Audit Rule: ${error}`);
  }
}
