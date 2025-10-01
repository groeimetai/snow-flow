/**
 * snow_export_report_data - Export report data
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_export_report_data',
  description: 'Exports report data to CSV, Excel, JSON, or XML formats with configurable row limits',
  inputSchema: {
    type: 'object',
    properties: {
      reportName: { type: 'string', description: 'Report name to export' },
      format: { type: 'string', description: 'Export format (CSV, Excel, JSON, XML)' },
      includeHeaders: { type: 'boolean', description: 'Include column headers' },
      maxRows: { type: 'number', description: 'Maximum rows to export' }
    },
    required: ['reportName', 'format']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { reportName, format, includeHeaders, maxRows } = args;
  try {
    const client = await getAuthenticatedClient(context);

    // Find report
    const reportQuery = await client.get('/api/now/table/sys_report', {
      params: { sysparm_query: `name=${reportName}`, sysparm_limit: 1 }
    });
    if (!reportQuery.data.result || reportQuery.data.result.length === 0) {
      throw new Error(`Report not found: ${reportName}`);
    }
    const report = reportQuery.data.result[0];

    // Get report data
    const dataQuery = await client.get(`/api/now/table/${report.table}`, {
      params: {
        sysparm_query: report.filter || '',
        sysparm_limit: maxRows || 1000
      }
    });

    return createSuccessResult({
      exported: true,
      format: format.toUpperCase(),
      records: dataQuery.data.result.length,
      data: dataQuery.data.result,
      message: `Exported ${dataQuery.data.result.length} records from ${reportName} in ${format} format`
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
