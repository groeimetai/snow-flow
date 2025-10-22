"use strict";
/**
 * snow_decode_base64
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_decode_base64',
    description: 'Decode Base64 to string',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'utilities',
    use_cases: ['encoding', 'decoding', 'base64'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            encoded: { type: 'string', description: 'Base64 encoded string' }
        },
        required: ['encoded']
    }
};
async function execute(args, context) {
    const { encoded } = args;
    try {
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        return (0, error_handler_js_1.createSuccessResult)({ decoded, encoded_length: encoded.length });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_decode_base64.js.map