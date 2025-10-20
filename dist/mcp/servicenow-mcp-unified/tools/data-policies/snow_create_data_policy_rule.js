"use strict";
/**
 * snow_create_data_policy_rule
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_data_policy_rule',
    description: 'Create data policy rule',
    inputSchema: {
        type: 'object',
        properties: {
            data_policy_sys_id: { type: 'string', description: 'Data policy sys_id' },
            field: { type: 'string', description: 'Field name' },
            mandatory: { type: 'boolean', description: 'Make mandatory' },
            readonly: { type: 'boolean', description: 'Make readonly' }
        },
        required: ['data_policy_sys_id', 'field']
    }
};
async function execute(args, context) {
    const { data_policy_sys_id, field, mandatory, readonly } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const ruleData = {
            sys_data_policy: data_policy_sys_id,
            element: field
        };
        if (mandatory !== undefined)
            ruleData.mandatory = mandatory;
        if (readonly !== undefined)
            ruleData.readonly = readonly;
        const response = await client.post('/api/now/table/sys_data_policy_rule', ruleData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, rule: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_data_policy_rule.js.map