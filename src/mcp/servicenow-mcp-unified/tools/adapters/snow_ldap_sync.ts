/**
 * snow_ldap_sync
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_ldap_sync',
  description: 'Trigger LDAP user synchronization',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'adapters',
  use_cases: ['ldap-sync', 'user-sync', 'authentication'],
  complexity: 'intermediate',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      ldap_server_sys_id: { type: 'string', description: 'LDAP server sys_id' }
    },
    required: ['ldap_server_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { ldap_server_sys_id } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const syncScript = `
var ldapSync = new LDAPUserSync();
ldapSync.syncUsers('${ldap_server_sys_id}');
gs.info('LDAP sync initiated');
    `;
    await client.post('/api/now/table/sys_script_execution', { script: syncScript });
    return createSuccessResult({
      synced: true,
      ldap_server: ldap_server_sys_id
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
