"use strict";
/**
 * snow_get_ci_details - Get detailed CI information including relationships
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_ci_details',
    description: 'Retrieve Configuration Item details including relationships and history',
    inputSchema: {
        type: 'object',
        properties: {
            ci_id: { type: 'string', description: 'CI sys_id or name' },
            include_relationships: { type: 'boolean', description: 'Include CI relationships', default: true },
            include_history: { type: 'boolean', description: 'Include change history', default: false }
        },
        required: ['ci_id']
    }
};
async function execute(args, context) {
    const { ci_id, include_relationships = true, include_history = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Check if ci_id is a sys_id or name
        let query = ci_id.match(/^[a-f0-9]{32}$/)
            ? `sys_id=${ci_id}`
            : `name=${ci_id}`;
        // Get CI details
        const ciResponse = await client.get(`/api/now/table/cmdb_ci?sysparm_query=${query}&sysparm_limit=1`);
        if (!ciResponse.data.result || ciResponse.data.result.length === 0) {
            return (0, error_handler_js_1.createErrorResult)('CI not found');
        }
        const ci = ciResponse.data.result[0];
        const result = { ci };
        // Get relationships if requested
        if (include_relationships) {
            const relQuery = `parent=${ci.sys_id}^ORchild=${ci.sys_id}`;
            const relResponse = await client.get(`/api/now/table/cmdb_rel_ci?sysparm_query=${relQuery}&sysparm_limit=50`);
            result.relationships = relResponse.data.result || [];
        }
        // Get history if requested
        if (include_history) {
            const historyResponse = await client.get(`/api/now/table/sys_audit?sysparm_query=tablename=cmdb_ci^documentkey=${ci.sys_id}&sysparm_limit=20&sysparm_order_by=^ORDERBYDESCsys_created_on`);
            result.history = historyResponse.data.result || [];
        }
        return (0, error_handler_js_1.createSuccessResult)(result);
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_ci_details.js.map