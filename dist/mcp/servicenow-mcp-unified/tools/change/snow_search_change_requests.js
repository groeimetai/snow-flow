"use strict";
/**
 * snow_search_change_requests - Search change requests
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_search_change_requests',
    description: 'Search change requests with filters',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query' },
            state: { type: 'string', description: 'Filter by state' },
            type: { type: 'string', description: 'Filter by type' },
            risk: { type: 'number', description: 'Filter by risk level' },
            assigned_to: { type: 'string', description: 'Filter by assignee' },
            limit: { type: 'number', description: 'Maximum results', default: 20 }
        }
    }
};
async function execute(args, context) {
    const { query, state, type, risk, assigned_to, limit = 20 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let queryString = '';
        if (query)
            queryString = `short_descriptionLIKE${query}^ORdescriptionLIKE${query}`;
        if (state)
            queryString += (queryString ? '^' : '') + `state=${state}`;
        if (type)
            queryString += (queryString ? '^' : '') + `type=${type}`;
        if (risk)
            queryString += (queryString ? '^' : '') + `risk=${risk}`;
        if (assigned_to)
            queryString += (queryString ? '^' : '') + `assigned_to=${assigned_to}`;
        const response = await client.get(`/api/now/table/change_request?sysparm_query=${queryString}&sysparm_limit=${limit}`);
        return (0, error_handler_js_1.createSuccessResult)({ changes: response.data?.result || [], count: response.data?.result?.length || 0 });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_search_change_requests.js.map