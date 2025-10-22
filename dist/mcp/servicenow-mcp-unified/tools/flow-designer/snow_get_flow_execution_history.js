"use strict";
/**
 * snow_get_flow_execution_history - Get flow execution history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_flow_execution_history',
    description: 'Get flow execution history with filtering options',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'flow-designer',
    use_cases: ['history', 'monitoring', 'troubleshooting'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            flow_sys_id: {
                type: 'string',
                description: 'Flow sys_id to get execution history'
            },
            limit: {
                type: 'number',
                description: 'Maximum number of executions to return',
                default: 10,
                minimum: 1,
                maximum: 100
            },
            status: {
                type: 'string',
                description: 'Filter by execution status',
                enum: ['success', 'error', 'in_progress', 'cancelled']
            }
        },
        required: ['flow_sys_id']
    }
};
async function execute(args, context) {
    const { flow_sys_id, limit = 10, status } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        let query = `flow=${flow_sys_id}`;
        if (status) {
            query += `^status=${status}`;
        }
        const response = await client.get('/api/now/table/sys_hub_flow_context', {
            params: {
                sysparm_query: query + '^ORDERBYDESCstarted',
                sysparm_limit: limit,
                sysparm_fields: 'sys_id,status,started,completed,trigger_record,error_message'
            }
        });
        const executions = response.data.result;
        return (0, error_handler_js_1.createSuccessResult)({
            flow_sys_id,
            count: executions.length,
            executions: executions.map((e) => ({
                sys_id: e.sys_id,
                status: e.status,
                started: e.started,
                completed: e.completed,
                trigger_record: e.trigger_record,
                error_message: e.error_message
            }))
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_flow_execution_history.js.map