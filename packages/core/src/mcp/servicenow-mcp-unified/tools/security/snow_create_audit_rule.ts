import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceNowClient } from '../../utils/servicenow-client.js';
import type { MCPLogger } from '../../shared/mcp-logger.js';
import { MCPToolDefinition, ToolContext, ToolResult } from '../types';


export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_audit_rule',
  description: 'Createauditrule',
  category: 'security',
  subcategory: 'audit-rules',
  use_cases: ['configuration', 'security', 'compliance'],
  complexity: 'intermediate',
  frequency: 'medium',

  // Permission enforcement
  // Classification: WRITE - Creation/configuration operation
  permission: 'write',
  allowedRoles: ['developer', 'admin'],

  inputSchema: {
  "type": "object",
  "properties": {
    "name": {
      "type": "string"
    },
    "table": {
      "type": "string"
    },
    "events": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "fields": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "retention": {
      "type": "number"
    },
    "filter": {
      "type": "string"
    },
    "active": {
      "type": "boolean"
    }
  },
  "required": [
    "name",
    "table",
    "events"
  ]
}
};

export async function execute(args: CreateAuditRuleArgs, context: ToolContext): Promise<ToolResult> {
  const { client, logger } = context;
  return await createAuditRule(args, client, logger);
}


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
