"use strict";
/**
 * snow_fuzzy_search
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_fuzzy_search',
    description: 'Perform fuzzy search across tables',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query' },
            tables: { type: 'array', items: { type: 'string' }, description: 'Tables to search' },
            threshold: { type: 'number', default: 0.7, description: 'Match threshold (0-1)' }
        },
        required: ['query', 'tables']
    }
};
async function execute(args, context) {
    const { query, tables, threshold = 0.7 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const results = [];
        for (const table of tables) {
            const response = await client.get(`/api/now/table/${table}`, {
                params: {
                    sysparm_query: `123TEXTQUERY321${query}`,
                    sysparm_limit: 10
                }
            });
            results.push(...response.data.result);
        }
        return (0, error_handler_js_1.createSuccessResult)({
            results,
            count: results.length,
            query,
            threshold
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_fuzzy_search.js.map