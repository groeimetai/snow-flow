/**
 * snow_create_customer_case - Create customer service case
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_customer_case',
  description: 'Create CSM customer case',
  // Metadata for tool discovery (not sent to LLM)
  category: 'itsm',
  subcategory: 'csm',
  use_cases: ['customer-service', 'case-management', 'csm'],
  complexity: 'beginner',
  frequency: 'high',

  // Permission enforcement
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      account: { type: 'string' },
      contact: { type: 'string' },
      priority: { type: 'number' }
    },
    required: ['subject', 'account']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { subject, account, contact, priority } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const caseData: any = { subject, account };
    if (contact) caseData.contact = contact;
    if (priority) caseData.priority = priority;
    const response = await client.post('/api/now/table/sn_customerservice_case', caseData);
    return createSuccessResult({ created: true, case: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
