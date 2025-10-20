"use strict";
/**
 * snow_sanitize_input
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_sanitize_input',
    description: 'Sanitize input for security',
    inputSchema: {
        type: 'object',
        properties: {
            input: { type: 'string', description: 'Input to sanitize' },
            type: { type: 'string', enum: ['html', 'sql', 'script'], default: 'html' }
        },
        required: ['input']
    }
};
async function execute(args, context) {
    const { input, type = 'html' } = args;
    try {
        let sanitized = input;
        switch (type) {
            case 'html':
                sanitized = input
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#x27;');
                break;
            case 'sql':
                sanitized = input.replace(/['";]/g, '');
                break;
            case 'script':
                sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
                break;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            sanitized,
            type,
            original_length: input.length,
            sanitized_length: sanitized.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_sanitize_input.js.map