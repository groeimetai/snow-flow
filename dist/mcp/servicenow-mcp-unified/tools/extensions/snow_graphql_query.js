"use strict";
/**
 * snow_graphql_query
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_graphql_query',
    description: 'Execute GraphQL query',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'graphql',
    use_cases: ['graphql', 'query', 'data-retrieval'],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'GraphQL query' },
            variables: { type: 'object', description: 'Query variables' }
        },
        required: ['query']
    }
};
async function execute(args, context) {
    const { query, variables } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post('/api/now/graphql', {
            query,
            variables: variables || {}
        });
        return (0, error_handler_js_1.createSuccessResult)({
            success: true,
            data: response.data
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_graphql_query.js.map