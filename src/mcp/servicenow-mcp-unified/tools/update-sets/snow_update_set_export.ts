/**
 * snow_update_set_export - Export Update Set to XML
 *
 * Exports Update Set to XML format for backup, version control, or
 * manual migration between instances. Preserves all change records and metadata.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_update_set_export',
  description: 'Export Update Set to XML for migration or backup',
  inputSchema: {
    type: 'object',
    properties: {
      update_set_id: {
        type: 'string',
        description: 'Update Set sys_id to export'
      },
      include_preview: {
        type: 'boolean',
        description: 'Include change preview information',
        default: true
      }
    },
    required: ['update_set_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { update_set_id, include_preview = true } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Get Update Set details
    const updateSetResponse = await client.get(`/api/now/table/sys_update_set/${update_set_id}`, {
      params: {
        sysparm_fields: 'sys_id,name,description,state,sys_created_on,sys_created_by'
      }
    });

    if (!updateSetResponse.data.result) {
      return createErrorResult(`Update Set not found: ${update_set_id}`);
    }

    const updateSet = updateSetResponse.data.result;

    // Get all changes
    const changesResponse = await client.get('/api/now/table/sys_update_xml', {
      params: {
        sysparm_query: `update_set=${update_set_id}`,
        sysparm_fields: 'sys_id,type,name,target_name,action,payload,sys_updated_on',
        sysparm_limit: 10000
      }
    });

    const changes = changesResponse.data.result || [];

    // Build XML export
    const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>';
    const xmlContent = `
<unload unload_date="${new Date().toISOString()}">
  <sys_remote_update_set action="INSERT_OR_UPDATE">
    <sys_id>${updateSet.sys_id}</sys_id>
    <name>${escapeXml(updateSet.name)}</name>
    <description>${escapeXml(updateSet.description || '')}</description>
    <state>${updateSet.state}</state>
    <sys_created_on>${updateSet.sys_created_on}</sys_created_on>
    <sys_created_by>${updateSet.sys_created_by}</sys_created_by>
  </sys_remote_update_set>
  ${changes.map((change: any) => `
  <sys_update_xml action="INSERT_OR_UPDATE">
    <sys_id>${change.sys_id}</sys_id>
    <type>${escapeXml(change.type || '')}</type>
    <name>${escapeXml(change.name || '')}</name>
    <target_name>${escapeXml(change.target_name || '')}</target_name>
    <action>${change.action}</action>
    <update_set>${update_set_id}</update_set>
    <payload>${escapeXml(change.payload || '')}</payload>
    <sys_updated_on>${change.sys_updated_on}</sys_updated_on>
  </sys_update_xml>`).join('')}
</unload>`.trim();

    const xml = xmlHeader + '\n' + xmlContent;

    // Build preview if requested
    let preview = null;
    if (include_preview) {
      const changesByType: Record<string, number> = {};
      changes.forEach((change: any) => {
        const type = change.type || 'Unknown';
        changesByType[type] = (changesByType[type] || 0) + 1;
      });

      preview = {
        total_changes: changes.length,
        changes_by_type: changesByType
      };
    }

    return createSuccessResult({
      update_set: {
        sys_id: updateSet.sys_id,
        name: updateSet.name,
        state: updateSet.state
      },
      export: {
        xml,
        size_bytes: Buffer.byteLength(xml, 'utf8'),
        change_count: changes.length
      },
      ...(preview && { preview }),
      exported_at: new Date().toISOString()
    });

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

// Helper function to escape XML special characters
function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
