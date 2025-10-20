"use strict";
/**
 * snow_create_ui_policy_action
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_ui_policy_action',
    description: 'Create UI policy action',
    inputSchema: {
        type: 'object',
        properties: {
            ui_policy_sys_id: { type: 'string', description: 'UI policy sys_id' },
            field: { type: 'string', description: 'Field name' },
            visible: { type: 'boolean', description: 'Make visible' },
            mandatory: { type: 'boolean', description: 'Make mandatory' },
            readonly: { type: 'boolean', description: 'Make readonly' }
        },
        required: ['ui_policy_sys_id', 'field']
    }
};
async function execute(args, context) {
    const { ui_policy_sys_id, field, visible, mandatory, readonly } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const actionData = {
            ui_policy: ui_policy_sys_id,
            field
        };
        if (visible !== undefined)
            actionData.visible = visible;
        if (mandatory !== undefined)
            actionData.mandatory = mandatory;
        if (readonly !== undefined)
            actionData.readonly = readonly;
        const response = await client.post('/api/now/table/sys_ui_policy_action', actionData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, action: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_ui_policy_action.js.map