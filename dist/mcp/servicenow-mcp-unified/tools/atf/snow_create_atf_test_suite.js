"use strict";
/**
 * snow_create_atf_test_suite - Create ATF test suite
 *
 * Creates an ATF test suite to group and run multiple tests together
 * using sys_atf_test_suite table.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_create_atf_test_suite',
    description: 'Creates an ATF test suite to group and run multiple tests together using sys_atf_test_suite table.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'development',
    subcategory: 'testing',
    use_cases: ['testing', 'atf', 'test-suites'],
    complexity: 'intermediate',
    frequency: 'medium',
    inputSchema: {
        type: 'object',
        properties: {
            name: { type: 'string', description: 'Test suite name' },
            description: { type: 'string', description: 'Suite description' },
            tests: { type: 'array', items: { type: 'string' }, description: 'Test IDs or names to include' },
            active: { type: 'boolean', description: 'Suite active status', default: true },
            runParallel: { type: 'boolean', description: 'Run tests in parallel', default: false }
        },
        required: ['name', 'tests']
    }
};
async function execute(args, context) {
    const { name, description = '', tests = [], active = true, runParallel = false } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Create test suite
        const suiteData = {
            name,
            description,
            active,
            run_parallel: runParallel
        };
        const response = await client.post('/api/now/table/sys_atf_test_suite', suiteData);
        const suite = response.data.result;
        // Add tests to suite
        const addedTests = [];
        for (const testId of tests) {
            // Resolve test ID if name provided
            let resolvedTestId = testId;
            if (!testId.match(/^[a-f0-9]{32}$/)) {
                const testQuery = await client.get(`/api/now/table/sys_atf_test?sysparm_query=name=${testId}&sysparm_limit=1`);
                if (testQuery.data.result && testQuery.data.result.length > 0) {
                    resolvedTestId = testQuery.data.result[0].sys_id;
                }
                else {
                    continue; // Skip if test not found
                }
            }
            const testSuiteRelation = await client.post('/api/now/table/sys_atf_test_suite_test', {
                test_suite: suite.sys_id,
                test: resolvedTestId
            });
            addedTests.push({
                test_id: resolvedTestId,
                relation_sys_id: testSuiteRelation.data.result.sys_id
            });
        }
        return (0, error_handler_js_1.createSuccessResult)({
            created: true,
            suite: {
                sys_id: suite.sys_id,
                name: suite.name,
                active,
                run_parallel: runParallel,
                tests_count: addedTests.length,
                tests: addedTests
            }
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
//# sourceMappingURL=snow_create_atf_test_suite.js.map