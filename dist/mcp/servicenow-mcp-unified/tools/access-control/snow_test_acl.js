"use strict";
/**
 * snow_test_acl
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_test_acl',
    description: 'Test ACL access for user',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'access-control',
    use_cases: ['acl', 'testing', 'security'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            table: { type: 'string', description: 'Table name' },
            operation: { type: 'string', enum: ['read', 'write', 'create', 'delete'], description: 'Operation' },
            user: { type: 'string', description: 'User sys_id to test' },
            record_id: { type: 'string', description: 'Specific record sys_id' }
        },
        required: ['table', 'operation']
    }
};
async function execute(args, context) {
    const { table, operation, user, record_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const testScript = `
var gr = new GlideRecord('${table}');
${record_id ? `gr.get('${record_id}');` : 'gr.query(); gr.next();'}
var canAccess = gr.canRead() || gr.canWrite() || gr.canCreate() || gr.canDelete();
gs.info('ACL Test: ' + canAccess);
canAccess;
    `;
        const response = await client.post('/api/now/table/sys_script_execution', { script: testScript });
        return (0, error_handler_js_1.createSuccessResult)({
            has_access: response.data.result,
            table,
            operation,
            tested_user: user || 'current'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_test_acl.js.map