/**
 * snow_create_transform_map
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_transform_map',
  description: 'Create transform map for import sets',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'import-export',
  use_cases: ['transform-maps', 'data-transformation', 'import'],
  complexity: 'intermediate',
  frequency: 'medium',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Transform map name' },
      source_table: { type: 'string', description: 'Source import table' },
      target_table: { type: 'string', description: 'Target table' },
      run_business_rules: { type: 'boolean', default: true }
    },
    required: ['name', 'source_table', 'target_table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, source_table, target_table, run_business_rules = true } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const transformData = {
      name,
      source: source_table,
      target: target_table,
      run_business_rules
    };
    const response = await client.post('/api/now/table/sys_transform_map', transformData);
    return createSuccessResult({ created: true, transform_map: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
