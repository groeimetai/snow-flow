"use strict";
/**
 * snow_get_catalog_item_details - Get catalog item details
 *
 * Gets detailed information about a catalog item including variables, pricing, and availability.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_catalog_item_details',
    description: 'Gets detailed information about a catalog item including variables, pricing, and availability.',
    inputSchema: {
        type: 'object',
        properties: {
            sys_id: { type: 'string', description: 'Catalog item sys_id' },
            include_variables: { type: 'boolean', description: 'Include all variables', default: true },
            include_ui_policies: { type: 'boolean', description: 'Include UI policies', default: false },
            include_client_scripts: { type: 'boolean', description: 'Include client scripts', default: false }
        },
        required: ['sys_id']
    }
};
async function execute(args, context) {
    const { sys_id, include_variables = true, include_ui_policies = false, include_client_scripts = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Get catalog item
        const itemResponse = await client.get(`/api/now/table/sc_cat_item/${sys_id}`);
        const item = itemResponse.data.result;
        // Get variables if requested
        let variables = [];
        if (include_variables) {
            const varResponse = await client.get('/api/now/table/sc_cat_item_option', {
                params: {
                    sysparm_query: `cat_item=${sys_id}`,
                    sysparm_limit: 50
                }
            });
            variables = varResponse.data.result;
        }
        // Get UI policies if requested
        let uiPolicies = [];
        if (include_ui_policies) {
            const policyResponse = await client.get('/api/now/table/catalog_ui_policy', {
                params: {
                    sysparm_query: `catalog_item=${sys_id}`,
                    sysparm_limit: 50
                }
            });
            uiPolicies = policyResponse.data.result;
        }
        // Get client scripts if requested
        let clientScripts = [];
        if (include_client_scripts) {
            const scriptResponse = await client.get('/api/now/table/catalog_script_client', {
                params: {
                    sysparm_query: `cat_item=${sys_id}`,
                    sysparm_limit: 50
                }
            });
            clientScripts = scriptResponse.data.result;
        }
        return (0, error_handler_js_1.createSuccessResult)({
            item,
            variables: include_variables ? variables : undefined,
            ui_policies: include_ui_policies ? uiPolicies : undefined,
            client_scripts: include_client_scripts ? clientScripts : undefined,
            variable_count: variables.length,
            ui_policy_count: uiPolicies.length,
            client_script_count: clientScripts.length
        }, {
            operation: 'get_catalog_item_details',
            item_id: sys_id
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_catalog_item_details.js.map