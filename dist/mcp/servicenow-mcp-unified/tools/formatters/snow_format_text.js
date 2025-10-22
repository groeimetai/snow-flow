"use strict";
/**
 * snow_format_text
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_format_text',
    description: 'Format text with various transformations',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'utilities',
    use_cases: ['formatting', 'text', 'transformation'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            text: { type: 'string', description: 'Text to format' },
            transform: { type: 'string', enum: ['uppercase', 'lowercase', 'titlecase', 'camelcase', 'snakecase'], default: 'lowercase' }
        },
        required: ['text']
    }
};
async function execute(args, context) {
    const { text, transform = 'lowercase' } = args;
    try {
        let formatted = text;
        switch (transform) {
            case 'uppercase':
                formatted = text.toUpperCase();
                break;
            case 'lowercase':
                formatted = text.toLowerCase();
                break;
            case 'titlecase':
                formatted = text.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
                break;
            case 'camelcase':
                formatted = text.split(' ').map((word, i) => i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join('');
                break;
            case 'snakecase':
                formatted = text.toLowerCase().replace(/\s+/g, '_');
                break;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            formatted,
            transform,
            original: text
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_format_text.js.map