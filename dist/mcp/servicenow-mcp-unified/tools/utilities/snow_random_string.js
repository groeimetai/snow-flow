"use strict";
/**
 * snow_random_string
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_random_string',
    description: 'Generate random string',
    inputSchema: {
        type: 'object',
        properties: {
            length: { type: 'number', default: 16 },
            charset: { type: 'string', enum: ['alphanumeric', 'alpha', 'numeric', 'hex'], default: 'alphanumeric' }
        }
    }
};
async function execute(args, context) {
    const { length = 16, charset = 'alphanumeric' } = args;
    try {
        const charsets = {
            'alphanumeric': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
            'alpha': 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
            'numeric': '0123456789',
            'hex': '0123456789abcdef'
        };
        const chars = charsets[charset];
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return (0, error_handler_js_1.createSuccessResult)({ random_string: result, length, charset });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_random_string.js.map