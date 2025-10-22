"use strict";
/**
 * snow_get_flow_execution_status - Get flow execution status
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_flow_execution_status',
    description: 'Get status of a specific flow execution',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'flow-designer',
    use_cases: ['monitoring', 'status', 'execution-tracking'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            execution_sys_id: {
                type: 'string',
                description: 'Flow execution context sys_id'
            },
            include_action_details: {
                type: 'boolean',
                description: 'Include individual action execution details',
                default: false
            }
        },
        required: ['execution_sys_id']
    }
};
async function execute(args, context) {
    const { execution_sys_id, include_action_details = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get execution context
        const executionResponse = await client.get(`/api/now/table/sys_hub_flow_context/${execution_sys_id}`);
        const execution = executionResponse.data.result;
        const status = {
            sys_id: execution.sys_id,
            status: execution.status,
            started: execution.started,
            completed: execution.completed,
            duration_seconds: execution.completed && execution.started
                ? Math.round((new Date(execution.completed).getTime() - new Date(execution.started).getTime()) / 1000)
                : null,
            flow: execution.flow,
            trigger_record: execution.trigger_record,
            error_message: execution.error_message
        };
        if (include_action_details) {
            // Get action execution details
            const actionsResponse = await client.get('/api/now/table/sys_hub_action_context', {
                params: {
                    sysparm_query: `flow_context=${execution_sys_id}`,
                    sysparm_fields: 'sys_id,action,status,started,completed,error_message'
                }
            });
            status.actions = actionsResponse.data.result;
        }
        return (0, error_handler_js_1.createSuccessResult)(status);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_flow_execution_status.js.map