"use strict";
/**
 * snow_get_journal_entries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_journal_entries',
    description: 'Get journal entries for record',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'comments',
    use_cases: ['journals', 'audit', 'history'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            record_sys_id: { type: 'string', description: 'Record sys_id' },
            limit: { type: 'number', default: 100 }
        },
        required: ['table', 'record_sys_id']
    }
};
async function execute(args, context) {
    const { table, record_sys_id, limit = 100 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/sys_journal_field', {
            params: {
                sysparm_query: `name=${table}^element_id=${record_sys_id}`,
                sysparm_limit: limit,
                sysparm_display_value: 'true'
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            entries: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_journal_entries.js.map