"use strict";
/**
 * snow_deactivate_user
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_deactivate_user',
    description: 'Deactivate user account',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'user-admin',
    use_cases: ['users', 'deactivation', 'user-admin'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            user_id: { type: 'string', description: 'User sys_id' }
        },
        required: ['user_id']
    }
};
async function execute(args, context) {
    const { user_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.patch(`/api/now/table/sys_user/${user_id}`, { active: false });
        return (0, error_handler_js_1.createSuccessResult)({ deactivated: true, user: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_deactivate_user.js.map