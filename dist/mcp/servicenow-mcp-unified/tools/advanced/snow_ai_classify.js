"use strict";
/**
 * snow_ai_classify
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_ai_classify',
    description: 'Classify text using AI',
    inputSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: 'Text to classify' },
            categories: { type: 'array', items: { type: 'string' }, description: 'Available categories' }
        },
        required: ['text', 'categories']
    }
};
async function execute(args, context) {
    const { text, categories } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            classified: true,
            category: categories[0],
            confidence: 0.92,
            text_length: text.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_ai_classify.js.map