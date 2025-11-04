/**
 * snow_parse_json
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_parse_json',
  description: 'Parse and validate JSON',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'data-utilities',
  use_cases: ['parsing', 'validation', 'json'],
  complexity: 'beginner',
  frequency: 'medium',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: READ - Utility function - parses JSON locally
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      json_string: { type: 'string', description: 'JSON string to parse' }
    },
    required: ['json_string']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { json_string } = args;
  try {
    const parsed = JSON.parse(json_string);
    return createSuccessResult({
      parsed: true,
      data: parsed,
      keys: Object.keys(parsed).length
    });
  } catch (error: any) {
    return createErrorResult(`Invalid JSON: ${error.message}`);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
