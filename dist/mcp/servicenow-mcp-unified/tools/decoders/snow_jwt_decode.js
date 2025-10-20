"use strict";
/**
 * snow_jwt_decode
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_jwt_decode',
    description: 'Decode JWT token',
    inputSchema: {
        type: 'object',
        properties: {
            token: { type: 'string', description: 'JWT token' }
        },
        required: ['token']
    }
};
async function execute(args, context) {
    const { token } = args;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return (0, error_handler_js_1.createErrorResult)('Invalid JWT token');
        }
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        return (0, error_handler_js_1.createSuccessResult)({
            decoded: true,
            payload,
            header: JSON.parse(Buffer.from(parts[0], 'base64').toString())
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_jwt_decode.js.map