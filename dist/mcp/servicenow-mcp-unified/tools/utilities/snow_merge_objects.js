"use strict";
/**
 * snow_merge_objects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_merge_objects',
    description: 'Deep merge multiple objects',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'utilities',
    use_cases: ['object-merging', 'data-utilities', 'utilities'],
    complexity: 'beginner',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            objects: { type: 'array', items: { type: 'object' }, description: 'Objects to merge' }
        },
        required: ['objects']
    }
};
async function execute(args, context) {
    const { objects } = args;
    try {
        const merged = objects.reduce((acc, obj) => {
            return { ...acc, ...obj };
        }, {});
        return (0, error_handler_js_1.createSuccessResult)({
            merged,
            object_count: objects.length,
            key_count: Object.keys(merged).length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_merge_objects.js.map