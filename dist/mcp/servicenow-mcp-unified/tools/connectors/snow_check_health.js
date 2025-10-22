"use strict";
/**
 * snow_check_health
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_check_health',
    description: 'Check ServiceNow instance health',
    // Metadata for tool discovery (not sent to LLM)
    category: 'advanced',
    subcategory: 'monitoring',
    use_cases: ['health-check', 'monitoring', 'diagnostics'],
    complexity: 'beginner',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {}
    }
};
async function execute(args, context) {
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const startTime = Date.now();
        await client.get('/api/now/table/sys_user', { params: { sysparm_limit: 1 } });
        const responseTime = Date.now() - startTime;
        return (0, error_handler_js_1.createSuccessResult)({
            healthy: true,
            response_time_ms: responseTime,
            status: responseTime < 1000 ? 'good' : responseTime < 3000 ? 'fair' : 'slow'
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_check_health.js.map