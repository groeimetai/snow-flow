"use strict";
/**
 * snow_get_job_history
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_job_history',
    description: 'Get scheduled job execution history',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'scheduling',
    use_cases: ['job-history', 'monitoring', 'troubleshooting'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            job_sys_id: { type: 'string', description: 'Scheduled job sys_id' },
            limit: { type: 'number', default: 50 }
        },
        required: ['job_sys_id']
    }
};
async function execute(args, context) {
    const { job_sys_id, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const response = await client.get('/api/now/table/sysauto_script_execution', {
            params: {
                sysparm_query: `script=${job_sys_id}`,
                sysparm_limit: limit,
                sysparm_display_value: 'true'
            }
        });
        return (0, error_handler_js_1.createSuccessResult)({
            history: response.data.result,
            count: response.data.result.length
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_get_job_history.js.map