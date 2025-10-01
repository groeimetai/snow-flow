/**
 * snow_order_catalog_item - Order catalog item
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_order_catalog_item',
  description: 'Order service catalog item',
  inputSchema: {
    type: 'object',
    properties: {
      catalog_item_sys_id: { type: 'string' },
      requested_for: { type: 'string' },
      variables: { type: 'object' }
    },
    required: ['catalog_item_sys_id']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { catalog_item_sys_id, requested_for, variables = {} } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const orderData: any = { sysparm_item_guid: catalog_item_sys_id, variables };
    if (requested_for) orderData.sysparm_requested_for = requested_for;
    const response = await client.post('/api/sn_sc/servicecatalog/items/' + catalog_item_sys_id + '/order_now', orderData);
    return createSuccessResult({ ordered: true, request: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
