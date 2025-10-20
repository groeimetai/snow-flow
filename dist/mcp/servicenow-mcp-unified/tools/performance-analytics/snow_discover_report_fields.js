"use strict";
/**
 * snow_discover_report_fields - Discover report fields
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_report_fields',
    description: 'Retrieves reportable fields from tables with type filtering and metadata',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name to analyze' },
            fieldType: { type: 'string', description: 'Filter by field type' }
        },
        required: ['table']
    }
};
async function execute(args, context) {
    const { table, fieldType } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let query = `name=${table}^element!=NULL`;
        if (fieldType)
            query += `^internal_type=${fieldType}`;
        const response = await client.get('/api/now/table/sys_dictionary', {
            params: {
                sysparm_query: query,
                sysparm_limit: 100
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            fields: response.data.result,
            count: response.data.result.length,
            table,
            message: `Found ${response.data.result.length} reportable fields for ${table}`
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_discover_report_fields.js.map