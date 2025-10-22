"use strict";
/**
 * snow_create_acl
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_acl',
    description: 'Create Access Control List rule',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'access-control',
    use_cases: ['acl', 'security', 'permissions'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'ACL name' },
            operation: { type: 'string', enum: ['read', 'write', 'create', 'delete'], description: 'Operation type' },
            type: { type: 'string', description: 'ACL type (record/field)' },
            admin_overrides: { type: 'boolean', default: true },
            active: { type: 'boolean', default: true }
        },
        required: ['name', 'operation']
    }
};
async function execute(args, context) {
    const { name, operation, type, admin_overrides = true, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const aclData = { name, operation, admin_overrides, active };
        if (type)
            aclData.type = type;
        const response = await client.post('/api/now/table/sys_security_acl', aclData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, acl: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_acl.js.map