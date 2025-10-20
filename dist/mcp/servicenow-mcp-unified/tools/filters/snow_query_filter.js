"use strict";
/**
 * snow_query_filter
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_query_filter',
    description: 'Build ServiceNow encoded query filter',
    inputSchema: {
        type: 'object',
        properties: {
            conditions: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        field: { type: 'string' },
                        operator: { type: 'string', enum: ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'STARTSWITH', 'ENDSWITH'] },
                        value: { type: 'string' }
                    }
                },
                description: 'Filter conditions'
            },
            logic: { type: 'string', enum: ['AND', 'OR'], default: 'AND' }
        },
        required: ['conditions']
    }
};
async function execute(args, context) {
    const { conditions, logic = 'AND' } = args;
    try {
        const separator = logic === 'AND' ? '^' : '^OR';
        const query = conditions.map((cond) => `${cond.field}${cond.operator}${cond.value}`).join(separator);
        return (0, error_handler_js_1.createSuccessResult)({
            query,
            conditions: conditions.length,
            logic
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_query_filter.js.map