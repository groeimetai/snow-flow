/**
 * snow_create_catalog_item - Create service catalog item
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_catalog_item',
  description: 'Create service catalog item',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      short_description: { type: 'string' },
      description: { type: 'string' },
      category: { type: 'string' },
      price: { type: 'string' }
    },
    required: ['name']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, short_description, description, category, price } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const itemData: any = { name, short_description, description };
    if (category) itemData.category = category;
    if (price) itemData.price = price;
    const response = await client.post('/api/now/table/sc_cat_item', itemData);
    return createSuccessResult({ created: true, catalog_item: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
