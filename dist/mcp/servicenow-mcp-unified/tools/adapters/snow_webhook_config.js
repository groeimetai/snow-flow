"use strict";
/**
 * snow_webhook_config
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_webhook_config',
    description: 'Configure webhook endpoint',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Webhook name' },
            url: { type: 'string', description: 'Webhook URL' },
            http_method: { type: 'string', enum: ['POST', 'PUT', 'PATCH'], default: 'POST' },
            headers: { type: 'object', description: 'HTTP headers' }
        },
        required: ['name', 'url']
    }
};
async function execute(args, context) {
    const { name, url, http_method = 'POST', headers } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const webhookData = {
            name,
            url,
            http_method,
            active: true
        };
        if (headers)
            webhookData.headers = JSON.stringify(headers);
        const response = await client.post('/api/now/table/sys_web_service', webhookData);
        return (0, error_handler_js_1.createSuccessResult)({ configured: true, webhook: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_webhook_config.js.map