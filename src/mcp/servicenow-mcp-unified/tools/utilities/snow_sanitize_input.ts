/**
 * snow_sanitize_input
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_sanitize_input',
  description: 'Sanitize input for security',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'utilities',
  use_cases: ['input-sanitization', 'security', 'validation'],
  complexity: 'beginner',
  frequency: 'medium',

  // Permission enforcement
  // Classification: READ - Utility function - sanitizes data locally
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input to sanitize' },
      type: { type: 'string', enum: ['html', 'sql', 'script'], default: 'html' }
    },
    required: ['input']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { input, type = 'html' } = args;
  try {
    let sanitized = input;

    switch (type) {
      case 'html':
        sanitized = input
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');
        break;
      case 'sql':
        sanitized = input.replace(/['";]/g, '');
        break;
      case 'script':
        sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        break;
    }

    return createSuccessResult({
      sanitized,
      type,
      original_length: input.length,
      sanitized_length: sanitized.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
