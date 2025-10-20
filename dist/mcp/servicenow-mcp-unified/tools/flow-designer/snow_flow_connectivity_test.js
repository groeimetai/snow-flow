"use strict";
/**
 * snow_flow_connectivity_test - Test flow connectivity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_flow_connectivity_test',
    description: 'Test flow connectivity and action connections',
    inputSchema: {
        type: 'object',
        properties: {
            flow_sys_id: {
                type: 'string',
                description: 'Flow sys_id to test connectivity'
            }
        },
        required: ['flow_sys_id']
    }
};
async function execute(args, context) {
    const { flow_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get flow details
        const flowResponse = await client.get(`/api/now/table/sys_hub_flow/${flow_sys_id}`);
        const flow = flowResponse.data.result;
        // Get flow actions
        const actionsResponse = await client.get('/api/now/table/sys_hub_action_instance', {
            params: {
                sysparm_query: `flow=${flow_sys_id}`,
                sysparm_fields: 'sys_id,name,action_name,active'
            }
        });
        const actions = actionsResponse.data.result;
        const connectivityResults = {
            flow_name: flow.name,
            flow_active: flow.active,
            total_actions: actions.length,
            active_actions: actions.filter((a) => a.active === 'true').length,
            actions: actions.map((a) => ({
                name: a.name,
                action_name: a.action_name,
                active: a.active
            }))
        };
        return (0, error_handler_js_1.createSuccessResult)(connectivityResults);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_flow_connectivity_test.js.map