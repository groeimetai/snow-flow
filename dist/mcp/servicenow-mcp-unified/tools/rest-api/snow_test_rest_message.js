"use strict";
/**
 * snow_test_rest_message
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.author = exports.version = exports.toolDefinition = void 0;
exports.execute = execute;
const auth_js_1 = require("../../shared/auth.js");
const error_handler_js_1 = require("../../shared/error-handler.js");
exports.toolDefinition = {
    name: 'snow_test_rest_message',
    description: 'Test REST message method',
    inputSchema: {
        type: 'object',
        properties: {
            rest_message_name: { type: 'string', description: 'REST message name' },
            method_name: { type: 'string', description: 'Method name' },
            parameters: { type: 'object', description: 'Request parameters' }
        },
        required: ['rest_message_name', 'method_name']
    }
};
async function execute(args, context) {
    const { rest_message_name, method_name, parameters = {} } = args;
    try {
        const client = await (0, auth_js_1.getAuthenticatedClient)(context);
        const testScript = `
var rm = new sn_ws.RESTMessageV2('${rest_message_name}', '${method_name}');
${Object.entries(parameters).map(([key, value]) => `rm.setStringParameter('${key}', '${value}');`).join('\n')}
var response = rm.execute();
var statusCode = response.getStatusCode();
var body = response.getBody();
gs.info('Status: ' + statusCode + ', Body: ' + body);
    `;
        const response = await client.post('/api/now/table/sys_script_execution', { script: testScript });
        return (0, error_handler_js_1.createSuccessResult)({
            tested: true,
            rest_message: rest_message_name,
            method: method_name
        });
    }
    catch (error) {
        return (0, error_handler_js_1.createErrorResult)(error.message);
    }
}
exports.version = '1.0.0';
exports.author = 'Snow-Flow SDK Migration';
//# sourceMappingURL=snow_test_rest_message.js.map