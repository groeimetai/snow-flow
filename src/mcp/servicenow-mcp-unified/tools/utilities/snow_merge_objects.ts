/**
 * snow_merge_objects
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_merge_objects',
  description: 'Deep merge multiple objects',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'utilities',
  use_cases: ['object-merging', 'data-utilities', 'utilities'],
  complexity: 'beginner',
  frequency: 'low',

  // ✅ Permission enforcement (v2.0.0)
  // Classification: READ - Utility function - merges objects locally
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      objects: { type: 'array', items: { type: 'object' }, description: 'Objects to merge' }
    },
    required: ['objects']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { objects } = args;
  try {
    const merged = objects.reduce((acc: any, obj: any) => {
      return { ...acc, ...obj };
    }, {});

    return createSuccessResult({
      merged,
      object_count: objects.length,
      key_count: Object.keys(merged).length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
