/**
 * snow_send_notification - Send notification
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_send_notification',
  description: 'Send email/SMS notification',
  inputSchema: {
    type: 'object',
    properties: {
      users: { type: 'array', items: { type: 'string' } },
      subject: { type: 'string' },
      message: { type: 'string' },
      type: { type: 'string', enum: ['email', 'sms', 'push'] }
    },
    required: ['users', 'subject', 'message']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { users, subject, message, type = 'email' } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const notifData = { users: users.join(','), subject, message, type };
    const response = await client.post('/api/now/table/sysevent_email_action', notifData);
    return createSuccessResult({ sent: true, notification: response.data.result });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
