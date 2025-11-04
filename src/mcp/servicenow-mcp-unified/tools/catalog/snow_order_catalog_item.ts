/**
 * snow_order_catalog_item - Order catalog item
 *
 * Orders a catalog item programmatically, creating a request (RITM) with specified variable values.
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_order_catalog_item',
  description: 'Orders a catalog item programmatically, creating a request (RITM) with specified variable values.',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'service-catalog',
  use_cases: ['ordering', 'automation', 'ritm'],
  complexity: 'intermediate',
  frequency: 'high',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Write operation based on name pattern
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      cat_item: { type: 'string', description: 'Catalog item sys_id' },
      requested_for: { type: 'string', description: 'User sys_id or username' },
      variables: { type: 'object', description: 'Variable name-value pairs' },
      quantity: { type: 'number', description: 'Quantity to order', default: 1 },
      delivery_address: { type: 'string', description: 'Delivery address' },
      special_instructions: { type: 'string', description: 'Special instructions' }
    },
    required: ['cat_item', 'requested_for']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const {
    cat_item,
    requested_for,
    variables,
    quantity = 1,
    delivery_address,
    special_instructions
  } = args;

  try {
    const client = await getAuthenticatedClient(context);

    // Create service catalog request
    const requestData: any = {
      requested_for,
      opened_by: requested_for
    };

    if (special_instructions) requestData.special_instructions = special_instructions;

    const requestResponse = await client.post('/api/now/table/sc_request', requestData);
    const requestId = requestResponse.data.result.sys_id;

    // Create requested item (RITM)
    const ritmData: any = {
      request: requestId,
      cat_item,
      requested_for,
      quantity
    };

    if (delivery_address) ritmData.delivery_address = delivery_address;

    const ritmResponse = await client.post('/api/now/table/sc_req_item', ritmData);
    const ritmId = ritmResponse.data.result.sys_id;
    const ritmNumber = ritmResponse.data.result.number;

    // Set variable values if provided
    if (variables) {
      for (const [varName, varValue] of Object.entries(variables)) {
        await client.post('/api/now/table/sc_item_option_mtom', {
          request_item: ritmId,
          name: varName,
          value: varValue
        });
      }
    }

    return createSuccessResult(
      {
        ordered: true,
        request_id: requestId,
        ritm_id: ritmId,
        ritm_number: ritmNumber,
        quantity
      },
      {
        operation: 'order_catalog_item',
        item: cat_item,
        requested_for
      }
    );

  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
