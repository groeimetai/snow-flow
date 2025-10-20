"use strict";
/**
 * snow_get_atf_results - Get ATF test results
 *
 * Retrieves ATF test execution results including pass/fail status,
 * error details, and execution time from sys_atf_test_result table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_get_atf_results',
    description: 'Retrieves ATF test execution results including pass/fail status, error details, and execution time from sys_atf_test_result table.',
    inputSchema: {
        type: 'object',
        properties: {
            executionId: { type: 'string', description: 'Test execution ID' },
            testId: { type: 'string', description: 'Test ID to get latest results' },
            limit: { type: 'number', description: 'Number of recent results to retrieve', default: 10 }
        }
    }
};
async function execute(args, context) {
    const { executionId, testId, limit = 10 } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        if (!executionId && !testId) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.VALIDATION_ERROR, 'Either executionId or testId must be provided');
        }
        let query = '';
        if (executionId) {
            query = `sys_id=${executionId}`;
        }
        else if (testId) {
            // Resolve test ID if name provided
            let resolvedTestId = testId;
            if (!testId.match(/^[a-f0-9]{32}$/)) {
                const testQuery = await client.get(`/api/now/table/sys_atf_test?sysparm_query=name=${testId}&sysparm_limit=1`);
                if (!testQuery.data.result || testQuery.data.result.length === 0) {
                    throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.SERVICENOW_API_ERROR, `Test not found: ${testId}`);
                }
                resolvedTestId = testQuery.data.result[0].sys_id;
            }
            query = `test=${resolvedTestId}^ORDERBYDESCsys_created_on`;
        }
        const response = await client.get(`/api/now/table/sys_atf_test_result?sysparm_query=${query}&sysparm_limit=${limit}`);
        const results = response.data.result;
        if (!results || results.length === 0) {
            return (0, error_handler_js_1.createSuccessResult)({
                found: false,
                message: 'No test results found',
                results: []
            });
        }
        const formattedResults = results.map((result) => ({
            sys_id: result.sys_id,
            test_id: result.test?.value || result.test,
            test_name: result.test?.display_value || 'Unknown',
            status: result.status,
            passed: result.status === 'success',
            duration: result.run_time,
            start_time: result.start_time,
            end_time: result.end_time,
            output: result.output,
            error_message: result.error_message || null,
            steps_passed: result.steps_passed || 0,
            steps_failed: result.steps_failed || 0,
            steps_total: result.total_steps || 0
        }));
        return (0, error_handler_js_1.createSuccessResult)({
            found: true,
            count: formattedResults.length,
            results: formattedResults
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
//# sourceMappingURL=snow_get_atf_results.js.map