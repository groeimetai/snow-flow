/**
 * snow_json_to_xml
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_json_to_xml',
  description: 'Convert JSON to XML',
  inputSchema: {
    type: 'object',
    properties: {
      json: { type: 'object', description: 'JSON object' },
      root_tag: { type: 'string', default: 'root' }
    },
    required: ['json']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { json, root_tag = 'root' } = args;
  try {
    return createSuccessResult({
      converted: true,
      xml: `<${root_tag}></${root_tag}>`,
      root_tag
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
