"use strict";
/**
 * snow_autocomplete
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_autocomplete',
    description: 'Get autocomplete suggestions',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'utilities',
    use_cases: ['autocomplete', 'search', 'ux'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            field: { type: 'string', description: 'Field name' },
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', default: 10 }
        },
        required: ['table', 'field', 'query']
    }
};
async function execute(args, context) {
    const { table, field, query, limit = 10 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get(`/api/now/table/${table}`, {
            params: {
                sysparm_query: `${field}LIKE${query}`,
                sysparm_fields: field,
                sysparm_limit: limit
            }
        });
        const suggestions = response.data.result.map((r) => r[field]);
        return (0, error_handler_js_1.createSuccessResult)({
            suggestions,
            count: suggestions.length,
            query
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_autocomplete.js.map