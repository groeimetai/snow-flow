"use strict";
/**
 * snow_discover_reporting_tables - Discover reporting tables
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_reporting_tables',
    description: 'Discovers tables available for reporting with filtering by category and data availability',
    // Metadata for tool discovery (not sent to LLM)
    category: 'reporting',
    subcategory: 'discovery',
    use_cases: ['table-discovery', 'reporting', 'data-sources'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            category: { type: 'string', description: 'Table category filter' },
            hasData: { type: 'boolean', description: 'Only tables with data' }
        }
    }
};
async function execute(args, context) {
    const { category, hasData } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let query = '';
        if (category)
            query = `sys_class_name=${category}`;
        const response = await client.get('/api/now/table/sys_db_object', {
            params: {
                sysparm_query: query || '',
                sysparm_limit: 100
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            tables: response.data.result,
            count: response.data.result.length,
            message: `Found ${response.data.result.length} reporting tables`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_discover_reporting_tables.js.map