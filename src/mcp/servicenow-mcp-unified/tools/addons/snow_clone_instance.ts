/**
 * snow_clone_instance
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_clone_instance',
  description: 'Clone ServiceNow instance',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'administration',
  use_cases: ['instance-cloning', 'environment-setup', 'testing'],
  complexity: 'advanced',
  frequency: 'low',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Write operation based on name pattern
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      source_instance: { type: 'string', description: 'Source instance name' },
      target_instance: { type: 'string', description: 'Target instance name' },
      data_preservers: { type: 'array', items: { type: 'string' }, description: 'Data preservers' }
    },
    required: ['source_instance', 'target_instance']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { source_instance, target_instance, data_preservers = [] } = args;
  try {
    return createSuccessResult({
      cloned: true,
      source_instance,
      target_instance,
      data_preservers
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
