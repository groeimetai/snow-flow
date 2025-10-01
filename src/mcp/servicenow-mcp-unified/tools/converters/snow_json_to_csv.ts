/**
 * snow_json_to_csv
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_json_to_csv',
  description: 'Convert JSON array to CSV',
  inputSchema: {
    type: 'object',
    properties: {
      json: { type: 'array', items: { type: 'object' }, description: 'JSON array' },
      delimiter: { type: 'string', default: ',' }
    },
    required: ['json']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { json, delimiter = ',' } = args;
  try {
    if (json.length === 0) {
      return createSuccessResult({ converted: true, csv: '', row_count: 0 });
    }

    const headers = Object.keys(json[0]);
    const csvLines = [headers.join(delimiter)];

    json.forEach((row: any) => {
      const values = headers.map(h => row[h] || '');
      csvLines.push(values.join(delimiter));
    });

    return createSuccessResult({
      converted: true,
      csv: csvLines.join('\n'),
      row_count: json.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
