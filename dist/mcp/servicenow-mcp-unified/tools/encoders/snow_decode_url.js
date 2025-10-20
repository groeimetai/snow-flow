"use strict";
/**
 * snow_decode_url
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_decode_url',
    description: 'URL decode string',
    inputSchema: {
        type: 'object',
        properties: {
            encoded: { type: 'string', description: 'URL encoded string' }
        },
        required: ['encoded']
    }
};
async function execute(args, context) {
    const { encoded } = args;
    try {
        const decoded = decodeURIComponent(encoded);
        return (0, error_handler_js_1.createSuccessResult)({ decoded, encoded });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_decode_url.js.map