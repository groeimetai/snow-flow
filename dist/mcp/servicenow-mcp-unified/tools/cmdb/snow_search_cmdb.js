"use strict";
/**
 * snow_search_cmdb - Search the CMDB for Configuration Items
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_search_cmdb',
    description: 'Search the CMDB for Configuration Items with various filters',
    // Metadata for tool discovery (not sent to LLM)
    category: 'cmdb',
    subcategory: 'query',
    use_cases: ['cmdb', 'search', 'query'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query for CI name' },
            ci_class: { type: 'string', description: 'Filter by CI class' },
            operational_status: { type: 'string', description: 'Filter by operational status' },
            location: { type: 'string', description: 'Filter by location' },
            limit: { type: 'number', description: 'Maximum results to return', default: 50 }
        }
    }
};
async function execute(args, context) {
    const { query, ci_class, operational_status, location, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query string
        const queryParts = [];
        if (query) {
            queryParts.push(`nameLIKE${query}`);
        }
        if (ci_class) {
            queryParts.push(`sys_class_name=${ci_class}`);
        }
        if (operational_status) {
            queryParts.push(`operational_status=${operational_status}`);
        }
        if (location) {
            queryParts.push(`location=${location}`);
        }
        const queryString = queryParts.join('^');
        const url = `/api/now/table/cmdb_ci?sysparm_query=${queryString}&sysparm_limit=${limit}`;
        const response = await client.get(url);
        const cis = response.data.result || [];
        return (0, error_handler_js_1.createSuccessResult)({
            total: cis.length,
            cis: cis,
            query: queryString
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_search_cmdb.js.map