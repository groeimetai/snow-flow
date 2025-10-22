"use strict";
/**
 * snow_get_ci_impact - Calculate CI impact analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_ci_impact',
    description: 'Calculate impact analysis for CI outage',
    // Metadata for tool discovery (not sent to LLM)
    category: 'cmdb',
    subcategory: 'impact-analysis',
    use_cases: ['cmdb', 'impact', 'analysis'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            ci_sys_id: { type: 'string', description: 'CI sys_id' },
            include_services: { type: 'boolean', description: 'Include business services', default: true }
        },
        required: ['ci_sys_id']
    }
};
async function execute(args, context) {
    const { ci_sys_id, include_services = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const relResponse = await client.get('/api/now/table/cmdb_rel_ci', {
            params: { sysparm_query: `child=${ci_sys_id}`, sysparm_limit: 100 }
        });
        const impactedCIs = relResponse.data.result;
        return (0, error_handler_js_1.createSuccessResult)({ ci_sys_id, impacted_count: impactedCIs.length, impacted_cis: impactedCIs });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_ci_impact.js.map