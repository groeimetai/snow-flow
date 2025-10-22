"use strict";
/**
 * snow_get_sla_status
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_sla_status',
    description: 'Get SLA status for record',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'sla',
    use_cases: ['sla-monitoring', 'status-check', 'service-level'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            record_sys_id: { type: 'string', description: 'Record sys_id' }
        },
        required: ['table', 'record_sys_id']
    }
};
async function execute(args, context) {
    const { table, record_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/task_sla', {
            params: {
                sysparm_query: `task=${record_sys_id}`,
                sysparm_display_value: 'true'
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            slas: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_sla_status.js.map