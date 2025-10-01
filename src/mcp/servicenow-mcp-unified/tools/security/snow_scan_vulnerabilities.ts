/**
 * snow_scan_vulnerabilities - Security vulnerability scan
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_scan_vulnerabilities',
  description: 'Scan for security vulnerabilities',
  inputSchema: {
    type: 'object',
    properties: {
      target: { type: 'string' },
      scan_type: { type: 'string', enum: ['full', 'quick'] }
    },
    required: ['target']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { target, scan_type = 'quick' } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const scanData = { target, scan_type };
    const response = await client.post('/api/now/table/sn_vul_scan', scanData);
    return createSuccessResult({ scan_started: true, scan: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
