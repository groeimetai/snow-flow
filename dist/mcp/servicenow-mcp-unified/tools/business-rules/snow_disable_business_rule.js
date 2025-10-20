"use strict";
/**
 * snow_disable_business_rule
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_disable_business_rule',
    description: 'Disable business rule',
    inputSchema: {
        type: 'object',
        properties: {
            rule_sys_id: { type: 'string', description: 'Business rule sys_id' }
        },
        required: ['rule_sys_id']
    }
};
async function execute(args, context) {
    const { rule_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.patch(`/api/now/table/sys_script/${rule_sys_id}`, { active: false });
        return (0, error_handler_js_1.createSuccessResult)({ disabled: true, business_rule: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_disable_business_rule.js.map