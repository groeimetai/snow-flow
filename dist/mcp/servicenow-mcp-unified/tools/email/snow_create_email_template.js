"use strict";
/**
 * snow_create_email_template
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_email_template',
    description: 'Create email notification template',
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
async function execute(args, context) {
    const { name, table, subject, body, type = 'html' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const templateData = {
            name,
            subject,
            body,
            type: type === 'html' ? 'text/html' : 'text/plain'
        };
        if (table)
            templateData.table = table;
        const response = await client.post('/api/now/table/sysevent_email_template', templateData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, template: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_email_template.js.map