"use strict";
/**
 * snow_create_notification_template - Create notification templates
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_notification_template',
    description: 'Create reusable notification template with multi-channel support',
    inputSchema: {
        type: 'object',
        properties: {
            template_name: {
                type: 'string',
                description: 'Template name'
            },
            template_type: {
                type: 'string',
                description: 'Template type',
                enum: ['incident', 'change', 'approval', 'alert', 'reminder']
            },
            subject_template: {
                type: 'string',
                description: 'Subject template with variables (e.g., "Incident ${number} assigned")'
            },
            body_template: {
                type: 'string',
                description: 'Body template with variables'
            },
            channels: {
                type: 'array',
                items: { type: 'string' },
                description: 'Supported channels',
                default: ['email']
            },
            active: {
                type: 'boolean',
                description: 'Template is active',
                default: true
            }
        },
        required: ['template_name', 'template_type', 'subject_template', 'body_template']
    }
};
async function execute(args, context) {
    const { template_name, template_type, subject_template, body_template, channels = ['email'], active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create notification template in sysevent_email_template table
        const response = await client.post('/api/now/table/sysevent_email_template', {
            name: template_name,
            type: template_type,
            subject: subject_template,
            message: body_template,
            active: active,
            description: `Template for ${template_type} notifications - Channels: ${channels.join(', ')}`
        });
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            template: response.data.result,
            sys_id: response.data.result.sys_id,
            channels: channels
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_create_notification_template.js.map