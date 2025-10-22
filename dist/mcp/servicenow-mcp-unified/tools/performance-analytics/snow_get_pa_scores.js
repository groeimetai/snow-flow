"use strict";
/**
 * snow_get_pa_scores
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_pa_scores',
    description: 'Get PA scores',
    // Metadata for tool discovery (not sent to LLM)
    category: 'performance-analytics',
    subcategory: 'indicators',
    use_cases: ['performance-analytics', 'scores', 'indicators'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            indicator_sys_id: { type: 'string' },
            time_range: { type: 'string' }
        },
        required: ['indicator_sys_id']
    }
};
async function execute(args, context) {
    const { indicator_sys_id, time_range = '30days' } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/pa_scores', {
            params: { sysparm_query: `indicator=${indicator_sys_id}`, sysparm_limit: 100 }
        });
        return (0, error_handler_js_1.createSuccessResult)({ scores: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
//# sourceMappingURL=snow_get_pa_scores.js.map