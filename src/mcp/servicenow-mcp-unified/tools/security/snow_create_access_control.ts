import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import type { ServiceNowClient } from '../../utils/servicenow-client.js';
import type { MCPLogger } from '../../shared/mcp-logger.js';

export interface CreateAccessControlArgs {
  name: string;
  table: string;
  operation: string;
  roles?: string[];
  condition?: string;
  advanced?: boolean;
  active?: boolean;
}

export async function createAccessControl(
  args: CreateAccessControlArgs,
  client: ServiceNowClient,
  logger: MCPLogger
) {
  try {
    logger.info('Creating Access Control...');

    const tableInfo = await getTableInfo(args.table, client);
    if (!tableInfo) {
      throw new Error(`Table not found: ${args.table}`);
    }

    const aclData = {
      name: args.name,
      table: tableInfo.name,
      operation: args.operation,
      roles: JSON.stringify(args.roles || []),
      condition: args.condition || '',
      advanced: args.advanced || false,
      active: args.active !== false
    };

    await client.ensureUpdateSet();
    const response = await client.createRecord('sys_security_acl', aclData);

    if (!response.success) {
      throw new Error(`Failed to create Access Control: ${response.error}`);
    }

    return {
      content: [{
        type: 'text' as const,
        text: `✅ Access Control created!\n\n${args.name}\nsys_id: ${response.data.sys_id}\nTable: ${tableInfo.label}\nOperation: ${args.operation}\nRoles: ${args.roles?.join(', ') || 'None'}\nActive: ${args.active !== false ? 'Yes' : 'No'}`
      }]
    };
  } catch (error) {
    logger.error('Failed to create Access Control:', error);
    throw new McpError(ErrorCode.InternalError, `Failed to create Access Control: ${error}`);
  }
}

async function getTableInfo(tableName: string, client: ServiceNowClient): Promise<{name: string, label: string} | null> {
  try {
    const tableResponse = await client.searchRecords('sys_db_object', `name=${tableName}`, 1);
    if (tableResponse.success && tableResponse.data?.result?.length > 0) {
      const table = tableResponse.data.result[0];
      return { name: table.name, label: table.label };
    }
    return null;
  } catch (error) {
    return null;
  }
}
