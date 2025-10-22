"use strict";
/**
 * snow_get_by_sysid - Get artifact by sys_id
 *
 * Retrieve any ServiceNow record by its sys_id with optional
 * field selection and display values.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_by_sysid',
    description: 'Get any ServiceNow record by sys_id with optional field selection',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'crud',
    use_cases: ['read', 'records'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            table: {
                type: 'string',
                description: 'Table name (e.g., sp_widget, sys_ux_page, incident)'
            },
            sys_id: {
                type: 'string',
                description: 'sys_id of the record to retrieve'
            },
            fields: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific fields to return (default: all)',
                default: []
            },
            display_value: {
                type: 'boolean',
                description: 'Return display values for reference fields',
                default: false
            }
        },
        required: ['table', 'sys_id']
    }
};
async function execute(args, context) {
    const { table, sys_id, fields = [], display_value = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query parameters
        const params = {};
        if (fields.length > 0) {
            params.sysparm_fields = fields.join(',');
        }
        if (display_value) {
            params.sysparm_display_value = 'true';
        }
        // Get record
        const response = await client.get(`/api/now/table/${table}/${sys_id}`, { params });
        if (!response.data || !response.data.result) {
            return (0, error_handler_js_1.createErrorResult)(`Record not found: ${table}/${sys_id}`);
        }
        const record = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            found: true,
            record,
            table,
            sys_id
        });
    }
    catch (error) {
        if (error.response?.status === 404) {
            return (0, error_handler_js_1.createSuccessResult)({
                found: false,
                table,
                sys_id,
                error: 'Record not found'
            });
        }
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_by_sysid.js.map