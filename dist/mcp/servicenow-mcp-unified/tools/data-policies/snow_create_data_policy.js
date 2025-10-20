"use strict";
/**
 * snow_create_data_policy
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_data_policy',
    description: 'Create data policy',
    inputSchema: {
        type: 'object',
        properties: {
            short_description: { type: 'string', description: 'Policy description' },
            table: { type: 'string', description: 'Table name' },
            condition: { type: 'string', description: 'When to apply' },
            reverse_if_false: { type: 'boolean', default: true },
            active: { type: 'boolean', default: true }
        },
        required: ['short_description', 'table']
    }
};
async function execute(args, context) {
    const { short_description, table, condition, reverse_if_false = true, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const policyData = {
            short_description,
            table,
            reverse_if_false,
            active
        };
        if (condition)
            policyData.condition = condition;
        const response = await client.post('/api/now/table/sys_data_policy2', policyData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, data_policy: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_data_policy.js.map