"use strict";
/**
 * snow_assign_role
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_assign_role',
    description: 'Assign role to user or group',
    // Metadata for tool discovery (not sent to LLM)
    category: 'core-operations',
    subcategory: 'user-admin',
    use_cases: ['roles', 'permissions', 'user-admin'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            role: { type: 'string', description: 'Role sys_id' },
            user: { type: 'string', description: 'User sys_id (user or group required)' },
            group: { type: 'string', description: 'Group sys_id (user or group required)' },
            inherited: { type: 'boolean', default: false }
        },
        required: ['role']
    }
};
async function execute(args, context) {
    const { role, user, group, inherited = false } = args;
    try {
        if (!user && !group) {
            return (0, error_handler_js_1.createErrorResult)('Either user or group must be specified');
        }
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const assignmentData = { role, inherited };
        if (user)
            assignmentData.user = user;
        if (group)
            assignmentData.group = group;
        const response = await client.post('/api/now/table/sys_user_has_role', assignmentData);
        return (0, error_handler_js_1.createSuccessResult)({ assigned: true, assignment: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_assign_role.js.map