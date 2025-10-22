"use strict";
/**
 * snow_assess_change_risk - Risk assessment
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_assess_change_risk',
    description: 'Assess change request risk',
    // Metadata for tool discovery (not sent to LLM)
    category: 'itsm',
    subcategory: 'change',
    use_cases: ['risk-assessment', 'analysis', 'change-management'],
    complexity: 'intermediate',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            change_sys_id: { type: 'string' },
            assessment_factors: { type: 'object' }
        },
        required: ['change_sys_id']
    }
};
async function execute(args, context) {
    const { change_sys_id, assessment_factors = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const changeResponse = await client.get(`/api/now/table/change_request/${change_sys_id}`);
        const change = changeResponse.data.result;
        const riskScore = calculateRisk(change, assessment_factors);
        const response = await client.put(`/api/now/table/change_request/${change_sys_id}`, {
            risk: riskScore > 70 ? 'high' : riskScore > 40 ? 'medium' : 'low'
        });
        return (0, error_handler_js_1.createSuccessResult)({ assessed: true, risk_score: riskScore, change: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
function calculateRisk(change, factors) {
    let score = 50;
    if (change.impact === '1')
        score += 30;
    if (change.urgency === '1')
        score += 20;
    return Math.min(100, score);
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_assess_change_risk.js.map