"use strict";
/**
 * snow_discover_atf_tests - Discover ATF tests
 *
 * Discovers ATF tests in the instance with filtering and search capabilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_atf_tests',
    description: 'Discovers ATF tests in the instance with filtering and search capabilities.',
    inputSchema: {
        type: 'object',
        properties: {
            category: { type: 'string', description: 'Filter by test category' },
            table: { type: 'string', description: 'Filter by table name' },
            active: { type: 'boolean', description: 'Filter by active status' },
            nameContains: { type: 'string', description: 'Search by name pattern' },
            limit: { type: 'number', description: 'Maximum number of tests to return', default: 50 }
        }
    }
};
async function execute(args, context) {
    const { category, table, active, nameContains, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
        if (category) {
            queryParts.push(`category=${category}`);
        }
        if (table) {
            queryParts.push(`table_name=${table}`);
        }
        if (active !== undefined) {
            queryParts.push(`active=${active}`);
        }
        if (nameContains) {
            queryParts.push(`nameLIKE${nameContains}`);
        }
        const query = queryParts.join('^') || 'sys_class_name=sys_atf_test';
        const response = await client.get(`/api/now/table/sys_atf_test?sysparm_query=${query}&sysparm_limit=${limit}&sysparm_display_value=true`);
        const tests = response.data.result;
        const formattedTests = tests.map((test) => ({
            sys_id: test.sys_id,
            name: test.name,
            description: test.description,
            category: test.category,
            table: test.table_name || null,
            active: test.active === 'true',
            created_on: test.sys_created_on,
            updated_on: test.sys_updated_on,
            created_by: test.sys_created_by?.display_value || test.sys_created_by
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            found: true,
            count: formattedTests.length,
            tests: formattedTests
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }));
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_atf_tests.js.map