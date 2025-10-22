"use strict";
/**
 * snow_cache_get
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_cache_get',
    description: 'Get value from cache',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'performance',
    use_cases: ['caching', 'performance', 'optimization'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            key: { type: 'string', description: 'Cache key' }
        },
        required: ['key']
    }
};
async function execute(args, context) {
    const { key } = args;
    try {
        return (0, error_handler_js_1.createSuccessResult)({
            key,
            cached: false,
            value: null
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_cache_get.js.map