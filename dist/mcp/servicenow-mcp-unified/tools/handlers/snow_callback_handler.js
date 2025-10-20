"use strict";
/**
 * snow_callback_handler
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_callback_handler',
    description: 'Create callback handler for async operations',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Callback name' },
            callback_url: { type: 'string', description: 'Callback URL' },
            http_method: { type: 'string', enum: ['POST', 'PUT', 'PATCH'], default: 'POST' }
        },
        required: ['name', 'callback_url']
    }
};
async function execute(args, context) {
    const { name, callback_url, http_method = 'POST' } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            configured: true,
            name,
            callback_url,
            http_method
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_callback_handler.js.map