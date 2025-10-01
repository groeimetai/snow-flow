/**
 * snow_csv_to_json
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_csv_to_json',
  description: 'Convert CSV to JSON array',
  inputSchema: {
    type: 'object',
    properties: {
      csv: { type: 'string', description: 'CSV string' },
      delimiter: { type: 'string', default: ',' }
    },
    required: ['csv']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { csv, delimiter = ',' } = args;
  try {
    const lines = csv.split('\n').filter(l => l.trim());
    const headers = lines[0].split(delimiter);
    const data = lines.slice(1).map(line => {
      const values = line.split(delimiter);
      const obj: any = {};
      headers.forEach((h, i) => {
        obj[h.trim()] = values[i]?.trim();
      });
      return obj;
    });

    return createSuccessResult({
      converted: true,
      json: data,
      row_count: data.length
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
