"use strict";
/**
 * snow_execute_atf_test - Execute ATF test or suite
 *
 * Executes an ATF test or test suite and returns the results.
 * Tests run asynchronously in ServiceNow using sys_atf_test_result table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_execute_atf_test',
    description: 'Executes an ATF test or test suite and returns the results. Tests run asynchronously in ServiceNow using sys_atf_test_result table.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'testing',
    use_cases: ['testing', 'atf', 'execution'],
    complexity: 'intermediate',
    frequency: 'high',
    inputSchema: {
        type: 'object',
        properties: {
            testId: { type: 'string', description: 'Test sys_id or name to execute' },
            suiteId: { type: 'string', description: 'Test suite sys_id or name (alternative to testId)' },
            async: { type: 'boolean', description: 'Run asynchronously', default: true },
            waitForResult: { type: 'boolean', description: 'Wait for test completion', default: false }
        }
    }
};
async function execute(args, context) {
    const { testId, suiteId, async = true, waitForResult = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        if (!testId && !suiteId) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, 'Either testId or suiteId must be provided');
        }
        let executionId;
        let executionType;
        // Execute test or suite
        if (testId) {
            // Resolve test ID if name provided
            let resolvedTestId = testId;
            if (!testId.match(/^[a-f0-9]{32}$/)) {
                const testQuery = await client.get(`/api/now/table/sys_atf_test?sysparm_query=name=${testId}&sysparm_limit=1`);
                if (!testQuery.data.result || testQuery.data.result.length === 0) {
                    throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.SERVICENOW_API_ERROR, `Test not found: ${testId}`);
                }
                resolvedTestId = testQuery.data.result[0].sys_id;
            }
            // Trigger test execution
            const response = await client.post('/api/now/atf/test/execute', {
                test: resolvedTestId,
                async
            });
            executionId = response.data.result.execution_id;
            executionType = 'test';
        }
        else {
            // Resolve suite ID if name provided
            let resolvedSuiteId = suiteId;
            if (!suiteId.match(/^[a-f0-9]{32}$/)) {
                const suiteQuery = await client.get(`/api/now/table/sys_atf_test_suite?sysparm_query=name=${suiteId}&sysparm_limit=1`);
                if (!suiteQuery.data.result || suiteQuery.data.result.length === 0) {
                    throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.SERVICENOW_API_ERROR, `Test suite not found: ${suiteId}`);
                }
                resolvedSuiteId = suiteQuery.data.result[0].sys_id;
            }
            // Trigger suite execution
            const response = await client.post('/api/now/atf/suite/execute', {
                test_suite: resolvedSuiteId,
                async
            });
            executionId = response.data.result.execution_id;
            executionType = 'suite';
        }
        // Optionally wait for results
        if (waitForResult && async) {
            let attempts = 0;
            const maxAttempts = 60; // 5 minutes max
            while (attempts < maxAttempts) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                const statusResponse = await client.get(`/api/now/table/sys_atf_test_result/${executionId}`);
                const result = statusResponse.data.result;
                if (result.status === 'success' || result.status === 'failure') {
                    return (0, error_handler_js_1.createSuccessResult)({
                        executed: true,
                        execution_id: executionId,
                        type: executionType,
                        status: result.status,
                        duration: result.run_time,
                        passed: result.status === 'success',
                        result_details: result
                    });
                }
                attempts++;
            }
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.TIMEOUT_ERROR, 'Test execution timeout');
        }
        return (0, error_handler_js_1.createSuccessResult)({
            executed: true,
            execution_id: executionId,
            type: executionType,
            status: async ? 'running' : 'completed',
            message: async ? 'Test execution started' : 'Test execution completed'
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
//# sourceMappingURL=snow_execute_atf_test.js.map