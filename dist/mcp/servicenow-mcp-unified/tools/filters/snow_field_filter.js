"use strict";
/**
 * snow_field_filter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_field_filter',
    description: 'Create field-based filter',
    inputSchema: {
        type: 'object',
        properties: {
            field: { type: 'string', description: 'Field name' },
            values: { type: 'array', items: { type: 'string' }, description: 'Values to filter' },
            match_type: { type: 'string', enum: ['exact', 'contains', 'startsWith', 'endsWith'], default: 'exact' }
        },
        required: ['field', 'values']
    }
};
async function execute(args, context) {
    const { field, values, match_type = 'exact' } = args;
    try {
        const operatorMap = {
            'exact': '=',
            'contains': 'LIKE',
            'startsWith': 'STARTSWITH',
            'endsWith': 'ENDSWITH'
        };
        const operator = operatorMap[match_type];
        const query = values.map(val => `${field}${operator}${val}`).join('^OR');
        return (0, error_handler_js_1.createSuccessResult)({
            query,
            field,
            match_type,
            value_count: values.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_field_filter.js.map