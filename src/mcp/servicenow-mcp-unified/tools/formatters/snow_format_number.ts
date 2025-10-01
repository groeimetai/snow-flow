/**
 * snow_format_number
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_format_number',
  description: 'Format number with locale',
  inputSchema: {
    type: 'object',
    properties: {
      number: { type: 'number', description: 'Number to format' },
      type: { type: 'string', enum: ['decimal', 'currency', 'percent'], default: 'decimal' },
      decimals: { type: 'number', default: 2 },
      currency: { type: 'string', default: 'USD' }
    },
    required: ['number']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { number, type = 'decimal', decimals = 2, currency = 'USD' } = args;
  try {
    let formatted = '';

    switch (type) {
      case 'decimal':
        formatted = number.toFixed(decimals);
        break;
      case 'currency':
        formatted = `${currency} ${number.toFixed(decimals)}`;
        break;
      case 'percent':
        formatted = `${(number * 100).toFixed(decimals)}%`;
        break;
    }

    return createSuccessResult({
      formatted,
      type,
      original: number
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
