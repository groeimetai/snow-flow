/**
 * snow_send_email
 */

import { MCPToolDefinition, ServiceNowContext, ToolResult } from '../../shared/types.js';
import { getAuthenticatedClient } from '../../shared/auth.js';
import { createSuccessResult, createErrorResult } from '../../shared/error-handler.js';

export const toolDefinition: MCPToolDefinition = {
  name: 'snow_send_email',
  description: 'Send email notification',
  inputSchema: {
    type: 'object',
    properties: {
      to: { type: 'string', description: 'Recipient email or user sys_id' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body' },
      from: { type: 'string', description: 'Sender email' },
      cc: { type: 'string', description: 'CC recipients' },
      bcc: { type: 'string', description: 'BCC recipients' }
    },
    required: ['to', 'subject', 'body']
  }
};

export async function execute(args: any, context: ServiceNowContext): Promise<ToolResult> {
  const { to, subject, body, from, cc, bcc } = args;
  try {
    const client = await getAuthenticatedClient(context);
    const emailScript = `
var mail = new GlideEmailOutbound();
mail.setSubject('${subject.replace(/'/g, "\\'")}');
mail.setBody('${body.replace(/'/g, "\\'")}');
mail.addAddress('to', '${to}');
${from ? `mail.setFrom('${from}');` : ''}
${cc ? `mail.addAddress('cc', '${cc}');` : ''}
${bcc ? `mail.addAddress('bcc', '${bcc}');` : ''}
mail.send();
    `;
    await client.post('/api/now/table/sys_script_execution', { script: emailScript });
    return createSuccessResult({
      sent: true,
      to,
      subject
    });
  } catch (error: any) {
    return createErrorResult(error.message);
  }
}

export const version = '1.0.0';
export const author = 'Snow-Flow SDK Migration';
