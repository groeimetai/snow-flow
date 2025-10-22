"use strict";
/**
 * snow_discover_automation_jobs - Discover automation jobs
 *
 * Discovers automation jobs (scheduled scripts, executions) in the instance.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_discover_automation_jobs',
    description: 'Discovers automation jobs (scheduled scripts, executions) in the instance.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'discovery',
    use_cases: ['automation', 'discovery', 'jobs'],
    complexity: 'beginner',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            active: { type: 'boolean', description: 'Filter by active status' },
            nameContains: { type: 'string', description: 'Search by name pattern' },
            limit: { type: 'number', description: 'Maximum number of jobs to return', default: 50 }
        }
    }
};
async function execute(args, context) {
    const { active, nameContains, limit = 50 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Build query
        const queryParts = [];
        if (active !== undefined) {
            queryParts.push(`active=${active}`);
        }
        if (nameContains) {
            queryParts.push(`nameLIKE${nameContains}`);
        }
        const query = queryParts.join('^');
        const response = await client.get(`/api/now/table/sysauto_script?sysparm_query=${query}&sysparm_limit=${limit}&sysparm_display_value=true`);
        const jobs = response.data.result;
        const formattedJobs = jobs.map((job) => ({
            sys_id: job.sys_id,
            name: job.name,
            description: job.description,
            active: job.active === 'true',
            run_type: job.run_type,
            run_start: job.run_start,
            run_dayofweek: job.run_dayofweek,
            run_time: job.run_time,
            script: job.script ? '(script present)' : null,
            created_on: job.sys_created_on,
            updated_on: job.sys_updated_on
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            found: true,
            count: formattedJobs.length,
            jobs: formattedJobs
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error instanceof error_handler_js_1.SnowFlowError
            ? error
            : new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.UNKNOWN_ERROR, error.message, { originalError: error }));
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_discover_automation_jobs.js.map