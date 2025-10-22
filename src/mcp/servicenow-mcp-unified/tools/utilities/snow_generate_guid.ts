/**
 * snow_generate_guid
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';
import crypto from 'crypto';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_generate_guid',
  description: 'Generate GUID/UUID',
  // Metadata for tool discovery (not sent to LLM)
  category: 'advanced',
  subcategory: 'utilities',
  use_cases: ['guid-generation', 'identifiers', 'utilities'],
  complexity: 'beginner',
  frequency: 'medium',
  inputSchema: {
    type: 'object',
    properties: {
      format: { type: 'string', enum: ['uuid', 'guid', 'sys_id'], default: 'sys_id' }
    }
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { format = 'sys_id' } = args;
  try {
    const uuid = crypto.randomUUID();
    let formatted: string = uuid;

    if (format === 'sys_id') {
      formatted = uuid.replace(/-/g, '');
    } else if (format === 'guid') {
      formatted = uuid.toUpperCase();
    }

    return createSuccessResult({ guid: formatted, format });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
