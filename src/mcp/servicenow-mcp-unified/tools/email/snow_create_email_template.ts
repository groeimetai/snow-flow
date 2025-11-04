/**
 * snow_create_email_template
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_email_template',
  description: 'Create email notification template',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'notifications',
  use_cases: ['email', 'templates', 'notifications'],
  complexity: 'beginner',
  frequency: 'medium',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Template name' },
      table: { type: 'string', description: 'Associated table' },
      subject: { type: 'string', description: 'Email subject template' },
      body: { type: 'string', description: 'Email body template' },
      type: { type: 'string', enum: ['text', 'html'], default: 'html' }
    },
    required: ['name', 'subject', 'body']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, subject, body, type = 'html' } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const templateData: any = {
      name,
      subject,
      body,
      type: type === 'html' ? 'text/html' : 'text/plain'
    };
    if (table) templateData.table = table;
    const response = await client.post('/api/now/table/sysevent_email_template', templateData);
    return createSuccessResult({ created: true, template: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
