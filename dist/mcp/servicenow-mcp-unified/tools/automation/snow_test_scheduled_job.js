"use strict";
/**
 * snow_test_scheduled_job - Test scheduled job
 *
 * Tests a scheduled job by executing it immediately and returning results.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_test_scheduled_job',
    description: 'Tests a scheduled job by executing it immediately and returning results.',
    inputSchema: {
        type: 'object',
        properties: {
            jobId: { type: 'string', description: 'Scheduled job sys_id or name' },
            waitForCompletion: { type: 'boolean', description: 'Wait for job completion', default: false }
        },
        required: ['jobId']
    }
};
async function execute(args, context) {
    const { jobId, waitForCompletion = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Resolve job ID if name provided
        let resolvedJobId = jobId;
        if (!jobId.match(/^[a-f0-9]{32}$/)) {
            const jobQuery = await client.get(`/api/now/table/sysauto_script?sysparm_query=name=${jobId}&sysparm_limit=1`);
            if (!jobQuery.data.result || jobQuery.data.result.length === 0) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.SERVICENOW_API_ERROR, `Scheduled job not found: ${jobId}`);
            }
            resolvedJobId = jobQuery.data.result[0].sys_id;
        }
        // Get job details
        const jobResponse = await client.get(`/api/now/table/sysauto_script/${resolvedJobId}`);
        const job = jobResponse.data.result;
        // Execute job immediately
        const executeResponse = await client.post('/api/now/table/sysauto', {
            name: `Test execution: ${job.name}`,
            script: job.script,
            run_start: new Date().toISOString()
        });
        const execution = executeResponse.data.result;
        if (waitForCompletion) {
            // Poll for completion
            let attempts = 0;
            const maxAttempts = 30; // 2.5 minutes max
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                const statusResponse = await client.get(`/api/now/table/sysauto/${execution.sys_id}`);
                const status = statusResponse.data.result;
                if (status.state === 'complete' || status.state === 'error') {
                    return (0, error_handler_js_1.createSuccessResult)({
                        executed: true,
                        job_id: resolvedJobId,
                        execution_id: execution.sys_id,
                        state: status.state,
                        success: status.state === 'complete',
                        output: status.output || null,
                        error: status.error || null
                    });
                }
                attempts++;
            }
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.TIMEOUT_ERROR, 'Job execution timeout');
        }
        return (0, error_handler_js_1.createSuccessResult)({
            executed: true,
            job_id: resolvedJobId,
            execution_id: execution.sys_id,
            state: 'running',
            message: 'Job execution started'
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
//# sourceMappingURL=snow_test_scheduled_job.js.map