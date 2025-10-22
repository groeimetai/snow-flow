/**
 * snow_create_report - Create report
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_report',
  description: 'Create ServiceNow report',
  // Metadata for tool discovery (not sent to LLM)
  category: 'reporting',
  subcategory: 'reports',
  use_cases: ['reporting', 'visualization', 'analytics'],
  complexity: 'beginner',
  frequency: 'high',
  inputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      table: { type: 'string' },
      type: { type: 'string', enum: ['bar', 'pie', 'line', 'list'] },
      filter: { type: 'string' }
    },
    required: ['title', 'table', 'type']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { title, table, type, filter } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const reportData: any = { title, table, type };
    if (filter) reportData.filter = filter;
    const response = await client.post('/api/now/table/sys_report', reportData);
    return createSuccessResult({ created: true, report: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
