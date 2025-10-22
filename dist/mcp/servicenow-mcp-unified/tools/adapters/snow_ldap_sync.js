"use strict";
/**
 * snow_ldap_sync
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_ldap_sync',
    description: 'Trigger LDAP user synchronization',
    // Metadata for tool discovery (not sent to LLM)
    category: 'integration',
    subcategory: 'adapters',
    use_cases: ['ldap-sync', 'user-sync', 'authentication'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            ldap_server_sys_id: { type: 'string', description: 'LDAP server sys_id' }
        },
        required: ['ldap_server_sys_id']
    }
};
async function execute(args, context) {
    const { ldap_server_sys_id } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const syncScript = `
var ldapSync = new LDAPUserSync();
ldapSync.syncUsers('${ldap_server_sys_id}');
gs.info('LDAP sync initiated');
    `;
        await client.post('/api/now/table/sys_script_execution', { script: syncScript });
        return (0, error_handler_js_1.createSuccessResult)({
            synced: true,
            ldap_server: ldap_server_sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_ldap_sync.js.map