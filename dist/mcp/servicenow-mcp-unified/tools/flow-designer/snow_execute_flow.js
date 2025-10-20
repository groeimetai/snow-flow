"use strict";
/**
 * snow_execute_flow - Execute Flow Designer flow
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_execute_flow',
    description: 'Execute Flow Designer flow',
    inputSchema: {
        type: 'object',
        properties: {
            flow_sys_id: { type: 'string' },
            inputs: { type: 'object', description: 'Flow input variables' }
        },
        required: ['flow_sys_id']
    }
};
async function execute(args, context) {
    const { flow_sys_id, inputs = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.post(`/api/now/v1/process/execute/${flow_sys_id}`, inputs);
        return (0, error_handler_js_1.createSuccessResult)({ executed: true, execution: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_execute_flow.js.map