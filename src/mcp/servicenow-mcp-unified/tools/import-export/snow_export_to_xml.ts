/**
 * snow_export_to_xml
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_export_to_xml',
  description: 'Export records to XML format',
  // Metadata for tool discovery (not sent to LLM)
  category: 'integration',
  subcategory: 'import-export',
  use_cases: ['export', 'xml', 'backup'],
  complexity: 'beginner',
  frequency: 'medium',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: READ - Export operation - reads data
  permission: 'read',
  allowedRoles: ['developer', 'stakeholder', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      table: { type: 'string', description: 'Table to export' },
      query: { type: 'string', description: 'Query filter' },
      view: { type: 'string', description: 'View to use' }
    },
    required: ['table']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { table, query, view } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const params: any = { sysparm_query: query || '' };
    if (view) params.sysparm_view = view;

    const response = await client.get(`/api/now/table/${table}`, {
      params,
      headers: { 'Accept': 'application/xml' }
    });

    return createSuccessResult({
      xml: response.data,
      table,
      format: 'xml'
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
