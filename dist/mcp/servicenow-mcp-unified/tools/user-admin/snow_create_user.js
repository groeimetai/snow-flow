"use strict";
/**
 * snow_create_user
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_user',
    description: 'Create new user account',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'user-admin',
    use_cases: ['users', 'user-admin', 'accounts'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            user_name: { type: 'string', description: 'Username' },
            first_name: { type: 'string', description: 'First name' },
            last_name: { type: 'string', description: 'Last name' },
            email: { type: 'string', description: 'Email address' },
            department: { type: 'string', description: 'Department sys_id' },
            manager: { type: 'string', description: 'Manager sys_id' },
            active: { type: 'boolean', default: true }
        },
        required: ['user_name', 'first_name', 'last_name', 'email']
    }
};
async function execute(args, context) {
    const { user_name, first_name, last_name, email, department, manager, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const userData = { user_name, first_name, last_name, email, active };
        if (department)
            userData.department = department;
        if (manager)
            userData.manager = manager;
        const response = await client.post('/api/now/table/sys_user', userData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, user: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_user.js.map