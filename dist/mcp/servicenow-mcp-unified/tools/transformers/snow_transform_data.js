"use strict";
/**
 * snow_transform_data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_transform_data',
    description: 'Transform data using field mappings',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'data-utilities',
    use_cases: ['data-transformation', 'field-mapping', 'integration'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            source_data: { type: 'object', description: 'Source data' },
            field_mappings: { type: 'object', description: 'Field mapping rules' }
        },
        required: ['source_data', 'field_mappings']
    }
};
async function execute(args, context) {
    const { source_data, field_mappings } = args;
    try {
        const transformed = {};
        for (const [targetField, sourceField] of Object.entries(field_mappings)) {
            transformed[targetField] = source_data[sourceField];
        }
        return (0, error_handler_js_1.createSuccessResult)({
            transformed: true,
            data: transformed
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_transform_data.js.map