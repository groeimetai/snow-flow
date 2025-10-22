"use strict";
/**
 * snow_add_user_to_group
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_add_user_to_group',
    description: 'Add user to group',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'specialized',
    use_cases: ["user_admin"],
    complexity: 'intermediate',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            user: { type: 'string', description: 'User sys_id' },
            group: { type: 'string', description: 'Group sys_id' }
        },
        required: ['user', 'group']
    }
};
async function execute(args, context) {
    const { user, group } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const membershipData = { user, group };
        const response = await client.post('/api/now/table/sys_user_grmember', membershipData);
        return (0, error_handler_js_1.createSuccessResult)({ added: true, membership: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_add_user_to_group.js.map