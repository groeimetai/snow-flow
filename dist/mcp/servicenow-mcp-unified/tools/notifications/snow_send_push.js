"use strict";
/**
 * snow_send_push - Send push notification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_send_push',
    description: 'Send mobile push notification',
    inputSchema: {
        type: 'object',
        properties: {
            device_ids: { type: 'array', items: { type: 'string' } },
            title: { type: 'string' },
            body: { type: 'string' }
        },
        required: ['device_ids', 'title', 'body']
    }
};
async function execute(args, context) {
    const { device_ids, title, body } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const pushData = { device_ids: device_ids.join(','), title, body };
        const response = await client.post('/api/now/v1/push/notification', pushData);
        return (0, error_handler_js_1.createSuccessResult)({ sent: true, push: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_send_push.js.map