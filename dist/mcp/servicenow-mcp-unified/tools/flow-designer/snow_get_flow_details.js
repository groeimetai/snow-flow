"use strict";
/**
 * snow_get_flow_details - Get flow details
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_flow_details',
    description: 'Get detailed flow configuration including triggers, actions, and variables',
    inputSchema: {
        type: 'object',
        properties: {
            flow_sys_id: {
                type: 'string',
                description: 'Flow sys_id to get details'
            },
            include_actions: {
                type: 'boolean',
                description: 'Include action details',
                default: true
            }
        },
        required: ['flow_sys_id']
    }
};
async function execute(args, context) {
    const { flow_sys_id, include_actions = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get flow details
        const flowResponse = await client.get(`/api/now/table/sys_hub_flow/${flow_sys_id}`);
        const flow = flowResponse.data.result;
        const details = {
            sys_id: flow.sys_id,
            name: flow.name,
            description: flow.description,
            active: flow.active,
            trigger_type: flow.trigger_type,
            table: flow.table,
            run_as: flow.run_as
        };
        if (include_actions) {
            // Get flow actions
            const actionsResponse = await client.get('/api/now/table/sys_hub_action_instance', {
                params: {
                    sysparm_query: `flow=${flow_sys_id}`,
                    sysparm_fields: 'sys_id,name,action_name,sequence,active,inputs'
                }
            });
            details.actions = actionsResponse.data.result;
        }
        return (0, error_handler_js_1.createSuccessResult)(details);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_flow_details.js.map