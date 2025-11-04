/**
 * snow_create_notification
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_create_notification',
  description: 'Create automated notification',
  // Metadata for tool discovery (not sent to LLM)
  category: 'automation',
  subcategory: 'notifications',
  use_cases: ['notifications', 'automation', 'email'],
  complexity: 'intermediate',
  frequency: 'high',

  // 🆕 Permission enforcement (Q1 2025)
  // Classification: WRITE - Create operation - modifies data
  permission: 'write',
  allowedRoles: ['developer', 'admin'],
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Notification name' },
      table: { type: 'string', description: 'Table to monitor' },
      condition: { type: 'string', description: 'When to trigger' },
      recipients: { type: 'string', description: 'Who receives notification' },
      subject: { type: 'string', description: 'Email subject' },
      message: { type: 'string', description: 'Email message' },
      active: { type: 'boolean', default: true }
    },
    required: ['name', 'table', 'condition']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { name, table, condition, recipients, subject, message, active = true } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const notificationData: any = {
      name,
      table,
      condition,
      active
    };
    if (recipients) notificationData.recipients = recipients;
    if (subject) notificationData.subject = subject;
    if (message) notificationData.message = message;
    const response = await client.post('/api/now/table/sysevent_email_action', notificationData);
    return createSuccessResult({ created: true, notification: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
