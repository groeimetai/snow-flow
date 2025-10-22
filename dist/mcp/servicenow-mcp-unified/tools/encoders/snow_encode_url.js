"use strict";
/**
 * snow_encode_url
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_encode_url',
    description: 'URL encode string',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'utilities',
    use_cases: ['encoding', 'url', 'conversion'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: 'Text to encode' }
        },
        required: ['text']
    }
};
async function execute(args, context) {
    const { text } = args;
    try {
        const encoded = encodeURIComponent(text);
        return (0, error_handler_js_1.createSuccessResult)({ encoded, original: text });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_encode_url.js.map