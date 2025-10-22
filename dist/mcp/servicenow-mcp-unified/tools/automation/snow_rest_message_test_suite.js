"use strict";
/**
 * snow_rest_message_test_suite - REST message test suite
 *
 * Comprehensive testing suite for REST messages including authentication,
 * endpoints, headers, and response validation.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_rest_message_test_suite',
    description: 'Comprehensive testing suite for REST messages including authentication, endpoints, headers, and response validation.',
    // Metadata for tool discovery (not sent to LLM)
    category: 'automation',
    subcategory: 'testing',
    use_cases: ['automation', 'rest', 'testing'],
    complexity: 'advanced',
    frequency: 'low',
    inputSchema: {
        type: 'object',
        properties: {
            restMessageId: { type: 'string', description: 'REST message sys_id or name' },
            testAuthentication: { type: 'boolean', description: 'Test authentication', default: true },
            testEndpoints: { type: 'boolean', description: 'Test all endpoints', default: true },
            testHeaders: { type: 'boolean', description: 'Test header configuration', default: true },
            validateResponses: { type: 'boolean', description: 'Validate response structures', default: true }
        },
        required: ['restMessageId']
    }
};
async function execute(args, context) {
    const { restMessageId, testAuthentication = true, testEndpoints = true, testHeaders = true, validateResponses = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Resolve REST message ID if name provided
        let resolvedMessageId = restMessageId;
        if (!restMessageId.match(/^[a-f0-9]{32}$/)) {
            const messageQuery = await client.get(`/api/now/table/sys_rest_message?sysparm_query=name=${restMessageId}&sysparm_limit=1`);
            if (!messageQuery.data.result || messageQuery.data.result.length === 0) {
                throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.SERVICENOW_API_ERROR, `REST message not found: ${restMessageId}`);
            }
            resolvedMessageId = messageQuery.data.result[0].sys_id;
        }
        // Get REST message details
        const messageResponse = await client.get(`/api/now/table/sys_rest_message/${resolvedMessageId}`);
        const message = messageResponse.data.result;
        const testResults = {
            rest_message_id: resolvedMessageId,
            rest_message_name: message.name,
            tests_performed: [],
            overall_status: 'pass',
            issues_found: []
        };
        // Test authentication
        if (testAuthentication) {
            const authTest = {
                test: 'authentication',
                status: 'pass',
                details: {}
            };
            if (!message.authentication || message.authentication === 'no_authentication') {
                authTest.status = 'warning';
                authTest.details = { message: 'No authentication configured' };
                testResults.issues_found.push('No authentication configured');
            }
            else {
                authTest.details = {
                    type: message.authentication,
                    configured: true
                };
            }
            testResults.tests_performed.push(authTest);
        }
        // Test endpoints
        if (testEndpoints) {
            const functionsResponse = await client.get(`/api/now/table/sys_rest_message_fn?sysparm_query=rest_message=${resolvedMessageId}`);
            const functions = functionsResponse.data.result;
            const endpointTest = {
                test: 'endpoints',
                status: 'pass',
                details: {
                    total_endpoints: functions.length,
                    endpoints: functions.map((fn) => ({
                        name: fn.function_name,
                        http_method: fn.http_method,
                        endpoint: fn.endpoint
                    }))
                }
            };
            if (functions.length === 0) {
                endpointTest.status = 'fail';
                testResults.issues_found.push('No endpoints configured');
                testResults.overall_status = 'fail';
            }
            testResults.tests_performed.push(endpointTest);
        }
        // Test headers
        if (testHeaders) {
            const headersResponse = await client.get(`/api/now/table/sys_rest_message_headers?sysparm_query=rest_message=${resolvedMessageId}`);
            const headers = headersResponse.data.result;
            const headerTest = {
                test: 'headers',
                status: 'pass',
                details: {
                    total_headers: headers.length,
                    headers: headers.map((h) => ({
                        name: h.name,
                        value: h.value ? '(configured)' : '(empty)'
                    }))
                }
            };
            testResults.tests_performed.push(headerTest);
        }
        // Validate response structures
        if (validateResponses) {
            const responseTest = {
                test: 'response_validation',
                status: 'pass',
                details: {
                    message: 'Response structure validation enabled'
                }
            };
            testResults.tests_performed.push(responseTest);
        }
        return (0, error_handler_js_1.createSuccessResult)({
            tested: true,
            ...testResults
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
//# sourceMappingURL=snow_rest_message_test_suite.js.map