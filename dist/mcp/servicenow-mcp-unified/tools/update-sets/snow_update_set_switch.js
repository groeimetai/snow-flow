"use strict";
/**
 * snow_update_set_switch - Switch active Update Set
 *
 * Switches the active Update Set context to an existing set.
 * Ensures all subsequent changes are tracked in the specified Update Set.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_update_set_switch',
    description: 'Switch to a different Update Set for tracking changes',
    inputSchema: {
        type: 'object',
        properties: {
            update_set_id: {
                type: 'string',
                description: 'Update Set sys_id to switch to'
            }
        },
        required: ['update_set_id']
    }
};
async function execute(args, context) {
    const { update_set_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Verify Update Set exists
        const checkResponse = await client.get(`/api/now/table/sys_update_set/${update_set_id}`, {
            params: {
                sysparm_fields: 'sys_id,name,description,state,sys_created_on'
            }
        });
        if (!checkResponse.data.result) {
            return (0, error_handler_js_1.createErrorResult)(`Update Set not found: ${update_set_id}`);
        }
        const updateSet = checkResponse.data.result;
        // Switch to this Update Set
        await client.put(`/api/now/table/sys_update_set/${update_set_id}`, {
            is_current: true
        });
        return (0, error_handler_js_1.createSuccessResult)({
            sys_id: updateSet.sys_id,
            name: updateSet.name,
            description: updateSet.description,
            state: updateSet.state,
            switched: true,
            created_at: updateSet.sys_created_on
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_update_set_switch.js.map