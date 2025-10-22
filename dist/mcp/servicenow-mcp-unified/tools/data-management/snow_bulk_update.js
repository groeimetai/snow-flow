"use strict";
/**
 * snow_bulk_update
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_bulk_update',
    description: 'Bulk update multiple records',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'bulk-operations',
    use_cases: ['bulk-update', 'data-management', 'batch'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            query: { type: 'string', description: 'Query to select records' },
            updates: { type: 'object', description: 'Fields to update' },
            limit: { type: 'number', default: 100, description: 'Max records to update' }
        },
        required: ['table', 'query', 'updates']
    }
};
async function execute(args, context) {
    const { table, query, updates, limit = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const getRecords = await client.get(`/api/now/table/${table}`, {
            params: { sysparm_query: query, sysparm_limit: limit }
        });
        const updatePromises = getRecords.data.result.map((record) => client.patch(`/api/now/table/${table}/${record.sys_id}`, updates));
        const results = await Promise.all(updatePromises);
        return (0, error_handler_js_1.createSuccessResult)({
            updated: true,
            count: results.length,
            records: results.map(r => r.data.result)
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_bulk_update.js.map