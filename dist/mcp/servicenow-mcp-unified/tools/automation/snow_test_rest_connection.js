"use strict";
/**
 * snow_test_rest_connection - Test REST message connections
 *
 * Tests a REST message connection with full response details and diagnostics.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_test_rest_connection',
    description: 'Test REST message connection with full response details and diagnostics',
    inputSchema: {
        type: 'object',
        properties: {
            rest_message: {
                type: 'string',
                description: 'REST Message name'
            },
            method: {
                type: 'string',
                description: 'HTTP Method name'
            },
            test_params: {
                type: 'object',
                description: 'Test parameters for the request'
            },
            return_full_response: {
                type: 'boolean',
                description: 'Return complete response details',
                default: true
            },
            validate_auth: {
                type: 'boolean',
                description: 'Validate authentication',
                default: true
            }
        },
        required: ['rest_message']
    }
};
async function execute(args, context) {
    const { rest_message, method, test_params = {}, return_full_response = true, validate_auth = true } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        // Find REST message
        const restMessageResponse = await client.get(`/api/now/table/sys_rest_message?sysparm_query=name=${rest_message}&sysparm_limit=1`);
        if (!restMessageResponse.data.result || restMessageResponse.data.result.length === 0) {
            throw new error_handler_js_1.SnowFlowError(error_handler_js_1.ErrorType.NOT_FOUND, `REST message not found: ${rest_message}`, { retryable: false });
        }
        const restMessage = restMessageResponse.data.result[0];
        // Find method if specified
        let methodRecord = null;
        if (method) {
            const methodResponse = await client.get(`/api/now/table/sys_rest_message_fn?sysparm_query=rest_message=${restMessage.sys_id}^name=${method}&sysparm_limit=1`);
            if (methodResponse.data.result && methodResponse.data.result.length > 0) {
                methodRecord = methodResponse.data.result[0];
            }
        }
        // Build test script
        const testScript = `
var restMessage = new sn_ws.RESTMessageV2('${rest_message}', ${method ? `'${method}'` : 'null'});

// Set test parameters
var testParams = ${JSON.stringify(test_params)};
for (var key in testParams) {
  restMessage.setStringParameterNoEscape(key, testParams[key]);
}

try {
  var response = restMessage.execute();
  var responseBody = response.getBody();
  var httpStatus = response.getStatusCode();
  var headers = response.getHeaders();

  var result = {
    success: httpStatus >= 200 && httpStatus < 300,
    status_code: httpStatus,
    response_body: responseBody,
    headers: headers,
    error_message: response.getErrorMessage() || null
  };

  JSON.stringify(result);
} catch(e) {
  JSON.stringify({
    success: false,
    error_message: e.toString()
  });
}
`;
        // Execute test script
        const scriptResponse = await client.post('/api/now/table/sys_script_execution', {
            script: testScript
        });
        let testResult;
        try {
            const resultData = scriptResponse.data.result || scriptResponse.data;
            testResult = JSON.parse(typeof resultData === 'string' ? resultData : JSON.stringify(resultData));
        }
        catch (parseError) {
            testResult = {
                success: false,
                error_message: 'Failed to parse test results'
            };
        }
        return (0, error_handler_js_1.createSuccessResult)({
            rest_message: rest_message,
            method: method || 'default',
            test_successful: testResult.success,
            status_code: testResult.status_code,
            response_body: return_full_response ? testResult.response_body : '[Response body hidden]',
            headers: testResult.headers || {},
            error_message: testResult.error_message,
            endpoint: restMessage.endpoint,
            authentication_type: restMessage.authentication_type
        }, {
            operation: 'test_rest_connection',
            rest_message_name: rest_message
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
//# sourceMappingURL=snow_test_rest_connection.js.map