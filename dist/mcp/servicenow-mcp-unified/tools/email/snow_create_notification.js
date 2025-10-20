"use strict";
/**
 * snow_create_notification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_notification',
    description: 'Create automated notification',
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
async function execute(args, context) {
    const { name, table, condition, recipients, subject, message, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const notificationData = {
            name,
            table,
            condition,
            active
        };
        if (recipients)
            notificationData.recipients = recipients;
        if (subject)
            notificationData.subject = subject;
        if (message)
            notificationData.message = message;
        const response = await client.post('/api/now/table/sysevent_email_action', notificationData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, notification: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_notification.js.map