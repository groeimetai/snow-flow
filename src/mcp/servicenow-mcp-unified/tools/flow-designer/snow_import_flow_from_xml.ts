/**
 * snow_import_flow_from_xml - Import flows from XML
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_import_flow_from_xml',
  description: 'Import Flow Designer flows from XML update set',
  inputSchema: {
    type: 'object',
    properties: {
      xml_content: {
        type: 'string',
        description: 'XML content containing flow definition'
      },
      update_set_name: {
        type: 'string',
        description: 'Name for the update set (if creating new)'
      }
    },
    required: ['xml_content']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { xml_content, update_set_name = 'Flow Import' } = args;
  try {
    const client = await getAuthenticatedClient(context);

    // Create or get update set
    let updateSetSysId: string;

    if (update_set_name) {
      const updateSetResponse = await client.post('/api/now/table/sys_update_set', {
        name: update_set_name,
        description: 'Flow imported from XML',
        state: 'in progress'
      });
      updateSetSysId = updateSetResponse.data.result.sys_id;
    }

    // Import XML (this typically requires the Import Set API or Update Set Preview API)
    const importResponse = await client.post('/api/now/import/sys_remote_update_set', {
      attachment: xml_content,
      type: 'xml'
    });

    return createSuccessResult({
      imported: true,
      update_set: updateSetSysId || 'current',
      import_result: importResponse.data.result
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
