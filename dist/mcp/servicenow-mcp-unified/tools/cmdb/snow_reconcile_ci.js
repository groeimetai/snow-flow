"use strict";
/**
 * snow_reconcile_ci - CMDB reconciliation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_reconcile_ci',
    description: 'Reconcile CI data from multiple sources',
    // Metadata for tool discovery (not sent to LLM)
    category: 'cmdb',
    subcategory: 'reconciliation',
    use_cases: ['cmdb', 'reconciliation', 'data-quality'],
    complexity: 'advanced',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            ci_sys_id: { type: 'string', description: 'CI to reconcile' },
            source_data: { type: 'object', description: 'Source data to reconcile' },
            reconciliation_rule: { type: 'string', description: 'Reconciliation rule', default: 'merge' }
        },
        required: ['ci_sys_id', 'source_data']
    }
};
async function execute(args, context) {
    const { ci_sys_id, source_data, reconciliation_rule = 'merge' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Simplified reconciliation - merge source data
        const response = await client.put(`/api/now/table/cmdb_ci/${ci_sys_id}`, source_data);
        return (0, error_handler_js_1.createSuccessResult)({ reconciled: true, ci: response.data.result, rule: reconciliation_rule });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_reconcile_ci.js.map