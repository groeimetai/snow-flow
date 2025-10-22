"use strict";
/**
 * snow_create_role
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_role',
    description: 'Create security role',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'user-admin',
    use_cases: ['roles', 'security', 'permissions'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Role name' },
            description: { type: 'string', description: 'Role description' },
            requires_subscription: { type: 'string', description: 'Required subscription' }
        },
        required: ['name']
    }
};
async function execute(args, context) {
    const { name, description, requires_subscription } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const roleData = { name };
        if (description)
            roleData.description = description;
        if (requires_subscription)
            roleData.requires_subscription = requires_subscription;
        const response = await client.post('/api/now/table/sys_user_role', roleData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, role: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_role.js.map