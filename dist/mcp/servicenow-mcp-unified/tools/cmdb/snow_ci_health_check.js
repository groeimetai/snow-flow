"use strict";
/**
 * snow_ci_health_check - CI health monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_ci_health_check',
    description: 'Check CI health and compliance status',
    inputSchema: {
        type: 'object',
        properties: {
            ci_sys_id: { type: 'string' },
            include_metrics: { type: 'boolean', default: true }
        },
        required: ['ci_sys_id']
    }
};
async function execute(args, context) {
    const { ci_sys_id, include_metrics = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const ciResponse = await client.get(`/api/now/table/cmdb_ci/${ci_sys_id}`);
        const ci = ciResponse.data.result;
        const health = {
            operational_status: ci.operational_status,
            install_status: ci.install_status,
            support_group: ci.support_group,
            last_discovered: ci.last_discovered,
            health_score: calculateHealthScore(ci)
        };
        return (0, error_handler_js_1.createSuccessResult)({ ci_sys_id, health, ci_name: ci.name });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
function calculateHealthScore(ci) {
    let score = 100;
    if (ci.operational_status != '1')
        score -= 30;
    if (!ci.last_discovered)
        score -= 20;
    return Math.max(0, score);
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_ci_health_check.js.map