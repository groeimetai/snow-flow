/**
 * snow_create_business_rule
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_business_rule',
  description: 'Create server-side business rule (ES5 only!)',
  // Metadata for tool discovery (not sent to LLM)
  category: 'development',
  subcategory: 'platform',
  use_cases: ['business-rules', 'server-side', 'automation'],
  complexity: 'intermediate',
  frequency: 'high',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Business rule name' },
      table: { type: 'string', description: 'Table name' },
      when: { type: 'string', enum: ['before', 'after', 'async', 'display'], default: 'before' },
      insert: { type: 'boolean', default: false },
      update: { type: 'boolean', default: false },
      delete: { type: 'boolean', default: false },
      query: { type: 'boolean', default: false },
      condition: { type: 'string', description: 'When to run (ES5 only!)' },
      script: { type: 'string', description: 'Script to execute (ES5 only!)' },
      active: { type: 'boolean', default: true }
    },
    required: ['name', 'table', 'script']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, when = 'before', insert = false, update = false, delete: del = false, query = false, condition, script, active = true } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const brData: any = {
      name,
      collection: table,
      when,
      insert,
      update,
      delete: del,
      query,
      script,
      active
    };
    if (condition) brData.condition = condition;
    const response = await client.post('/api/now/table/sys_script', brData);
    return createSuccessResult({ created: true, business_rule: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
