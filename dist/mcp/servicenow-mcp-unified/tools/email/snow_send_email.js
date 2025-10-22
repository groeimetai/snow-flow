"use strict";
/**
 * snow_send_email
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_send_email',
    description: 'Send email notification',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'notifications',
    use_cases: ['email', 'notifications', 'communication'],
    complexity: 'beginner',
    frequency: 'high',
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
async function execute(args, context) {
    const { to, subject, body, from, cc, bcc } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
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
        return (0, error_handler_js_1.createSuccessResult)({
            sent: true,
            to,
            subject
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_send_email.js.map