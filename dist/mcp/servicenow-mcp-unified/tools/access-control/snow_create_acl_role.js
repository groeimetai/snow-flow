"use strict";
/**
 * snow_create_acl_role
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_acl_role',
    description: 'Create ACL role association',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'access-control',
    use_cases: ['acl', 'roles', 'security'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            acl: { type: 'string', description: 'ACL sys_id' },
            role: { type: 'string', description: 'Role sys_id' }
        },
        required: ['acl', 'role']
    }
};
async function execute(args, context) {
    const { acl, role } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const aclRoleData = { sys_security_acl: acl, sys_user_role: role };
        const response = await client.post('/api/now/table/sys_security_acl_role', aclRoleData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, acl_role: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_acl_role.js.map