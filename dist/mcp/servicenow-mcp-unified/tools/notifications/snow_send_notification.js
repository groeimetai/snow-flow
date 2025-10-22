"use strict";
/**
 * snow_send_notification - Send notification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_send_notification',
    description: 'Send email/SMS notification',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'notifications',
    use_cases: ['notifications', 'email', 'sms'],
    complexity: 'beginner',
    frequency: 'high',
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
async function execute(args, context) {
    const { users, subject, message, type = 'email' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const notifData = { users: users.join(','), subject, message, type };
        const response = await client.post('/api/now/table/sysevent_email_action', notifData);
        return (0, error_handler_js_1.createSuccessResult)({ sent: true, notification: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_send_notification.js.map