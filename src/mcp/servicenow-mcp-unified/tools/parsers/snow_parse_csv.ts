/**
 * snow_parse_csv
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_parse_csv',
  description: 'Parse CSV to JSON',
  inputSchema: {
    type: 'object',
    properties: {
      csv_string: { type: 'string', description: 'CSV string to parse' },
      delimiter: { type: 'string', default: ',', description: 'Field delimiter' },
      has_header: { type: 'boolean', default: true }
    },
    required: ['csv_string']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { csv_string, delimiter = ',', has_header = true } = args;
  try {
    const lines = csv_string.split('\n').filter(line => line.trim());
    const headers = has_header ? lines[0].split(delimiter) : [];
    const dataLines = has_header ? lines.slice(1) : lines;

    const parsed = dataLines.map(line => {
      const values = line.split(delimiter);
      if (has_header) {
        const obj: any = {};
        headers.forEach((header, i) => {
          obj[header.trim()] = values[i]?.trim();
        });
        return obj;
      }
      return values.map(v => v.trim());
    });

    return createSuccessResult({
      parsed: true,
      rows: parsed.length,
      columns: headers.length || parsed[0]?.length || 0,
      data: parsed
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
