"use strict";
/**
 * snow_create_scheduled_job
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_scheduled_job',
    description: 'Create scheduled job',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'scheduling',
    use_cases: ['scheduled-jobs', 'background-scripts', 'automation'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Job name' },
            script: { type: 'string', description: 'Script to execute (ES5 only!)' },
            run_type: { type: 'string', enum: ['once', 'periodically', 'daily', 'weekly', 'monthly'], default: 'periodically' },
            run_period: { type: 'string', description: 'Run period (for periodically)' },
            run_dayofweek: { type: 'string', description: 'Day of week (for weekly)' },
            run_dayofmonth: { type: 'string', description: 'Day of month (for monthly)' },
            run_time: { type: 'string', description: 'Run time' },
            active: { type: 'boolean', default: true }
        },
        required: ['name', 'script']
    }
};
async function execute(args, context) {
    const { name, script, run_type = 'periodically', run_period, run_dayofweek, run_dayofmonth, run_time, active = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const jobData = { name, script, run_type, active };
        if (run_period)
            jobData.run_period = run_period;
        if (run_dayofweek)
            jobData.run_dayofweek = run_dayofweek;
        if (run_dayofmonth)
            jobData.run_dayofmonth = run_dayofmonth;
        if (run_time)
            jobData.run_time = run_time;
        const response = await client.post('/api/now/table/sysauto_script', jobData);
        return (0, error_handler_js_1.createSuccessResult)({ created: true, job: response.data.result });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_create_scheduled_job.js.map